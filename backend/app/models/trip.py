from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, date, time


class Location(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    place_id: Optional[str] = None
    address: Optional[str] = None


class StartPoint(Location):
    date: date
    time: time
    timestamp: datetime


class StayPreferences(BaseModel):
    type: List[str] = []
    star: str = "no_preference"
    family_friendly: bool = False
    environment: List[str] = []
    parking: bool = False



class AttractionPreferences(BaseModel):
    themes: List[str] = []
    max_places_per_half_day: int = 2
    avoid_crowds: bool = False
    include_rest: bool = False
    walking_tolerance: str = "medium"


class Stop(Location):
    stop_id: int
    name: Optional[str]
    nights: int
    arrival_preference: str
    departure_preference: str
    stay_preferences: StayPreferences = StayPreferences()
    selected_accommodation: Optional[Dict] = None
    attraction_preferences: AttractionPreferences
    arrival_time: Optional[datetime] = None
    travel_time_from_prev_sec: Optional[float] = 0.0


class Route(BaseModel):
    start: StartPoint
    stops: List[Stop]
    round_trip: bool
    total_nights: int
    transport_mode: str


class MealWindow(BaseModel):
    start: str
    end: str


class MealPreferences(BaseModel):
    meal_windows: Dict[str, MealWindow]
    meal_duration_min: int


class Preferences(BaseModel):
    meal_preferences: MealPreferences
    rest_preferences: Dict
    travel_style: Dict


class TripRequest(BaseModel):
    trip_metadata: Dict
    route: Route
    preferences: Preferences
    constraints: Dict
    user_id: str
