from app.models.trip import TripRequest
from app.services.google_places import google_places
from app.core.scoring import score_attraction
from typing import Dict, List
import logging
import asyncio

logger = logging.getLogger(__name__)

async def fetch_attractions(trip: TripRequest) -> Dict[int, List[Dict]]:
    """
    Fetches and ranks attractions for each stop in the trip.
    Returns a dictionary mapping stop_id -> list of ranked attraction objects.
    """
    logger.info("Fetching attractions for all stops.")
    attractions_map = {}

    for stop in trip.route.stops:
        if not stop.lat or not stop.lng:
            logger.warning(f"Skipping attraction fetch for stop {stop.stop_id}: No coordinates.")
            attractions_map[stop.stop_id] = []
            continue

        themes = stop.attraction_preferences.themes
        aggregated_results = []
        
        # Parallelize fetching for different themes could be an option, 
        # but for now we'll do sequential per stop, maybe parallelize themes?
        # Let's just do a broad search or iterate themes.
        # "tourist_attraction" is a good catch-all.
        
        search_keywords = themes if themes else ["highlights", "tourist attractions"]
        
        seen_place_ids = set()
        
        for keyword in search_keywords:
            results = []
            # STRATEGY 1: Text Search (Best for "Museums in Paris") - if name is available 
            if stop.name:
                query = f"{keyword} in {stop.name}"
                logger.info(f"Searching: {query}")
                results = await google_places.search_text(query)
            
            # STRATEGY 2: Fallback to Nearby Search (Radius) if text search yields nothing or no name
            if not results:
                logger.info(f"Fallback to nearby search for {keyword} at {stop.lat}, {stop.lng}")
                results = await google_places.nearby_search(
                    lat=stop.lat, 
                    lng=stop.lng, 
                    radius=10000, # Increased to 10km
                    keyword=keyword
                )
            
            for place in results:
                if place["place_id"] not in seen_place_ids:
                    # Calculate Score
                    place["score"] = score_attraction(place, themes)
                    aggregated_results.append(place)
                    seen_place_ids.add(place["place_id"])

        # Sort by score descending
        aggregated_results.sort(key=lambda x: x["score"], reverse=True)
        
        # Limit to top N candidates (e.g. 50) to pass to scheduler
        attractions_map[stop.stop_id] = aggregated_results[:50]
        logger.info(f"Stop {stop.stop_id}: Found {len(aggregated_results)} attractions.")

    return attractions_map
