import requests

# Coordinates for Mahabalipuram
lat, lon = 12.7517, 80.2033

# Overpass query: find attractions, museums, and historic sites within 3km
query = f"""
[out:json][timeout:25];
(
  node["tourism"~"attraction|museum"](around:3000,{lat},{lon});
  way["tourism"~"attraction|museum"](around:3000,{lat},{lon});
  relation["tourism"~"attraction|museum"](around:3000,{lat},{lon});
  node["historic"](around:3000,{lat},{lon});
  way["historic"](around:3000,{lat},{lon});
  relation["historic"](around:3000,{lat},{lon});
);
out center 30;
"""

url = "https://overpass-api.de/api/interpreter"
response = requests.post(url, data=query)
data = response.json()

print("Tourist places near Mahabalipuram:\n")
for el in data["elements"]:
    tags = el.get("tags", {})
    name = tags.get("name", "(unnamed)")
    category = tags.get("tourism") or tags.get("historic", "unknown")
    plat = el.get("lat") or (el.get("center") or {}).get("lat")
    plon = el.get("lon") or (el.get("center") or {}).get("lon")
    print(f"- {name} ({category}) @ {plat}, {plon}")
