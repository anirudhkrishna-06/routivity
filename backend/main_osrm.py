# main.py
import os
import math
import logging
from datetime import datetime, timedelta, time as dtime
from typing import List, Optional, Tuple, Dict, Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dateutil import parser as dateparser
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("routivity.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

logger.info("Starting Routivity Trip Planner Backend MVP (OSRM + Overpass)")

app = FastAPI(title="Routivity — Trip Planner Backend MVP")

# ----------------------------
# Models
# ----------------------------
class LatLng(BaseModel):
    lat: float
    lng: float


class TimeWindow(BaseModel):
    start: str
    end: str


class TripRequest(BaseModel):
    source: LatLng
    destination: LatLng
    stops: Optional[List[LatLng]] = []
    mealPreferences: List[str]
    mealWindows: Dict[str, TimeWindow]
    preferred_reach_time: str
    veg_pref: Optional[str] = "any"
    max_detour_minutes: int = 15
    meal_duration_min: int = 30


class PlaceSuggestion(BaseModel):
    osm_id: str
    name: str
    location: LatLng
    detour_minutes: int
    eta_iso: str
    tags: Dict[str, Any] = {}


class RouteSummary(BaseModel):
    total_distance_km: float
    total_duration_min: float
    stops: List[str]
    geometry: List[List[float]]


class TripResponse(BaseModel):
    trip_id: str
    recommended_departure_iso: str
    recommended_departure_window: List[str]
    route_summary: RouteSummary
    meal_suggestions: Dict[str, List[PlaceSuggestion]]


# ----------------------------
# OSRM ROUTING
# ----------------------------
OSRM_BASE_URL = "http://router.project-osrm.org"

async def call_osrm_route(origin: LatLng, destination: LatLng, waypoints: List[LatLng] = None) -> Dict:
    coords = f"{origin.lng},{origin.lat}"
    if waypoints:
        coords += ";" + ";".join([f"{p.lng},{p.lat}" for p in waypoints])
    coords += f";{destination.lng},{destination.lat}"

    url = f"{OSRM_BASE_URL}/route/v1/driving/{coords}"
    params = {"overview": "full", "geometries": "geojson", "steps": "true"}

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    if "routes" not in data:
        raise HTTPException(status_code=502, detail="OSRM routing failed")

    return data["routes"][0]


# ----------------------------
# OVERPASS PLACES
# ----------------------------
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

async def search_places(lat: float, lon: float, radius: int = 2000, query: str = "restaurant") -> List[Dict]:
    # Overpass QL: find nodes/ways with amenity=restaurant near point
    q = f"""
    [out:json][timeout:25];
    (
      node["amenity"="{query}"](around:{radius},{lat},{lon});
      way["amenity"="{query}"](around:{radius},{lat},{lon});
      relation["amenity"="{query}"](around:{radius},{lat},{lon});
    );
    out center;
    """
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(OVERPASS_URL, data={"data": q})
        r.raise_for_status()
        data = r.json()

    elements = data.get("elements", [])
    places = []
    for el in elements:
        if "tags" not in el:
            continue
        places.append(
            {
                "osm_id": str(el.get("id")),
                "name": el["tags"].get("name", "Unknown"),
                "lat": el.get("lat", el.get("center", {}).get("lat")),
                "lon": el.get("lon", el.get("center", {}).get("lon")),
                "tags": el.get("tags", {}),
            }
        )
    return places


# ----------------------------
# Utilities
# ----------------------------
def extract_checkpoints(route: Dict) -> List[Dict]:
    checkpoints = []
    cum = 0
    for leg in route.get("legs", []):
        for step in leg.get("steps", []):
            end = step["maneuver"]["location"]
            duration = step["duration"]
            cum += duration
            checkpoints.append({"lat": end[1], "lng": end[0], "cum_seconds": cum})
    return checkpoints


def find_point_for_window(checkpoints, departure_dt: datetime, window_start: dtime, window_end: dtime):
    start_dt = departure_dt.replace(hour=window_start.hour, minute=window_start.minute, second=0, microsecond=0)
    end_dt = departure_dt.replace(hour=window_end.hour, minute=window_end.minute, second=0, microsecond=0)
    if end_dt <= start_dt:
        end_dt += timedelta(days=1)

    candidate = None
    min_dist = None
    center = start_dt + (end_dt - start_dt) / 2
    for cp in checkpoints:
        eta = departure_dt + timedelta(seconds=cp["cum_seconds"])
        if start_dt <= eta <= end_dt:
            return (LatLng(lat=cp["lat"], lng=cp["lng"]), eta)
        dist = abs((eta - center).total_seconds())
        if min_dist is None or dist < min_dist:
            min_dist = dist
            candidate = (LatLng(lat=cp["lat"], lng=cp["lng"]), eta)
    return candidate


# ----------------------------
# Endpoint
# ----------------------------

from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# helper: check if ETA falls inside or near a meal window
def eta_matches_window(eta: datetime, window, tolerance_minutes: int = 30) -> bool:
    start_w = datetime.combine(eta.date(), datetime.strptime(window["start"], "%H:%M").time())
    end_w = datetime.combine(eta.date(), datetime.strptime(window["end"], "%H:%M").time())

    # add tolerance
    start_w -= timedelta(minutes=tolerance_minutes)
    end_w += timedelta(minutes=tolerance_minutes)

    return start_w <= eta <= end_w


# helper: filter meals dynamically based on trip duration
def filter_meal_windows(meal_windows, departure: datetime, arrival: datetime):
    valid = {}
    for meal, window in meal_windows.items():
        start_w = datetime.combine(departure.date(), datetime.strptime(window["start"], "%H:%M").time())
        end_w = datetime.combine(departure.date(), datetime.strptime(window["end"], "%H:%M").time())

        # only include meals if window falls inside trip timeframe
        if departure <= end_w <= arrival:
            valid[meal] = window
    return valid

# --- Insert/replace these helpers & endpoint in your main.py ---

# Replace existing compute_detour_osrm with this implementation

import asyncio
from functools import lru_cache

OSRM_TABLE_URL = OSRM_BASE_URL + "/table/v1/driving/"

async def _osrm_table_request(coords: str, retries: int = 2, backoff: float = 0.5, timeout: int = 15):
    """
    Low-level helper to call OSRM table endpoint with retries.
    coords: semicolon-separated "lon,lat;lon,lat;..."
    returns parsed JSON or raises.
    """
    params = {"annotations": "duration"}  # we only need durations
    url = OSRM_TABLE_URL + coords
    attempt = 0
    while True:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.get(url, params=params)
                r.raise_for_status()
                payload = r.json()
                return payload
        except Exception as e:
            attempt += 1
            if attempt > retries:
                # raise the exception to caller to handle/log
                raise
            await asyncio.sleep(backoff * attempt)


def _coords_for_table(*points: LatLng) -> str:
    """
    Build semicolon-separated lon,lat string for OSRM table.
    """
    return ";".join(f"{p.lng},{p.lat}" for p in points)


@lru_cache(maxsize=256)
def _cached_base_duration_key(orig_lat, orig_lng, dest_lat, dest_lng):
    # small helper to create cache key for base duration; we will store base seconds in memory
    return f"{orig_lat:.6f}_{orig_lng:.6f}_{dest_lat:.6f}_{dest_lng:.6f}"


async def compute_detour_osrm(origin: LatLng, destination: LatLng, via: LatLng) -> Optional[int]:
    """
    Efficient detour calculation using OSRM Table API:
      - ask for durations for points [origin, via, destination]
      - durations matrix gives pairwise durations. We'll compute:
          detour_seconds = origin->via + via->destination - origin->destination
      - returns ceil(detour_seconds/60) or None on failure
    Caches the base origin->destination duration in-memory to avoid repeated table calls.
    """
    try:
        # 1) Try to use cached base duration to avoid repeating origin->destination query
        cache_key = _cached_base_duration_key(origin.lat, origin.lng, destination.lat, destination.lng)
        base_seconds = getattr(compute_detour_osrm, "_base_cache", {}).get(cache_key)
        
        # If cache not present, fetch full table for [origin, destination] (2 points) or we'll get it as part of 3-point table below
        coords3 = _coords_for_table(origin, via, destination)
        payload = await _osrm_table_request(coords3)
        durations = payload.get("durations")  # durations is a square matrix (3x3)
        if not durations:
            raise ValueError("OSRM table returned no durations")

        # durations matrix indices: 0=origin,1=via,2=destination
        # origin->destination:
        od_seconds = durations[0][2]
        ov_seconds = durations[0][1]
        vd_seconds = durations[1][2]

        # store base_seconds in cache if not already
        if base_seconds is None:
            base_seconds = od_seconds
            if not hasattr(compute_detour_osrm, "_base_cache"):
                compute_detour_osrm._base_cache = {}
            compute_detour_osrm._base_cache[cache_key] = base_seconds

        # calculate detour: origin->via + via->destination - origin->destination
        extra_sec = max(0, int((ov_seconds or 0) + (vd_seconds or 0) - (od_seconds or 0)))
        detour_min = math.ceil(extra_sec / 60.0)
        logger.debug(f"[OSRM-table] base={od_seconds}s ov={ov_seconds}s vd={vd_seconds}s extra={extra_sec}s -> {detour_min}min")
        return int(detour_min)
    except Exception as e:
        # Log full exception so we see why earlier logs were empty
        logger.warning(f"compute_detour_osrm (table) failed: {repr(e)}")
        # fallback: estimate via straight-line heuristic
        try:
            est = estimate_detour_heuristic(origin, destination, via)
            logger.info(f"Using heuristic detour estimate: {est} minutes")
            return est
        except Exception as e2:
            logger.warning(f"heuristic detour estimate failed too: {repr(e2)}")
            return None


def estimate_detour_heuristic(origin: LatLng, destination: LatLng, via: LatLng, avg_speed_kmph: float = 40.0) -> int:
    """
    Quick fallback: compute extra time by:
      extra_distance_km = dist(origin,via) + dist(via,dest) - dist(origin,dest)
      detour_minutes = ceil((extra_distance_km / avg_speed_kmph) * 60)
    Uses Haversine distance.
    """
    def haversine_km(a: LatLng, b: LatLng) -> float:
        import math
        R = 6371.0
        lat1 = math.radians(a.lat); lon1 = math.radians(a.lng)
        lat2 = math.radians(b.lat); lon2 = math.radians(b.lng)
        dlat = lat2 - lat1; dlon = lon2 - lon1
        x = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(x), math.sqrt(1 - x))
        return R * c

    od = haversine_km(origin, destination)
    ov = haversine_km(origin, via)
    vd = haversine_km(via, destination)
    extra_km = max(0.0, (ov + vd) - od)
    detour_minutes = math.ceil((extra_km / avg_speed_kmph) * 60.0)
    logger.debug(f"heuristic: od={od:.2f}km ov={ov:.2f}km vd={vd:.2f}km extra={extra_km:.2f}km -> {detour_minutes}min")
    return int(detour_minutes)



