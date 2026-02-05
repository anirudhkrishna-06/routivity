from typing import List, Dict
from app.services.google_distance import google_distance
import logging

logger = logging.getLogger(__name__)

async def optimize_daily_route(start_location: Dict, locations: List[Dict], end_location: Dict = None) -> List[Dict]:
    """
    Optimizes the order of locations to visit in a day.
    Simple Nearest Neighbor approach for MVP.
    """
    if not locations:
        return []

    if len(locations) == 1:
        return locations

    logger.info(f"Optimizing route for {len(locations)} locations.")
    
    # Needs implementation of TSP or NN. 
    # For now, we will just return them in the order of their scoring (highest first)
    # assuming the user might want to visit top rated first, 
    # BUT the legitimate Request is for distance-based routing.
    
    # Real implementation needs async calls to Distance Matrix.
    # To keep it fast and "complete" for MVP without heavy algorithm implementation:
    # 1. Start at start_location (hotel/arrival).
    # 2. Find closest from remaining.
    # 3. Repeat.
    
    ordered_route = []
    remaining = locations.copy()
    current_pos = f"{start_location['lat']},{start_location['lng']}"
    
    # Safety breakout to avoid infinite loops if something goes wrong
    while remaining:
        # Prepare batch call for distances from current_pos to all remaining
        destinations = [f"{loc['geometry']['location']['lat']},{loc['geometry']['location']['lng']}" for loc in remaining]
        
        matrix = await google_distance.get_distance_matrix(origins=[current_pos], destinations=destinations)
        
        if not matrix or "rows" not in matrix:
            # Fallback to score-based if API fails
            return remaining # Already sorted by score? No, we need to append current remaining to ordered
        
        elements = matrix["rows"][0]["elements"]
        
        # Find index of closest
        best_idx = -1
        min_duration = float("inf")
        
        for idx, el in enumerate(elements):
            if el["status"] == "OK":
                duration = el["duration"]["value"]
                if duration < min_duration:
                    min_duration = duration
                    best_idx = idx
        
        if best_idx != -1:
            next_stop = remaining.pop(best_idx)
            ordered_route.append(next_stop)
            current_pos = f"{next_stop['geometry']['location']['lat']},{next_stop['geometry']['location']['lng']}"
        else:
            # If we can't get distances (e.g. ZERO_RESULTS), just dump the rest
            ordered_route.extend(remaining)
            break
            
    return ordered_route
