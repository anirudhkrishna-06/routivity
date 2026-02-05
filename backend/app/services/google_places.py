import os
import httpx
import logging
from typing import Dict, Optional, List

# Configure logger
logger = logging.getLogger(__name__)

from app.core.config import settings

class GooglePlacesService:
    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY
        self.base_url = "https://maps.googleapis.com/maps/api/place"
        if not self.api_key:
            logger.warning("GOOGLE_MAPS_API_KEY not found in environment variables.")

    async def search_place(self, query: str) -> Optional[Dict]:
        """
        Search for a place by text query to get lat/lng and place_id.
        """
        results = await self.search_text(query)
        return results[0] if results else None

    async def search_text(self, query: str) -> List[Dict]:
        """
        Generic text search returning multiple results.
        Useful for 'Museums in Paris' type queries.
        """
        if not self.api_key:
            return []
        
        url = f"{self.base_url}/textsearch/json"
        params = {
            "query": query,
            "key": self.api_key
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                if data.get("status") == "OK":
                    return data.get("results", [])
                else:
                    logger.error(f"Text search failed for '{query}': {data.get('status')} - {data.get('error_message')}")
                    return []
            except Exception as e:
                logger.error(f"Error executing text search for '{query}': {type(e).__name__}: {e}")
                return []

    async def get_place_details(self, place_id: str) -> Optional[Dict]:
        """
        Get details for a specific place_id.
        """
        if not self.api_key:
            return None

        url = f"{self.base_url}/details/json"
        params = {
            "place_id": place_id,
            "key": self.api_key,
            "fields": "name,geometry,formatted_address,types,rating,user_ratings_total,opening_hours"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                if data.get("status") == "OK" and data.get("result"):
                    return data["result"]
                else:
                    return None
            except Exception as e:
                logger.error(f"Error fetching details for '{place_id}': {e}")
                return None
    
    async def nearby_search(self, lat: float, lng: float, radius: int = 5000, keyword: str = "") -> List[Dict]:
        """
        Search for places nearby a location.
        """
        if not self.api_key:
            return []

        url = f"{self.base_url}/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "key": self.api_key
        }
        if keyword:
            params["keyword"] = keyword

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                if data.get("status") == "OK":
                    return data.get("results", [])
                return []
            except Exception as e:
                logger.error(f"Error executing nearby search: {type(e).__name__}: {e}")
                return []

# Singleton instance
google_places = GooglePlacesService()
