# Routivity Backend

A FastAPI backend for the Routivity trip planning application.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python -m uvicorn main:app --reload
```

The server will start on `http://localhost:8000`

## API Endpoints

### POST /plan-trip

Plan a trip with meal stops.

**Request Body:**
```json
{
  "source": {"lat": 40.7128, "lng": -74.0060},
  "destination": {"lat": 34.0522, "lng": -118.2437},
  "stops": [{"lat": 39.9526, "lng": -75.1652}],
  "mealPreferences": "vegetarian",
  "mealWindows": {
    "lunch": {"start": "12:00", "end": "14:00"},
    "dinner": {"start": "18:00", "end": "20:00"}
  },
  "preferredArrivalTime": "22:00"
}
```

**Response:**
```json
{
  "estimatedDeparture": "14:00",
  "route": {
    "polyline": "mock_polyline_data",
    "legs": [
      {"from_place": "Source City", "to_place": "Stop 1", "duration": "3h 00m"},
      {"from_place": "Stop 1", "to_place": "Destination City", "duration": "5h 00m"}
    ]
  },
  "mealStops": [
    {
      "name": "Sunrise Diner",
      "location": {"lat": 12.34, "lng": 56.78},
      "rating": 4.5,
      "eta": "15:00"
    }
  ]
}
```

## Testing

Run the test script to verify the API is working:
```bash
python test_api.py
```

## API Documentation

Once the server is running, you can view the interactive API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

