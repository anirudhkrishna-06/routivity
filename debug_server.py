import subprocess
import time
import requests
import sys
import os

LOG_FILE = "server_debug.log"

def cleanup():
    print("Killing existing python processes...")
    subprocess.run("taskkill /F /IM python.exe", shell=True, capture_output=True)

def start_server():
    print("Starting server...")
    with open(LOG_FILE, "w") as f:
        # Use unbuffered output (-u)
        proc = subprocess.Popen([sys.executable, "-u", "backend/main_osrm.py"], 
                                cwd=os.getcwd(),
                                stdout=f, 
                                stderr=subprocess.STDOUT)
    return proc

def send_request():
    print("Sending trip request...")
    url = "http://localhost:8000/trips/create"
    data = {
      "user_id": "test_user",
      "source": {"lat": 12.9716, "lng": 77.5946}, # Bangalore
      "destination": {"lat": 12.2958, "lng": 76.6394}, # Mysore
      "preferred_reach_time": "2025-12-10T13:00:00.000Z",
      "mealWindows": {
        "lunch": {"start": "12:00", "end": "14:00"}
      },
      "mealPreferences": ["Lunch"],
      "meal_duration_min": 45,
      "max_detour_minutes": 30,
      "veg_pref": "any",
      "stops": []
    }
    
    try:
        resp = requests.post(url, json=data, timeout=30)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code != 200:
            print("Response:", resp.text)
    except Exception as e:
        print(f"Request failed: {e}")

def check_log():
    print("\n--- SERVER LOG ---")
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            print(f.read())
    else:
        print("Log file not found.")
    print("------------------")

if __name__ == "__main__":
    cleanup()
    proc = start_server()
    time.sleep(10) # Give it time to start
    send_request()
    proc.terminate()
    check_log()
