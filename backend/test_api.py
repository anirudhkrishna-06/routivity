import requests
import json

def test_plan_trip():
    """Test the plan-trip endpoint"""
    url = "http://localhost:8000/plan-trip"
    
    # Sample request data
    request_data = {
        "source": {"lat": 40.7128, "lng": -74.0060},  # New York
        "destination": {"lat": 34.0522, "lng": -118.2437},  # Los Angeles
        "stops": [{"lat": 39.9526, "lng": -75.1652}],  # Philadelphia
        "mealPreferences": "vegetarian",
        "mealWindows": {
            "lunch": {"start": "12:00", "end": "14:00"},
            "dinner": {"start": "18:00", "end": "20:00"}
        },
        "preferredArrivalTime": "22:00"
    }
    
    try:
        response = requests.post(url, json=request_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the server. Make sure it's running on http://localhost:8000")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    print("Testing Routivity API...")
    success = test_plan_trip()
    if success:
        print("✅ API test passed!")
    else:
        print("❌ API test failed!")

