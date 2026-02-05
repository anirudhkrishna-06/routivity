from typing import List, Dict
import logging
from app.models.trip import Stop
from app.services.google_places import google_places

logger = logging.getLogger(__name__)

async def search_accommodations(stop: Stop) -> List[Dict]:
    """
    Fetches accommodation options for a given stop based on preferences.
    """
    prefs = stop.stay_preferences
    query_parts = []
    
    # helper for star rating
    if prefs.star and prefs.star != 'no_preference':
        stars = prefs.star.replace('_', ' ') # e.g. "5 stars"
        query_parts.append(f"{stars}")
    
    # helper for types
    if prefs.type:
        types_str = " ".join([t.replace('_', ' ') for t in prefs.type])
        query_parts.append(types_str)
    else:
        query_parts.append("hotels")

    # helper for amenities
    if prefs.family_friendly:
        query_parts.append("family friendly")
    if prefs.parking:
        query_parts.append("with parking")
    
    location_name = stop.name or stop.address
    query = f"{' '.join(query_parts)} in {location_name}"
    
    logger.info(f"Searching accommodations: {query}")
    
    # Use text search for better semantic matching of "family friendly", "resort", etc.
    results = await google_places.search_text(query)
    
    # Filter/Sort logic could go here
    # For now, return top 10
    return results[:10]
