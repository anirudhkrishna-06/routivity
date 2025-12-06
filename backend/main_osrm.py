import os
import math
import logging
from datetime import datetime, timedelta, time as dtime
from typing import List, Optional, Tuple, Dict, Any
import json

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dateutil import parser as dateparser
import uvicorn
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Client as FirestoreClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("routivity.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

logger.info("Starting Routivity Trip Planner Backend MVP (OSRM + Overpass + Firebase)")

# Initialize Firebase Admin
db = None
try:
    if not firebase_admin._apps:
        # For production, use environment variables or service account file
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        else:
            # For development with environment variables
            firebase_admin.initialize_app()
    
    db = firestore.client()
    logger.info("Firebase Admin initialized successfully")
except Exception as e:
    logger.warning(f"Firebase Admin initialization failed: {e}. Some features may not work.")
    db = None

app = FastAPI(title="Routivity — Trip Planner Backend MVP")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Enhanced Models
# ----------------------------
class LatLng(BaseModel):
    lat: float
    lng: float

class TimeWindow(BaseModel):
    start: str
    end: str

class UserPreferences(BaseModel):
    foodPreference: str = "any"
    budget: str = "moderate"
    pace: str = "balanced"
    mood: str = "adventure"
    companions: str = "solo"
    activities: List[str] = []
    accessibility: str = "none"

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
    user_id: Optional[str] = None  # Add user_id to fetch preferences

class PlaceSuggestion(BaseModel):
    osm_id: str
    name: str
    location: LatLng
    detour_minutes: int
    eta_iso: str
    tags: Dict[str, Any] = {}
    personalization_score: float = 0.0
    match_reasons: List[str] = []

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
    personalization_used: bool = False

class FinalizeTripRequest(BaseModel):
    trip_id: str
    selected_meals: Dict[str, str]  # meal_name -> osm_id
    user_id: str


# ----------------------------
# Firebase Helper Functions
# ----------------------------
async def get_user_preferences(user_id: str) -> Optional[UserPreferences]:
    """Fetch user preferences from Firebase"""
    if not db:
        logger.warning("Firebase not initialized, cannot fetch user preferences")
        return None
    
    try:
        doc_ref = db.collection("preferences").document(user_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            logger.info(f"Retrieved preferences for user {user_id}: {data}")
            
            return UserPreferences(
                foodPreference=data.get("foodPreference", "any"),
                budget=data.get("budget", "moderate"),
                pace=data.get("pace", "balanced"),
                mood=data.get("mood", "adventure"),
                companions=data.get("companions", "solo"),
                activities=data.get("activities", []),
                accessibility=data.get("accessibility", "none")
            )
        else:
            logger.warning(f"No preferences found for user {user_id}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching user preferences: {e}")
        return None


async def save_user_preferences(user_id: str, prefs: UserPreferences) -> bool:
    """Save user preferences to Firebase"""
    if not db:
        logger.warning("Firebase not initialized, cannot save user preferences")
        return False

    try:
        doc_ref = db.collection("preferences").document(user_id)
        doc_ref.set(prefs.dict())
        logger.info(f"Saved preferences for user {user_id}: {prefs.dict()}")
        return True
    except Exception as e:
        logger.error(f"Error saving user preferences: {e}")
        return False

async def save_trip_to_firebase(trip_data: Dict[str, Any]) -> str:
    """Save trip data to Firebase and return trip ID"""
    if not db:
        logger.warning("Firebase not initialized, cannot save trip")
        return "local_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")
    
    try:
        trip_id = f"trip_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{hash(str(trip_data)) % 10000:04d}"
        
        trip_data["trip_id"] = trip_id
        trip_data["created_at"] = firestore.SERVER_TIMESTAMP
        trip_data["status"] = "planned"  # planned, active, completed
        
        doc_ref = db.collection("trips").document(trip_id)
        doc_ref.set(trip_data)
        
        logger.info(f"Trip saved to Firebase with ID: {trip_id}")
        return trip_id
        
    except Exception as e:
        logger.error(f"Error saving trip to Firebase: {e}")
        return "local_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")