def score_place_overpass(place: Dict, detour_minutes: int, veg_pref: str, max_detour: int) -> float:
    """
    Heuristic scoring for Overpass places:
    - boosts if place tag/cuisine/name suggests vegetarian (for veg_pref)
    - penalizes detour linearly
    - uses presence of 'rating' tag if present (rare)
    """
    tags = place.get("tags", {}) or {}
    name = (tags.get("name") or "").lower()
    cuisine = (tags.get("cuisine") or "").lower()
    rating_tag = tags.get("rating")
    rating = float(rating_tag) if rating_tag and rating_tag.replace(".", "", 1).isdigit() else None

    # veg score
    veg_score = 0.0
    if veg_pref == "veg":
        # strong boost if cuisine or name contains vegetarian cues
        if any(k in cuisine for k in ("vegetarian", "veg", "pure_veg", "south_indian", "north_indian")):
            veg_score += 2.0
        if any(k in name for k in ("veg", "vegetarian", "pure veg")):
            veg_score += 1.5

    # base quality (use rating if exists, else default)
    base_quality = rating if rating is not None else 3.0

    # detour penalty: scale to 0..5
    detour_penalty = (detour_minutes / max(1, max_detour)) * 5.0
    # final score
    score = base_quality + veg_score - detour_penalty

    # small tie-breaker using number of tags (more tags -> possibly richer info)
    tag_count = len(tags)
    score += min(tag_count, 3) * 0.05

    logger.debug(f"score_place: {place.get('name')} rating={rating} veg_score={veg_score} detour={detour_minutes} penalty={detour_penalty:.2f} final={score:.2f}")
    return score


