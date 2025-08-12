from typing import Dict

def get_route_with_stops(source, destination, stops) -> Dict:
    # MOCK route for now
    # Later, call Google Directions API with waypoints
    return {
        "total_duration": 8 * 60,  # in minutes
        "polyline": "mock_polyline_data",
        "legs": [
            {"from_place": "Source City", "to_place": "Stop 1", "duration": "3h 00m"},
            {"from_place": "Stop 1", "to_place": "Destination City", "duration": "5h 00m"}
        ]
    }
