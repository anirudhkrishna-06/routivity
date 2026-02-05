from fastapi import APIRouter
from app.models.trip import TripRequest
from app.core.normalization import normalize_trip
from app.core.geo_enrichment import enrich_locations
from app.core.attraction_engine import fetch_attractions
from app.core.scheduler import build_daily_schedule
from app.core.assembler import assemble_itinerary

router = APIRouter(prefix="/itinerary", tags=["Itinerary"])


from app.core.accommodation_engine import search_accommodations

@router.post("/generate")
async def generate_itinerary(trip: TripRequest):
    normalized = normalize_trip(trip)
    enriched = await enrich_locations(normalized)
    attractions = await fetch_attractions(enriched)
    schedule = await build_daily_schedule(enriched, attractions)
    itinerary = assemble_itinerary(schedule)

    return {
        "status": "success",
        "itinerary": itinerary
    }


@router.post("/accommodations")
async def fetch_accommodations(trip: TripRequest):
    """
    Fetches accommodation suggestions for each stop in the trip.
    """
    normalized = normalize_trip(trip)
    # We need locations to be enriched (lat/lng) for accurate search if needed, 
    # though search_text uses name. Let's enrich to be safe and get canonical names.
    enriched = await enrich_locations(normalized)
    
    results = {}
    for stop in enriched.route.stops:
        if stop.nights > 0:
            hotels = await search_accommodations(stop)
            results[stop.stop_id] = hotels
            
    return {
        "status": "success",
        "accommodations": results
    }