@app.post("/trips/create", response_model=TripResponse)
async def create_trip(tr: TripRequest):
    """
    Full flow (patched):
      - baseline OSRM route
      - estimate departure (preferred_arrival - travel - meal times)
      - only consider meal windows that intersect trip timeframe
      - for each considered meal: find point, Overpass search (with radius fallback), filter, compute detours, rank top5
      - recompute departure including chosen detours
    """
    try:
        logger.info("=== create_trip invoked (OSRM + Overpass) ===")
        # Parse preferred arrival
        try:
            preferred_arrival = dateparser.isoparse(tr.preferred_reach_time)
        except Exception as e:
            logger.error(f"Invalid preferred_reach_time: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid preferred_reach_time: {e}")

        # 1) Baseline OSRM route
        logger.info("Fetching baseline OSRM route (no meal detours)...")
        route = await call_osrm_route(tr.source, tr.destination, tr.stops or [])
        route_seconds = int(route.get("duration", 0))
        route_distance = float(route.get("distance", 0))
        logger.info(f"Baseline route: duration={route_seconds}s distance={route_distance}m")

        # 2) Estimate departure accounting for meal durations (initial estimate)
        meal_count = len(tr.mealWindows)
        total_meal_time_sec = meal_count * tr.meal_duration_min * 60
        estimated_total_seconds = route_seconds + total_meal_time_sec
        latest_start_dt = preferred_arrival - timedelta(seconds=estimated_total_seconds)

        # produce a recommended window ±15 minutes
        window_margin = timedelta(minutes=15)
        recommended_window = [
            (latest_start_dt - window_margin).isoformat(),
            (latest_start_dt + window_margin).isoformat()
        ]

        # compute trip timeframe from this initial departure
        trip_departure_dt = latest_start_dt
        trip_estimated_arrival_dt = trip_departure_dt + timedelta(seconds=(route_seconds + total_meal_time_sec))

        logger.info(f"Initial trip window: depart={trip_departure_dt.isoformat()} arrive~={trip_estimated_arrival_dt.isoformat()}")

        # prepare checkpoints for fine-grained ETA mapping
        checkpoints = extract_checkpoints(route)
        logger.info(f"Extracted {len(checkpoints)} checkpoints from baseline route")

        # helper: check if a meal window (time-of-day) intersects the trip timeframe
        def meal_window_intersects_trip(window: TimeWindow, depart_dt: datetime, arrive_dt: datetime) -> bool:
            # build absolute datetimes for window using departure date as reference
            w_start = depart_dt.replace(hour=int(window.start.split(":")[0]), minute=int(window.start.split(":")[1]), second=0, microsecond=0)
            w_end = depart_dt.replace(hour=int(window.end.split(":")[0]), minute=int(window.end.split(":")[1]), second=0, microsecond=0)
            if w_end <= w_start:
                w_end += timedelta(days=1)  # crosses midnight
            # check overlap
            latest_start = max(depart_dt, w_start)
            earliest_end = min(arrive_dt, w_end)
            return latest_start <= earliest_end

        # helper: ETAs within tolerance (minutes)
        def eta_within_tolerance(eta: datetime, window: TimeWindow, tol_min: int = 30) -> bool:
            w_start = eta.replace(hour=int(window.start.split(":")[0]), minute=int(window.start.split(":")[1]), second=0, microsecond=0)
            w_end = eta.replace(hour=int(window.end.split(":")[0]), minute=int(window.end.split(":")[1]), second=0, microsecond=0)
            if w_end <= w_start:
                w_end += timedelta(days=1)
            w_start -= timedelta(minutes=tol_min)
            w_end += timedelta(minutes=tol_min)
            return w_start <= eta <= w_end

        # build set of meal windows to actually consider: only those that intersect the trip
        considered_meals = {}
        for meal_name, tw in tr.mealWindows.items():
            if meal_window_intersects_trip(tw, trip_departure_dt, trip_estimated_arrival_dt):
                considered_meals[meal_name] = tw
            else:
                logger.info(f"Skipping meal '{meal_name}' because its window does not intersect the trip timeframe")

        logger.info(f"Considering meals: {list(considered_meals.keys())}")

        # 3) Process each considered meal window
        meal_suggestions: Dict[str, List[PlaceSuggestion]] = {}
        base_route_seconds = route_seconds  # keep baseline for detour calc

        for meal_name, tw in considered_meals.items():
            logger.info(f"Processing meal window '{meal_name}' => {tw.start} - {tw.end}")

            # parse window times (HH:MM)
            try:
                s_h, s_m = [int(x) for x in tw.start.split(":")]
                e_h, e_m = [int(x) for x in tw.end.split(":")]
            except Exception as e:
                logger.error(f"Invalid meal window format for {meal_name}: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid meal window for {meal_name}: {e}")

            window_start = dtime(hour=s_h, minute=s_m)
            window_end = dtime(hour=e_h, minute=e_m)

            # find the checkpoint that matches the meal window (or nearest)
            found = find_point_for_window(checkpoints, trip_departure_dt, window_start, window_end)
            if not found:
                logger.warning(f"No checkpoint found near window for {meal_name}; returning empty suggestions")
                meal_suggestions[meal_name] = []
                continue

            point, eta_dt = found
            logger.info(f"Meal '{meal_name}' ETA approx: {eta_dt.isoformat()} at {point.lat},{point.lng}")

            # if ETA is outside the window +/- tolerance, skip (tolerance 30 minutes)
            if not eta_within_tolerance(eta_dt, tw, tol_min=30):
                logger.info(f"ETA {eta_dt.isoformat()} for meal '{meal_name}' is outside window +/-30min; skipping")
                meal_suggestions[meal_name] = []
                continue

            # 4) Query Overpass for restaurants around that point, with fallback radii
            search_radii = [3000, 7000, 15000]  # meters: try 3km, 7km, 15km
            overpass_places = []
            for r in search_radii:
                overpass_places = await search_places(point.lat, point.lng, radius=r, query="restaurant")
                logger.info(f"Overpass returned {len(overpass_places)} raw places for {meal_name} at radius={r}m")
                if overpass_places:
                    break
                logger.info(f"No results at radius={r}m for {meal_name}, expanding radius")

            if not overpass_places:
                logger.warning(f"No places found for {meal_name} even after increasing radius; leaving suggestions empty")
                meal_suggestions[meal_name] = []
                continue

            # 5) Filter by veg_pref conservatively
            filtered = []
            for p in overpass_places:
                tags = p.get("tags", {}) or {}
                cuisine = (tags.get("cuisine") or "").lower()
                name = (p.get("name") or "").lower()

                if tr.veg_pref == "veg":
                    if not (any(k in cuisine for k in ("vegetarian", "veg", "pure_veg")) or any(k in name for k in ("veg", "vegetarian", "pure veg"))):
                        # skip non-obvious vegetarian places
                        continue
                filtered.append(p)
            logger.info(f"{len(filtered)} places remain after veg filter for {meal_name}")

            # 6) Compute detour for top-N candidates from Overpass (limit to 12)
            candidates = []
            candidates_pool = filtered[:12] if filtered else overpass_places[:12]
            # limit concurrency slightly: process sequentially to avoid overloading OSRM public server
            for p in candidates_pool:
                pl_lat = p.get("lat") or p.get("center", {}).get("lat")
                pl_lon = p.get("lon") or p.get("center", {}).get("lon")
                if pl_lat is None or pl_lon is None:
                    continue
                via = LatLng(lat=float(pl_lat), lng=float(pl_lon))

                detour_min = await compute_detour_osrm(tr.source, tr.destination, via)
                if detour_min is None:
                    logger.debug(f"Skipping {p.get('name')} due to detour calc failure")
                    continue
                if detour_min > tr.max_detour_minutes:
                    logger.debug(f"Skipping {p.get('name')}: detour {detour_min} > max {tr.max_detour_minutes}")
                    continue

                score = score_place_overpass(p, detour_min, tr.veg_pref, tr.max_detour_minutes)
                candidates.append((score, p, detour_min))

            # 7) Rank & select top 5
            candidates.sort(key=lambda x: x[0], reverse=True)
            logger.info(f"{len(candidates)} candidate(s) scored for {meal_name}")
            top5 = candidates[:5]

            suggestions = []
            for score, p, detour in top5:
                pl_lat = p.get("lat") or p.get("center", {}).get("lat")
                pl_lon = p.get("lon") or p.get("center", {}).get("lon")
                if pl_lat is None or pl_lon is None:
                    continue
                eta_with_detour = eta_dt + timedelta(minutes=detour)
                suggestion = PlaceSuggestion(
                    osm_id=str(p.get("osm_id") or p.get("id")),
                    name=p.get("name") or p.get("tags", {}).get("name", "Unknown"),
                    location=LatLng(lat=float(pl_lat), lng=float(pl_lon)),
                    detour_minutes=int(detour),
                    eta_iso=eta_with_detour.isoformat(),
                    tags=p.get("tags", {})
                )
                suggestions.append(suggestion)
                logger.info(f"Selected suggestion: {suggestion.name} detour={detour} min score={score:.2f}")

            meal_suggestions[meal_name] = suggestions

        # 8) Recompute departure time considering top-choices' detours
        added_detour_seconds = 0
        for meal_name, suglist in meal_suggestions.items():
            if suglist:
                added_detour_seconds += suglist[0].detour_minutes * 60

        total_seconds_with_detours = route_seconds + total_meal_time_sec + added_detour_seconds
        latest_start_dt_final = preferred_arrival - timedelta(seconds=total_seconds_with_detours)
        recommended_window_final = [
            (latest_start_dt_final - window_margin).isoformat(),
            (latest_start_dt_final + window_margin).isoformat()
        ]
        logger.info(f"Final departure time: {latest_start_dt_final.isoformat()} (window +/-15m)")

        # Build route summary
        route_summary = RouteSummary(
            total_distance_km=route_distance / 1000.0,
            total_duration_min=route_seconds / 60.0,
            stops=[f"{s.lat},{s.lng}" for s in (tr.stops or [])],
            geometry=[]     #route.get("geometry", {}).get("coordinates", [])
        )

        trip_id = "trip_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response = TripResponse(
            trip_id=trip_id,
            recommended_departure_iso=latest_start_dt_final.isoformat(),
            recommended_departure_window=recommended_window_final,
            route_summary=route_summary,
            meal_suggestions=meal_suggestions
        )
        logger.info(f"Trip {trip_id} created successfully")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"create_trip error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    uvicorn.run("main_osrm:app", host="0.0.0.0", port=8000, reload=True)
