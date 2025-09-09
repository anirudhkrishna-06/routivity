#!/usr/bin/env python3
"""
Debug Viewer for Routivity Backend
This script helps you view the debugging information from the backend services.
"""

import requests
import json
import time
from datetime import datetime

def test_debug_endpoints():
    """Test all debug endpoints and display results"""
    base_url = "http://localhost:8000"
    
    print("🔍 Routivity Backend Debug Viewer")
    print("=" * 50)
    print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Backend URL: {base_url}")
    print()
    
    # Test health endpoint
    print("1️⃣  Testing Health Endpoint...")
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Backend is healthy!")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return
    print()
    
    # Test routing debug endpoint
    print("2️⃣  Testing Routing Service...")
    try:
        response = requests.get(f"{base_url}/debug/routing")
        if response.status_code == 200:
            data = response.json()
            if data["status"] == "success":
                result = data["result"]
                print("✅ Routing service working!")
                print(f"   Distance: {result['distance_km']:.1f} km")
                print(f"   Duration: {result['duration_hr']:.1f} hours")
                print(f"   Legs: {len(result['legs'])}")
            else:
                print(f"❌ Routing service error: {data['error']}")
        else:
            print(f"❌ Routing debug failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Routing test error: {e}")
    print()
    
    # Test places debug endpoint
    print("3️⃣  Testing Places Service...")
    try:
        response = requests.get(f"{base_url}/debug/places")
        if response.status_code == 200:
            data = response.json()
            if data["status"] == "success":
                result = data["result"]
                print("✅ Places service working!")
                print(f"   Found {len(result)} places")
                for i, place in enumerate(result[:3]):  # Show first 3
                    print(f"   {i+1}. {place['name']} (rating: {place['rating']})")
            else:
                print(f"❌ Places service error: {data['error']}")
        else:
            print(f"❌ Places debug failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Places test error: {e}")
    print()
    
    # Test full trip planning
    print("4️⃣  Testing Full Trip Planning...")
    try:
        trip_request = {
            "source": {"lat": 40.7128, "lng": -74.0060},  # New York
            "destination": {"lat": 34.0522, "lng": -118.2437},  # Los Angeles
            "stops": [],
            "mealPreferences": "vegetarian",
            "mealWindows": {
                "lunch": {"start": "12:00", "end": "14:00"},
                "dinner": {"start": "18:00", "end": "20:00"}
            },
            "preferredArrivalTime": "22:00"
        }
        
        response = requests.post(f"{base_url}/plan-trip", json=trip_request)
        if response.status_code == 200:
            data = response.json()
            print("✅ Trip planning working!")
            print(f"   Departure: {data['estimatedDeparture']}")
            print(f"   Route legs: {len(data['route']['legs'])}")
            print(f"   Meal stops: {len(data['mealStops'])}")
            for stop in data['mealStops']:
                print(f"   - {stop['name']} at {stop['eta']} (rating: {stop['rating']})")
        else:
            print(f"❌ Trip planning failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Trip planning error: {e}")
    print()
    
    print("🎯 Debug Summary Complete!")
    print("📝 Check the backend terminal for detailed logs with emojis")

def show_log_locations():
    """Show where to find the logs"""
    print("\n📋 Where to See Debug Logs:")
    print("=" * 30)
    print("1. 🖥️  Backend Terminal Window:")
    print("   - Look for the terminal where you started the backend")
    print("   - You'll see logs with emojis like: 🗺️ 🍽️ 🎯")
    print("   - Each service has its own emoji prefix")
    print()
    print("2. 🔍 Log Emoji Guide:")
    print("   🚀 API: Main API endpoint logs")
    print("   🗺️  ROUTING: Route calculation logs")
    print("   🍽️  PLACES: Restaurant search logs")
    print("   🎯 PLANNER: Trip planning orchestration logs")
    print("   ✅ Success messages")
    print("   ❌ Error messages")
    print("   🔄 Fallback to mock data")
    print("   🎭 Mock data usage")
    print()
    print("3. 🌐 Debug Endpoints:")
    print("   - http://localhost:8000/debug/routing")
    print("   - http://localhost:8000/debug/places")
    print("   - http://localhost:8000/docs (API documentation)")

if __name__ == "__main__":
    test_debug_endpoints()
    show_log_locations()