# ----------------------------
# Enhanced Personalization Scoring
# ----------------------------
def calculate_personalization_score(place: Dict, user_prefs: UserPreferences, detour_minutes: int, max_detour: int) -> Tuple[float, List[str]]:
    """
    Calculate personalized score based on user preferences
    Returns: (score, match_reasons)
    """
    tags = place.get("tags", {}) or {}
    name = (tags.get("name") or "").lower()
    cuisine = (tags.get("cuisine") or "").lower()
    
    score = 0.0
    match_reasons = []
    
    # 1. Food Preference Matching (Highest Priority)
    if user_prefs.foodPreference.lower() == "vegetarian":
        veg_indicators = ["vegetarian", "veg", "pure_veg", "pure veg", "plant-based"]
        if any(indicator in cuisine for indicator in veg_indicators):
            score += 3.0
            match_reasons.append("Vegetarian-friendly")
        elif any(indicator in name for indicator in veg_indicators):
            score += 2.5
            match_reasons.append("Vegetarian in name")
        else:
            # Penalty for non-vegetarian places when user prefers veg
            score -= 2.0
    
    # 2. Budget Matching
    price_level = tags.get("price_level")
    if price_level and user_prefs.budget:
        budget_mapping = {
            "budget": {"1": 2.0, "2": 1.0, "3": -1.0, "4": -2.0},
            "moderate": {"1": 0.5, "2": 2.0, "3": 1.5, "4": -1.0},
            "luxury": {"1": -1.0, "2": 0.5, "3": 2.0, "4": 3.0}
        }
        if user_prefs.budget.lower() in budget_mapping:
            budget_score = budget_mapping[user_prefs.budget.lower()].get(str(price_level), 0)
            score += budget_score
            if budget_score > 0:
                match_reasons.append(f"Matches {user_prefs.budget} budget")
    
    # 3. Mood/Activity Based Matching
    activity_keywords = {
        "relax": ["cafe", "bakery", "tea", "coffee", "dessert"],
        "adventure": ["local", "traditional", "street", "authentic"],
        "social": ["bar", "pub", "brewery", "tapas"],
        "family": ["family", "kids", "child", "friendly"]
    }
    
    if user_prefs.mood.lower() in activity_keywords:
        for keyword in activity_keywords[user_prefs.mood.lower()]:
            if keyword in name or keyword in cuisine:
                score += 1.5
                match_reasons.append(f"Great for {user_prefs.mood} mood")
                break
    
    # 4. Cuisine Preference from Activities
    activity_cuisine_map = {
        "trekking": ["local", "traditional", "hearty", "comfort"],
        "heritage": ["traditional", "local", "authentic", "cultural"],
        "photography": ["cafe", "aesthetic", "view", "rooftop"],
        "wellness": ["healthy", "organic", "salad", "juice", "smoothie"]
    }
    
    for activity in user_prefs.activities:
        if activity.lower() in activity_cuisine_map:
            for keyword in activity_cuisine_map[activity.lower()]:
                if keyword in name or keyword in cuisine:
                    score += 1.0
                    match_reasons.append(f"Matches {activity} interest")
                    break
    
    # 5. Rating Boost
    rating_tag = tags.get("rating")
    if rating_tag:
        try:
            rating = float(rating_tag)
            score += (rating - 3.0) * 0.5  # Boost for ratings above 3.0
        except (ValueError, TypeError):
            pass
    
    # 6. Detour Penalty (Adaptive based on pace preference)
    pace_penalty_multiplier = {
        "relaxed": 0.7,
        "balanced": 1.0,
        "fast": 1.3
    }
    penalty_multiplier = pace_penalty_multiplier.get(user_prefs.pace.lower(), 1.0)
    detour_penalty = (detour_minutes / max(1, max_detour)) * 5.0 * penalty_multiplier
    score -= detour_penalty
    
    # 7. Accessibility Considerations
    if user_prefs.accessibility.lower() != "none":
        wheelchair = tags.get("wheelchair")
        if wheelchair == "yes":
            score += 1.0
            match_reasons.append("Accessibility friendly")
    
    # Ensure minimum score
    score = max(score, 0.1)
    
    logger.debug(f"Personalization score for {place.get('name')}: {score:.2f}, reasons: {match_reasons}")
    return score, match_reasons


