from fastapi import FastAPI
from models import TripRequest, TripResponse
from services.planner import plan_trip

app = FastAPI(title="Routivity Backend")

@app.post("/plan-trip", response_model=TripResponse)
def plan_trip_endpoint(request: TripRequest):
    return plan_trip(request)
