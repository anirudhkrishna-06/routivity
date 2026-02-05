import requests
from app.core.config import settings

API_KEY = settings.GOOGLE_MAPS_API_KEY
BASE_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

# Test Coordinates (e.g., San Francisco)
lat, lng = 37.7749, -122.4194

params = {
    "location": f"{lat},{lng}",
    "radius": 5000,
    "keyword": "museum",
    "key": API_KEY
}

try:
    response = requests.get(BASE_URL, params=params)
    data = response.json()
    
    print(f"Status: {data.get('status')}")
    if data.get("error_message"):
        print(f"Error Message: {data.get('error_message')}")
    
    if data.get("results"):
        print(f"Found {len(data['results'])} results.")
        print(f"First result: {data['results'][0]['name']}")
    else:
        print("No results found.")
        
except Exception as e:
    print(f"Network Error: {e}")
