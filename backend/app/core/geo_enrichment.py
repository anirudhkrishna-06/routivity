from app.models.trip import TripRequest
from app.services.google_places import google_places
import logging

logger = logging.getLogger(__name__)

async def enrich_locations(trip: TripRequest) -> TripRequest:
    """
    Iterates through the trip route (start point and stops) and ensures
    all locations have valid lat/lng coordinates and place_ids.
    """
    logger.info("Starting geo-enrichment for trip route.")

    # 1. Enrich Start Point
    start_point = trip.route.start
    if not start_point.lat or not start_point.lng:
        query = start_point.address or start_point.place_id
        if query:
            logger.info(f"Enriching start point: {query}")
            place = await google_places.search_place(query)
            if place:
                location = place.get("geometry", {}).get("location", {})
                start_point.lat = location.get("lat")
                start_point.lng = location.get("lng")
                start_point.place_id = place.get("place_id")
                start_point.address = place.get("formatted_address")
            else:
                logger.warning(f"Could not find start point: {query}")
        else:
             logger.warning("Start point has no address or place_id to geocode.")

    # 2. Enrich Stops
    prev_location = start_point
    
    from app.services.google_distance import google_distance
    from datetime import timedelta, datetime, time

    # Ensure start timestamp is naive and follows user local time preference
    # We use start_point.date and start_point.time (Local wall clock) instead of timestamp (UTC)
    try:
        prev_departure_time = datetime.combine(start_point.date, start_point.time)
    except Exception as e:
        logger.warning(f"Could not combine date/time, falling back to timestamp: {e}")
        prev_departure_time = start_point.timestamp
        if prev_departure_time.tzinfo is not None:
            prev_departure_time = prev_departure_time.replace(tzinfo=None)
            
    logger.info(f"Trip Start Time (Local): {prev_departure_time}")

    for i, stop in enumerate(trip.route.stops):
        if stop.selected_accommodation:
            # Use selected hotel as the precise stop location
            hotel = stop.selected_accommodation
            logger.info(f"Using selected accommodation for Stop {stop.stop_id}: {hotel.get('name')}")
            
            geo = hotel.get("geometry", {}).get("location", {})
            if geo:
                stop.lat = geo.get("lat")
                stop.lng = geo.get("lng")
                stop.place_id = hotel.get("place_id")
                # stop.name = hotel.get("name") # Keep original city name for context
                stop.address = hotel.get("formatted_address") or hotel.get("vicinity") or stop.address
        
        # If no accommodation selected, fallback to city search
        elif not stop.lat or not stop.lng:
            query = stop.name or stop.address or stop.place_id
            if query:
                logger.info(f"Enriching stop: {query}")
                place = await google_places.search_place(query)
                if place:
                    location = place.get("geometry", {}).get("location", {})
                    stop.lat = location.get("lat")
                    stop.lng = location.get("lng")
                    stop.place_id = place.get("place_id")
                    if not stop.address:
                        stop.address = place.get("formatted_address")
                else:
                    logger.warning(f"Could not find stop: {query}")
            else:
                logger.warning(f"Stop ID {stop.stop_id} has no searchable info.")

        # 3. Calculate Travel Time from Previous Location
        if prev_location.lat and prev_location.lng and stop.lat and stop.lng:
            origin = f"{prev_location.lat},{prev_location.lng}"
            dest = f"{stop.lat},{stop.lng}"

            logger.info(f"Calculating distance from {prev_location.address} ({origin}) to {stop.address} ({dest})")
            logger.info(f"Departing Previous at: {prev_departure_time}")
            matrix = await google_distance.get_distance_matrix(origins=[origin], destinations=[dest])
            
            if matrix and matrix.get("rows"):
                elements = matrix["rows"][0].get("elements", [])
                if elements and elements[0].get("status") == "OK":
                    duration_sec = elements[0]["duration"]["value"]
                    stop.travel_time_from_prev_sec = duration_sec
                    stop.arrival_time = prev_departure_time + timedelta(seconds=duration_sec)
                    
                    logger.info(f"Travel to Stop {i+1}: {duration_sec/3600:.1f} hours. Arrival: {stop.arrival_time}")
                else:
                     logger.warning(f"No route found between stops.")
            else:
                logger.warning(f"Distance matrix failed.")

        # Prepare for next leg
        # Assume departure is after 'nights' stay, leaving at default 9:00 AM?
        # For now, let's keep it simple: Arrival + Nights. 
        # But if 'nights' = 0 (day trip), we might leave same day.
        # Let's align departure to next morning 9:00 AM if nights > 0
        if stop.arrival_time:
            if stop.nights > 0:
                 # Departs after N nights, at 9:00 AM local time (approx)
                 departure_date = stop.arrival_time.date() + timedelta(days=stop.nights)
                 # Reconstruct timestamp at 9 AM
                 # Note: This ignores timezone, but acceptable for MVP
                 prev_departure_time = datetime.combine(departure_date, time(9, 0, 0))
            else:
                 # Day visit, departs same day evening? Or just passing through?
                 # Let's add 4 hours for a stopover
                 prev_departure_time = stop.arrival_time + timedelta(hours=4)
        
        prev_location = stop

    logger.info("Geo-enrichment completed.")
    return trip
