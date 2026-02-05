from datetime import timedelta, datetime, time
from typing import Dict, List
from app.models.trip import TripRequest
from app.core.routing import optimize_daily_route
import logging

logger = logging.getLogger(__name__)

def parse_time(t_str: str) -> time:
    return datetime.strptime(t_str, "%H:%M").time()

async def build_daily_schedule(trip: TripRequest, attractions_map: Dict[int, List[Dict]]) -> Dict:
    """
    Constructs the day-by-day schedule.
    """
    logger.info("Building daily schedule.")
    full_itinerary = []
    
    current_date = trip.route.start.date
    
     # Track previous location for "From X to Y" context
    prev_location_name = trip.route.start.address or "Start Location"

    for i, stop in enumerate(trip.route.stops):
        available_attractions = attractions_map.get(stop.stop_id, [])
        # Iterate over days for this stop
        for day_num in range(stop.nights): 
            day_plan = {
                "date": current_date.isoformat(),
                "city": stop.name or stop.address, 
                "accommodation": stop.selected_accommodation, # Pass explicit accommodation object
                "events": []
            }
            
            # 1. Determine Start Time for this Day
            start_hour = 9 # Default 9 AM
            start_minute = 0
            
            # If it's the first day at this stop, we might arrive late
            if day_num == 0 and stop.arrival_time:
                arrival_dt = stop.arrival_time
                # For the very first stop, or generally, specific date checks might be flaky with TZ.
                # Allow travel event if it's the first day of the stop.
                if True: # was: arrival_dt.date() == current_date
                     # Add a "Travel" event showing arrival
                     start_dt = arrival_dt - timedelta(seconds=stop.travel_time_from_prev_sec)
                     day_plan["events"].append({
                        "time": arrival_dt.strftime("%H:%M"),
                        "type": "travel",
                        "title": f"Travel to {stop.name or stop.address}",
                        "origin": prev_location_name,
                        "start_time": start_dt.strftime("%H:%M"),
                        "arrival_time": arrival_dt.strftime("%H:%M"),
                        "duration_mins": int(stop.travel_time_from_prev_sec/60),
                        "description": f"Drive time: {int(stop.travel_time_from_prev_sec/60)} mins"
                     })
                     
                     # Adjust start hour to be after arrival (e.g., +1 hour to settle in)
                     start_hour = arrival_dt.hour + 1
                     if start_minute > 0: start_hour += 1 
            else:
                 day_plan["events"].append({
                    "time": "09:00",
                    "type": "activity",
                    "title": "Start of Day"
                })
        


            # 2. Chronological Scheduling Loop
            # Define meal windows (parsing from preferences or defaults)
            # Assuming 'lunch': 12:00-14:00, 'dinner': 19:00-21:00 for simplicity of logic check
            # Real parsing would be better but keeping it robust for now.
            
            lunch_added = False
            dinner_added = False
            
            # If start hour is early, add Breakfast
            if start_hour < 9:
                 day_plan["events"].append({
                    "time": "08:00",
                    "type": "meal",
                    "title": "Breakfast"
                 })
                 start_hour = 9

            curr_hour = start_hour
            curr_minute = start_minute
            
            # Helper to format time (handles float hours)
            def format_hm(h, m):
                total_minutes = int(h * 60 + m)
                safe_h = (total_minutes // 60) % 24
                safe_m = total_minutes % 60
                return time(safe_h, safe_m).strftime("%H:%M")

            # Attraction Pool
            daily_picks = []
            if available_attractions:
                 # Logic for number of attractions based on remaining time
                 # Roughly 1 attraction per 2.5 hours
                 hours_remaining = 20 - curr_hour # Until 8 PM
                 max_attractions = max(0, int(hours_remaining / 2.5))
                 max_attractions = min(max_attractions, 4) # Cap at 4
                 
                 count = 0
                 while count < max_attractions and available_attractions:
                    daily_picks.append(available_attractions.pop(0))
                    count += 1
            
            # Optimize greedy route if we have picks
            if daily_picks:
                try:
                    daily_picks = await optimize_daily_route(
                        start_location={"lat": stop.lat, "lng": stop.lng}, 
                        locations=daily_picks
                    )
                except Exception as e:
                    logger.error(f"Routing optimization failed: {e}")

            # Chronological Fill
            activity_idx = 0
            rest_prefs = trip.preferences.rest_preferences or {}
            rest_added = False # user-defined midday rest
            
            while curr_hour < 21: # End day at 9 PM
                
                # PRE-LUNCH REST CHECK: If requested and we are approaching lunch but haven't rested
                if not rest_added and rest_prefs.get('midday_rest') and rest_prefs.get('window') == 'pre_lunch':
                    # If it's close to lunch (e.g. 11 AM) or we just started the day
                    # Let's say we schedule it before lunch if time permits
                    if curr_hour >= 10 and curr_hour < 12:
                        duration = float(rest_prefs.get('duration_min', 60)) / 60.0
                        day_plan["events"].append({
                            "time": format_hm(curr_hour, curr_minute),
                            "type": "activity", 
                            "title": "Rest & Recharge (Pre-Lunch)",
                            "description": f"Scheduled break ({int(duration*60)} mins)",
                            "icon": "self-improvement"
                        })
                        curr_hour += duration
                        rest_added = True
                        continue

                # Check for Lunch (12:00 - 14:00)
                # If current time is within or slightly before lunch window, and we haven't had lunch
                if not lunch_added and curr_hour >= 12 and curr_hour < 15:
                    day_plan["events"].append({
                        "time": format_hm(curr_hour, curr_minute),
                        "type": "meal",
                        "title": "Lunch Break"
                    })
                    lunch_added = True
                    curr_hour += 1 # 1 hour lunch
                    
                    # POST-LUNCH REST CHECK
                    if not rest_added and rest_prefs.get('midday_rest') and rest_prefs.get('window') == 'post_lunch':
                         duration = float(rest_prefs.get('duration_min', 60)) / 60.0
                         day_plan["events"].append({
                            "time": format_hm(curr_hour, curr_minute),
                            "type": "activity", 
                            "title": "Rest & Recharge",
                            "description": f"Scheduled break ({int(duration*60)} mins)",
                            "icon": "self-improvement" 
                        })
                         curr_hour += duration # Add rest duration
                         rest_added = True
                    
                    continue

                # Check for Dinner (19:00+)
                if not dinner_added and curr_hour >= 19:
                    day_plan["events"].append({
                        "time": format_hm(curr_hour, curr_minute),
                        "type": "meal",
                        "title": "Dinner"
                    })
                    dinner_added = True
                    curr_hour += 1
                    break # End of day usually

                # Insert Attraction
                if activity_idx < len(daily_picks):
                    attr = daily_picks[activity_idx]
                    day_plan["events"].append({
                        "time": format_hm(curr_hour, curr_minute),
                        "type": "attraction",
                        "title": attr.get("name"),
                        "place_id": attr.get("place_id"),
                        "geometry": attr.get("geometry"),
                        "address": attr.get("vicinity") or attr.get("formatted_address"),
                        "rating": attr.get("rating"),
                        "user_ratings_total": attr.get("user_ratings_total"),
                        "photos": attr.get("photos", [])[:1] # Just take first photo ref to save bandwidth? Or all? Let's take all.
                    })
                    activity_idx += 1
                    curr_hour += 2 # Assume 2 hours per attraction
                else:
                    # No more attractions, maybe free time or end day
                    if curr_hour < 19 and not dinner_added:
                         # Forward to dinner time if gap is small?
                         # Or just break
                         pass
                    curr_hour += 1 # Advance time
            
            # Check if we missed Dinner because we finished early (e.g. 5 PM)
            if not dinner_added and curr_hour >= 17:
                 # Suggest Dinner event at 19:00 or current time if later
                 dinner_time_h = max(curr_hour, 19)
                 day_plan["events"].append({
                    "time": f"{dinner_time_h}:00",
                    "type": "meal",
                    "title": "Dinner"
                 })
            
            full_itinerary.append(day_plan)
            current_date += timedelta(days=1)

        
        # Update prev location for next iteration
        prev_location_name = stop.name or stop.address
            
    return {"schedule": full_itinerary}
