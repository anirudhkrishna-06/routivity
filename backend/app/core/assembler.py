from typing import Dict, List

def assemble_itinerary(schedule: Dict) -> Dict:
    """
    Assembles the final itinerary response, calculating summaries.
    """
    daily_schedule = schedule.get("schedule", [])
    
    total_days = len(daily_schedule)
    total_events = sum(len(day.get("events", [])) for day in daily_schedule)
    
    # Placeholder for cost estimation logic
    estimated_cost = total_days * 150  # Dummy logic: $150 per day
    
    return {
        "days": daily_schedule,
        "summary": {
            "total_days": total_days,
            "total_events": total_events,
            "estimated_cost": estimated_cost,
            "currency": "USD"
        }
    }
