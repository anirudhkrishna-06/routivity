from typing import List

def search_restaurants(segment, food_pref) -> List[dict]:
    # MOCK restaurant list
    return [
        {
            "name": "Sunrise Diner",
            "location": {"lat": 12.34, "lng": 56.78},
            "rating": 4.5
        },
        {
            "name": "Veggie Paradise",
            "location": {"lat": 12.35, "lng": 56.79},
            "rating": 4.7
        }
    ]
