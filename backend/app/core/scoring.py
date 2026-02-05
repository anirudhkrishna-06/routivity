from typing import Dict, List

def score_attraction(place: Dict, themes: List[str]) -> float:
    """
    Scores an attraction based on rating, review count, and theme relevance.
    """
    score = 0.0
    
    # Base score from rating (0-5) -> 0-50 points
    rating = place.get("rating", 0) or 0
    score += rating * 10

    # Boost from popularity (review count) -> up to 20 points
    # Logarithmic-ish scaling: 100 reviews ~ 5 pts, 1000 reviews ~ 10 pts, 10k+ ~ 20 pts
    reviews = place.get("user_ratings_total", 0) or 0
    if reviews > 10000:
        score += 20
    elif reviews > 1000:
        score += 15
    elif reviews > 100:
        score += 10
    elif reviews > 10:
        score += 5

    # Theme matching (if types match themes)
    place_types = place.get("types", [])
    matches = set(place_types).intersection(set(themes))
    if matches:
        score += 15 * len(matches) # Bonus for every matching theme
    
    return score
