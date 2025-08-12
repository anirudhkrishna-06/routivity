from datetime import datetime, timedelta
from models import TripRequest, TripResponse, Route, Leg, Restaurant
from services.routing import get_route_with_stops
from services.places import search_restaurants

def simulate_timeline(route_data, start_time):
    # MOCK timeline: evenly split legs
    current_time = start_time
    timeline = []
    for leg in route_data["legs"]:
        start_leg = current_time
        hours, minutes = parse_duration(leg["duration"])
        current_time += timedelta(hours=hours, minutes=minutes)
        timeline.append({
            "from": leg["from_place"],
            "to": leg["to_place"],
            "start_time": start_leg,
            "end_time": current_time
        })
    return timeline

def parse_duration(duration_str):
    # Example: "3h 15m" → (3, 15)
    parts = duration_str.replace("h", "").replace("m", "").split()
    hours = int(parts[0]) if len(parts) > 0 else 0
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours, minutes

def find_segment_in_time_window(timeline, window):
    start_w = datetime.strptime(window.start, "%H:%M").time()
    end_w = datetime.strptime(window.end, "%H:%M").time()
    for seg in timeline:
        if start_w <= seg["start_time"].time() <= end_w or start_w <= seg["end_time"].time() <= end_w:
            return seg
    return None

def plan_trip(request: TripRequest):
    # 1. Get route
    route_data = get_route_with_stops(request.source, request.destination, request.stops)

    # 2. Calculate estimated start time
    if request.preferredArrivalTime:
        arrival_dt = datetime.strptime(request.preferredArrivalTime, "%H:%M")
        total_hours = route_data["total_duration"] // 60
        total_minutes = route_data["total_duration"] % 60
        estimated_start = arrival_dt - timedelta(hours=total_hours, minutes=total_minutes)
    else:
        estimated_start = datetime.now()

    # 3. Simulate route timeline
    timeline = simulate_timeline(route_data, estimated_start)

    # 4. Plan meal stops
    meal_stops = []
    for meal_type, window in request.mealWindows.items():
        segment = find_segment_in_time_window(timeline, window)
        if segment:
            candidates = search_restaurants(segment, request.mealPreferences)
            if candidates:
                top_choice = sorted(candidates, key=lambda x: x["rating"], reverse=True)[0]
                meal_stops.append(Restaurant(
                    name=top_choice["name"],
                    location=top_choice["location"],
                    rating=top_choice["rating"],
                    eta=segment["start_time"].strftime("%H:%M")
                ))

    # 5. Build response
    route = Route(
        polyline=route_data["polyline"],
        legs=[Leg(from_place=l["from_place"], to_place=l["to_place"], duration=l["duration"]) for l in route_data["legs"]]
    )

    return TripResponse(
        estimatedDeparture=estimated_start.strftime("%H:%M"),
        route=route,
        mealStops=meal_stops
    )
