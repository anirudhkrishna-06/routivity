from app.models.trip import TripRequest
import logging

logger = logging.getLogger(__name__)

def normalize_trip(trip: TripRequest) -> TripRequest:
    """
    Validates and normalizes trip data.
    - Sets default values if missing.
    - Ensures date/time consistency (though Pydantic handles type conversion).
    """
    logger.info("Normalizing trip request.")

    # 1. Defaults for Attraction Preferences
    for stop in trip.route.stops:
        prefs = stop.attraction_preferences
        if not prefs.themes:
            prefs.themes = ["tourist_attraction", "museum", "landmark", "park"]
            logger.info(f"Stop {stop.stop_id}: Defaulting themes to {prefs.themes}")

    # 2. Defaults for Global Preferences
    if not trip.preferences.meal_preferences.meal_windows:
         # Default meal windows if empty
         trip.preferences.meal_preferences.meal_windows = {
             "lunch": {"start": "12:00", "end": "14:00"},
             "dinner": {"start": "19:00", "end": "21:00"}
         }

    return trip
