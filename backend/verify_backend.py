import asyncio
import os
import json
from app.itenary import generate_itinerary
from app.models.trip import TripRequest

# Mock data based on test_request.json structure
MOCK_PAYLOAD = {
  "trip_metadata": {
    "trip_name": "Test Trip",
    "main_destination": "Paris"
  },
  "route": {
    "start": {
      "address": "Paris, France",
      "date": "2025-06-01",
      "time": "10:00:00",
      "timestamp": "2025-06-01T10:00:00"
    },
    "stops": [
      {
        "stop_id": 1,
        "name": "Paris Center",
        "address": "Eiffel Tower, Paris",
        "nights": 2,
        "arrival_preference": "morning",
        "departure_preference": "evening",
        "attraction_preferences": {
             "themes": ["museum", "landmark"],
             "max_places_per_half_day": 2
        }
      }
    ],
    "round_trip": False,
    "total_nights": 2,
    "transport_mode": "driving" 
  },
  "preferences": {
    "meal_preferences": {
        "meal_windows": {},
        "meal_duration_min": 60
    },
    "rest_preferences": {},
    "travel_style": {}
  },
  "constraints": {},
  "user_id": "test_user"
}


async def verify():
    with open("verification_result.txt", "w") as f:
        f.write("Starting Verification...\n")
        
        # Check API Key
        if not os.getenv("GOOGLE_MAPS_API_KEY"):
            f.write("WARNING: GOOGLE_MAPS_API_KEY is not set.\n")
        
        try:
            trip_request = TripRequest(**MOCK_PAYLOAD)
            f.write("Payload validated.\n")
            
            result = await generate_itinerary(trip_request)
            
            f.write("Generation Successful!\n")
            f.write(json.dumps(result, indent=2, default=str) + "\n")
            
            if result["status"] == "success" and result.get("itinerary"):
                f.write("VERIFICATION PASSED: Itinerary generated.\n")
            else:
                f.write("VERIFICATION FAILED: Status not success.\n")
                
        except Exception as e:
            import traceback
            f.write(f"VERIFICATION FAILED With Error: {e}\n")
            f.write(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(verify())