# ----------------------------
# User Preferences endpoints
# ----------------------------


@app.get("/users/{user_id}/preferences", response_model=UserPreferences)
async def api_get_user_preferences(user_id: str):
    prefs = await get_user_preferences(user_id)
    if prefs is None:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return prefs


@app.put("/users/{user_id}/preferences", response_model=UserPreferences)
async def api_put_user_preferences(user_id: str, prefs: UserPreferences):
    ok = await save_user_preferences(user_id, prefs)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save preferences")
    return prefs

# ----------------------------
# Enhanced Place Scoring (Integrates Personalization)
# ----------------------------
def score_place_enhanced(place: Dict, detour_minutes: int, user_prefs: UserPreferences, max_detour: int) -> Tuple[float, List[str]]:
    """
    Enhanced scoring that combines personalization with basic factors
    """
    # Get personalization score
    personalization_score, match_reasons = calculate_personalization_score(
        place, user_prefs, detour_minutes, max_detour
    )
    
    # Base quality factors
    tags = place.get("tags", {}) or {}
    rating_tag = tags.get("rating")
    base_quality = 3.0
    
    if rating_tag:
        try:
            base_quality = float(rating_tag)
        except (ValueError, TypeError):
            pass
    
    # Combine scores (weighted)
    final_score = (personalization_score * 0.7) + (base_quality * 0.3)
    
    # Small boost for places with more information
    tag_count = len(tags)
    final_score += min(tag_count, 5) * 0.1
    
    return final_score, match_reasons


# ----------------------------
# OSRM ROUTING
# ----------------------------
OSRM_BASE_URL = "http://router.project-osrm.org"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

async def call_osrm_route(origin: LatLng, destination: LatLng, waypoints: Optional[List[LatLng]] = None) -> Dict:
    # ... (keep existing implementation exactly as is)
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


