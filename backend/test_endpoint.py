import asyncio
import httpx
import json

async def test_enhanced_endpoint():
    async with httpx.AsyncClient() as client:
        # Test data with your actual user_id
        payload = {
            "source": {"lat": 12.9716, "lng": 77.5946},
            "destination": {"lat": 13.0827, "lng": 80.2707},
            "mealPreferences": ["lunch", "dinner"],
            "mealWindows": {
                "lunch": {"start": "12:00", "end": "14:00"},
                "dinner": {"start": "19:00", "end": "21:00"}
            },
            "preferred_reach_time": "2024-01-15T21:00:00",
            "user_id": "72uY6EAy3rQUJjdRqM5vZN2kJ163"
        }
        
        try:
            response = await client.post(
                "http://localhost:8000/trips/create",
                json=payload,
                timeout=30.0
            )
            
            print(f"Status Code: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))
            
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_enhanced_endpoint())