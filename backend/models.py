from typing import List, Optional, Dict
from pydantic import BaseModel

class Location(BaseModel):
    lat: float
    lng: float

class MealWindow(BaseModel):
    start: str  # "HH:MM"
    end: str    # "HH:MM"

class TripRequest(BaseModel):
    source: Location
    destination: Location
    stops: Optional[List[Location]] = []
    mealPreferences: str
    mealWindows: Dict[str, MealWindow]
    preferredArrivalTime: Optional[str] = None  # "HH:MM"

class Restaurant(BaseModel):
    name: str
    location: Location
    rating: float
    eta: str

class Leg(BaseModel):
    from_place: str
    to_place: str
    duration: str

class Route(BaseModel):
    polyline: str
    legs: List[Leg]

class TripResponse(BaseModel):
    estimatedDeparture: str
    route: Route
    mealStops: List[Restaurant]