async def search_places(lat: float, lon: float, radius: int = 2000, query: str = "restaurant") -> List[Dict]:
    # ... (keep existing implementation exactly as is)
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
    # ... (keep existing implementation exactly as is)
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
    # ... (keep existing implementation exactly as is)
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
    # ... (keep existing implementation exactly as is)
    try:
        cache_key = f"{origin.lat:.6f}_{origin.lng:.6f}_{destination.lat:.6f}_{destination.lng:.6f}"
        base_seconds = getattr(compute_detour_osrm, "_base_cache", {}).get(cache_key)
        
        coords3 = f"{origin.lng},{origin.lat};{via.lng},{via.lat};{destination.lng},{destination.lat}"
        url = f"{OSRM_BASE_URL}/table/v1/driving/{coords3}"
        params = {"annotations": "duration"}
        
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            payload = r.json()
        
        durations = payload.get("durations")
        # Defensive checks: ensure durations is a 2xN matrix with expected indices
        if (
            not durations
            or not isinstance(durations, list)
            or len(durations) < 2
            or not all(isinstance(r, list) for r in durations)
            or len(durations[0]) < 3
            or len(durations[1]) < 3
        ):
            logger.warning("compute_detour_osrm: OSRM table returned unexpected 'durations' format: %s", repr(durations))
            return None

        od_seconds = durations[0][2]
        ov_seconds = durations[0][1]
        vd_seconds = durations[1][2]

        if base_seconds is None:
            base_seconds = od_seconds
            if not hasattr(compute_detour_osrm, "_base_cache"):
                compute_detour_osrm._base_cache = {}
            compute_detour_osrm._base_cache[cache_key] = base_seconds

        extra_sec = max(0, int((ov_seconds or 0) + (vd_seconds or 0) - (od_seconds or 0)))
        detour_min = math.ceil(extra_sec / 60.0)
        return int(detour_min)
    except Exception as e:
        logger.warning(f"compute_detour_osrm failed: {e}")
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
    Enhanced trip creation with user preference integration
    """
    try:
        logger.info("=== ENHANCED create_trip with personalization ===")
        
        # 1. Fetch user preferences if user_id provided
        user_prefs = None
        personalization_used = False
        
        if tr.user_id:
            user_prefs = await get_user_preferences(tr.user_id)
            if user_prefs:
                personalization_used = True
                logger.info(f"Using personalization for user {tr.user_id}: {user_prefs}")
                # Override veg_pref from user preferences if not explicitly set
                if tr.veg_pref == "any" and user_prefs.foodPreference.lower() == "vegetarian":
                    tr.veg_pref = "veg"
            else:
                logger.info(f"No preferences found for user {tr.user_id}, using request parameters")
        else:
            logger.info("No user_id provided, using request parameters only")

        # 2. Parse preferred arrival
        try:
            preferred_arrival = dateparser.isoparse(tr.preferred_reach_time)
            # Interpret preferred_reach_time in the *user's local clock*.
            # The client sends an ISO string (usually in UTC, via toISOString),
            # but meal windows (e.g. "12:00"-"14:00" for lunch) are in local time.
            # Convert to local timezone and drop tzinfo so meal window checks
            # use consistent local wall-clock times.
            if preferred_arrival.tzinfo is not None:
                preferred_arrival = preferred_arrival.astimezone().replace(tzinfo=None)
        except Exception as e:
            logger.error(f"Invalid preferred_reach_time: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid preferred_reach_time: {e}")

        # 3. Baseline OSRM route (existing logic)
        logger.info("Fetching baseline OSRM route...")
        route = await call_osrm_route(tr.source, tr.destination, tr.stops or [])
        route_seconds = int(route.get("duration", 0))
        route_distance = float(route.get("distance", 0))
        logger.info(f"Baseline route: duration={route_seconds}s distance={route_distance}m")

        # 4. Estimate departure (existing logic)
        meal_count = len(tr.mealWindows)
        total_meal_time_sec = meal_count * tr.meal_duration_min * 60
        estimated_total_seconds = route_seconds + total_meal_time_sec
        latest_start_dt = preferred_arrival - timedelta(seconds=estimated_total_seconds)

        window_margin = timedelta(minutes=15)
        recommended_window = [
            (latest_start_dt - window_margin).isoformat(),
            (latest_start_dt + window_margin).isoformat()
        ]

        trip_departure_dt = latest_start_dt
        trip_estimated_arrival_dt = trip_departure_dt + timedelta(seconds=(route_seconds + total_meal_time_sec))

        logger.info(f"Initial trip window: depart={trip_departure_dt.isoformat()}")

        # 5. Prepare checkpoints (existing logic)
        checkpoints = extract_checkpoints(route)
        logger.info(f"Extracted {len(checkpoints)} checkpoints from baseline route")

        # 6. Filter meal windows that intersect trip (existing logic)
        def meal_window_intersects_trip(window: TimeWindow, depart_dt: datetime, arrive_dt: datetime) -> bool:
            s_h, s_m = [int(x) for x in window.start.split(":")]
            e_h, e_m = [int(x) for x in window.end.split(":")]
            w_start = depart_dt.replace(hour=s_h, minute=s_m, second=0, microsecond=0)
            w_end = depart_dt.replace(hour=e_h, minute=e_m, second=0, microsecond=0)
            if w_end <= w_start:
                w_end += timedelta(days=1)
            latest_start = max(depart_dt, w_start)
            earliest_end = min(arrive_dt, w_end)
            return latest_start <= earliest_end

        considered_meals = {}
        for meal_name, tw in tr.mealWindows.items():
            if meal_window_intersects_trip(tw, trip_departure_dt, trip_estimated_arrival_dt):
                considered_meals[meal_name] = tw
            else:
                logger.info(f"Skipping meal '{meal_name}' - window doesn't intersect trip")

        logger.info(f"Considering meals: {list(considered_meals.keys())}")

        # 7. Process each considered meal window with ENHANCED scoring
        meal_suggestions: Dict[str, List[PlaceSuggestion]] = {}

        for meal_name, tw in considered_meals.items():
            logger.info(f"Processing meal '{meal_name}' with personalization")

            # Parse window times
            try:
                s_h, s_m = [int(x) for x in tw.start.split(":")]
                e_h, e_m = [int(x) for x in tw.end.split(":")]
            except Exception as e:
                logger.error(f"Invalid meal window format for {meal_name}: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid meal window for {meal_name}: {e}")

            window_start = dtime(hour=s_h, minute=s_m)
            window_end = dtime(hour=e_h, minute=e_m)

            # Find checkpoint for meal window
            found = find_point_for_window(checkpoints, trip_departure_dt, window_start, window_end)
            if not found:
                logger.warning(f"No checkpoint found for {meal_name}")
                meal_suggestions[meal_name] = []
                continue

            point, eta_dt = found
            logger.info(f"Meal '{meal_name}' ETA: {eta_dt.isoformat()} at {point.lat},{point.lng}")

            # Query Overpass with fallback radii
            search_radii = [3000, 7000, 15000]
            overpass_places = []
            for r in search_radii:
                overpass_places = await search_places(point.lat, point.lng, radius=r, query="restaurant")
                logger.info(f"Overpass returned {len(overpass_places)} places for {meal_name} at radius={r}m")
                for i, place in enumerate(overpass_places[:5]):  # Log first 5 places
                    logger.debug(f"Place {i+1}: {place.get('name')} - Cuisine: {place.get('tags', {}).get('cuisine', 'unknown')}")
                if overpass_places:
                    break

            if not overpass_places:
                logger.warning(f"No places found for {meal_name}")
                meal_suggestions[meal_name] = []
                continue

            filtered = []
            for p in overpass_places:
                tags = p.get("tags", {}) or {}
                cuisine = (tags.get("cuisine") or "").lower()
                name = (p.get("name") or "").lower()

                # Check if we need vegetarian filtering
                needs_veg_filter = (
                    (user_prefs and user_prefs.foodPreference.lower() == "vegetarian") 
                    or tr.veg_pref == "veg"
                )
                
                if needs_veg_filter:
                    # SMART VEGETARIAN FILTERING - More inclusive
                    veg_indicators = [
                        "vegetarian", "veg", "pure_veg", "pure veg", "plant-based",
                        "south indian", "north indian", "indian"  # Many Indian restaurants are veg-friendly
                    ]
                    
                    non_veg_indicators = [
                        "non-veg", "non veg", "chicken", "mutton", "fish", "seafood", 
                        "meat", "bbq", "barbecue", "steak", "pork", "beef"
                    ]
                    
                    # Check for positive vegetarian indicators
                    has_veg_indicator = any(indicator in cuisine for indicator in veg_indicators) or \
                                    any(indicator in name for indicator in veg_indicators)
                    
                    # Check for explicit non-vegetarian indicators
                    has_non_veg_indicator = any(indicator in cuisine for indicator in non_veg_indicators) or \
                                        any(indicator in name for indicator in non_veg_indicators)
                    
                    # Include if: has veg indicators OR doesn't have explicit non-veg indicators
                    if has_veg_indicator or not has_non_veg_indicator:
                        filtered.append(p)
                    else:
                        logger.debug(f"Excluded non-veg place: {p.get('name')}")
                else:
                    # No vegetarian filter needed, include all places
                    filtered.append(p)

            logger.info(f"{len(filtered)} places after SMART preference filtering for {meal_name}")

            # Compute detours and ENHANCED scoring
            candidates = []
            candidates_pool = filtered[:12] if filtered else overpass_places[:12]
            
            for p in candidates_pool:
                pl_lat = p.get("lat") or p.get("center", {}).get("lat")
                pl_lon = p.get("lon") or p.get("center", {}).get("lon")
                if pl_lat is None or pl_lon is None:
                    continue
                via = LatLng(lat=float(pl_lat), lng=float(pl_lon))

                detour_min = await compute_detour_osrm(tr.source, tr.destination, via)
                if detour_min is None or detour_min > tr.max_detour_minutes:
                    continue

                # ENHANCED: Use personalized scoring
                if user_prefs:
                    score, match_reasons = score_place_enhanced(p, detour_min, user_prefs, tr.max_detour_minutes)
                else:
                    # Fallback to basic scoring
                    score = 3.0  # Default base score
                    match_reasons = ["Standard suggestion"]

                candidates.append((score, p, detour_min, match_reasons))

            # Rank by ENHANCED score
            candidates.sort(key=lambda x: x[0], reverse=True)
            logger.info(f"{len(candidates)} candidates scored for {meal_name}")

            # Create suggestions with personalization info
            suggestions = []
            for score, p, detour, match_reasons in candidates[:5]:  # Top 5
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
                    tags=p.get("tags", {}),
                    personalization_score=float(score),
                    match_reasons=match_reasons
                )
                suggestions.append(suggestion)
                logger.info(f"Selected: {suggestion.name} score={score:.2f} detour={detour}min")

            meal_suggestions[meal_name] = suggestions

        # 8. Recompute departure with detours (existing logic)
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

        # 9. Build response
        route_summary = RouteSummary(
            total_distance_km=route_distance / 1000.0,
            total_duration_min=route_seconds / 60.0,
            stops=[f"{s.lat},{s.lng}" for s in (tr.stops or [])],
            geometry=[]  # Could extract from route if needed
        )

        # Generate trip ID (will be replaced when saving to Firebase)
        trip_id = "temp_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")
        logger.info(f"DEBUG: Meal suggestions structure: {meal_suggestions}")
        for meal_name, suggestions in meal_suggestions.items():
            logger.info(f"DEBUG: {meal_name} has {len(suggestions)} suggestions")
            for i, suggestion in enumerate(suggestions):
                logger.info(f"DEBUG: Suggestion {i+1}: {suggestion}")


        response = TripResponse(
            trip_id=trip_id,
            recommended_departure_iso=latest_start_dt_final.isoformat(),
            recommended_departure_window=recommended_window_final,
            route_summary=route_summary,
            meal_suggestions=meal_suggestions,
            personalization_used=personalization_used
        )
        logger.info(f"DEBUG: Final response meal_suggestions: {response.meal_suggestions}")


        logger.info(f"Enhanced trip created successfully. Personalization: {personalization_used}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enhanced create_trip error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    
@app.post("/trips/finalize")
async def finalize_trip(ftr: FinalizeTripRequest):
    """
    Finalize trip with user-selected meals and save to Firebase
    """
    try:
        logger.info(f"Finalizing trip {ftr.trip_id} for user {ftr.user_id}")
        
        # In a real implementation, you would:
        # 1. Retrieve the original trip data
        # 2. Apply the selected meals
        # 3. Generate detailed itinerary
        # 4. Save to Firebase
        
        trip_data = {
            "user_id": ftr.user_id,
            "selected_meals": ftr.selected_meals,
            "finalized_at": datetime.utcnow().isoformat(),
            "status": "planned"
        }
        
        # Save to Firebase
        saved_trip_id = await save_trip_to_firebase(trip_data)
        
        return {
            "success": True,
            "trip_id": saved_trip_id,
            "message": "Trip finalized and saved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error finalizing trip: {e}")
        raise HTTPException(status_code=500, detail=f"Error finalizing trip: {str(e)}")

# ----------------------------
# NEW ENDPOINT: Get User Trips
# ----------------------------
@app.get("/users/{user_id}/trips")
async def get_user_trips(user_id: str):
    """Get all trips for a user"""
    if not db:
        return {"trips": [], "message": "Firebase not available"}
    
    try:
        trips_ref = db.collection("trips").where("user_id", "==", user_id)
        docs = trips_ref.stream()
        
        trips = []
        for doc in docs:
            trip_data = doc.to_dict()
            trip_data["id"] = doc.id
            trips.append(trip_data)
        
        return {"trips": trips}
        
    except Exception as e:
        logger.error(f"Error fetching user trips: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching trips: {str(e)}")

# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    uvicorn.run("main_osrm:app", host="0.0.0.0", port=8000, reload=True)
