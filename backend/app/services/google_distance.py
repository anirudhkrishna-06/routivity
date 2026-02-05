import os
import httpx
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

from app.core.config import settings

class GoogleDistanceService:
    def __init__(self):
        self.api_key = settings.GOOGLE_MAPS_API_KEY
        self.base_url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        
    async def get_distance_matrix(self, origins: List[str], destinations: List[str], mode: str = "driving") -> Optional[Dict]:
        """
        Fetch distance and duration between origins and destinations.
        Origins/Destinations can be "lat,lng" strings or place_ids.
        """
        if not self.api_key:
            return None
            
        params = {
            "origins": "|".join(origins),
            "destinations": "|".join(destinations),
            "mode": mode,
            "key": self.api_key
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()
                if data.get("status") == "OK":
                    return data
                logger.error(f"Distance Matrix API error: {data.get('status')}")
                return None
            except Exception as e:
                logger.error(f"Error fetching distance matrix: {e}")
                return None

# Singleton
google_distance = GoogleDistanceService()
