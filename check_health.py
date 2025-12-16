import requests
import json

url = "http://localhost:8000/trips/create"
data = {
    "source": {"lat": 12.9716, "lng": 77.5946},
    "destination": {"lat": 12.2958, "lng": 76.6394},
    "preferred_reach_time": "2025-12-10T13:00:00.000Z",
    "mealWindows": {"lunch": {"start": "12:00", "end": "14:00"}},
    "mealPreferences": ["Any"],
    "meal_duration_min": 45,
    "max_detour_minutes": 30,
    "veh_pref": "any",
    "stops": []
}

try:
    print(f"Sending POST to {url}...")
    resp = requests.post(url, json=data, timeout=30)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        j = resp.json()
        print(f"Suggestions: {len(j.get('tourist_suggestions', []))}")
    else:
        print(f"Error: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")
