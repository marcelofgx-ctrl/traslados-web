#!/usr/bin/env python3
"""Create an automatically refreshed Uruguay POI index from OpenStreetMap.

Input: Geofabrik Uruguay .osm.pbf (https://download.geofabrik.de/south-america.html)
Output: compact public/data/uy-pois.json used for name-based lookup in the web.

This is not a hand-maintained list and requires no API key. OSM contributors'
data is available under ODbL: https://www.openstreetmap.org/copyright
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import unicodedata
from pathlib import Path

import osmium

KEYS = {
    "shop", "amenity", "tourism", "leisure", "healthcare",
    "office", "craft", "aeroway", "railway", "public_transport",
    "historic", "club", "sport", "building", "landuse",
}

RELEVANT_LANDUSE = {"retail", "commercial", "industrial"}
RELEVANT_BUILDING = {"retail", "commercial", "hospital", "hotel", "school",
                     "university", "supermarket", "train_station", "transportation"}
SKIP_AMENITIES = {"bench", "waste_basket", "drinking_water", "telephone", "parking_space",
                  "bicycle_parking", "recycling", "clock"}
SKIP_LEISURE = {"pitch", "playground", "dog_park", "track"}
CANON = lambda value: re.sub(r"\s+", " ", unicodedata.normalize("NFD", value.lower())
                           .encode("ascii", "ignore").decode("ascii")).strip()
CONTROL = re.compile(r"[\x00-\x1f\x7f]")

def dept_hint(lat: float, lon: float, tags: dict[str, str]) -> str:
    raw = CANON(tags.get("addr:state", "") or tags.get("is_in:state", ""))
    if "montevideo" in raw: return "MONTEVIDEO"
    if "canelones" in raw: return "CANELONES"
    if "maldonado" in raw: return "MALDONADO"
    # Approximate metro areas only when high confidence; never exclude based on this.
    if -34.99 <= lat <= -34.75 and -56.45 <= lon <= -56.035: return "MONTEVIDEO"
    if -34.92 <= lat <= -34.45 and -56.30 <= lon <= -55.45: return "CANELONES"
    if -35.0 <= lat <= -34.45 and -55.45 <= lon <= -54.45: return "MALDONADO"
    return ""

def category(tags: dict[str, str]) -> str | None:
    if "shop" in tags: return "COMERCIO"
    if "amenity" in tags and tags["amenity"] not in SKIP_AMENITIES: return "SERVICIO"
    if "tourism" in tags: return "TURISMO"
    if "healthcare" in tags: return "SALUD"
    if "aeroway" in tags: return "TRANSPORTE"
    if "railway" in tags or "public_transport" in tags: return "TRANSPORTE"
    if "office" in tags or "craft" in tags: return "COMERCIO"
    if "leisure" in tags and tags["leisure"] not in SKIP_LEISURE: return "RECREACION"
    if "historic" in tags or "club" in tags or "sport" in tags: return "LUGAR"
    if tags.get("building") in RELEVANT_BUILDING: return "EDIFICIO"
    if tags.get("landuse") in RELEVANT_LANDUSE: return "LUGAR"
    return None

class NamedPlaces(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows: list[list] = []

    def add(self, typ: str, obj, lat: float, lon: float):
        if not (-35.1 <= lat <= -30 and -58.5 <= lon <= -53): return
        tags = {x.k: x.v for x in obj.tags}
        name = tags.get("name", "").strip() or tags.get("name:es", "").strip()
        if not name or len(name) < 3 or len(name) > 135: return
        cat = category(tags)
        if cat is None: return
        name = CONTROL.sub(" ", name).strip()
        alt = tags.get("alt_name", "").strip() or tags.get("short_name", "").strip()
        if len(alt) > 130: alt = ""
        addr = " ".join(x for x in [
            tags.get("addr:street", "").strip(),
            tags.get("addr:housenumber", "").strip(),
        ] if x)
        town = tags.get("addr:city", "").strip() or tags.get("addr:suburb", "").strip()
        hint = ", ".join(x for x in [addr, town] if x)
        self.rows.append([
            f"{typ}{obj.id}", name, round(lat, 6), round(lon, 6),
            dept_hint(lat, lon, tags), cat,
            CONTROL.sub(" ", hint[:110]), CONTROL.sub(" ", alt),
        ])

    def node(self, n):
        if n.location.valid():
            self.add("n", n, n.location.lat, n.location.lon)

    def way(self, w):
        points = []
        for n in w.nodes:
            try:
                if n.location.valid():
                    points.append((n.location.lat, n.location.lon))
            except (ValueError, osmium.InvalidLocationError):
                continue
        if not points: return
        # Center of bounding box, suitable for search preview (not guaranteed door).
        lowlat = min(p[0] for p in points)
        highlat = max(p[0] for p in points)
        lowlon = min(p[1] for p in points)
        highlon = max(p[1] for p in points)
        self.add("w", w, (lowlat + highlat) / 2, (lowlon + highlon) / 2)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pbf", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    handler = NamedPlaces()
    handler.apply_file(args.pbf, locations=True, idx="flex_mem")
    # Nodes/ways of the same business are often duplicated. Deduplicate them
    # within approximately 55 m, but keep stores with the same name in other towns.
    seen = set()
    deduped = []
    for row in sorted(handler.rows, key=lambda x: (CANON(x[1]), x[5], x[0].startswith("n"))):
        key = (CANON(row[1]), round(row[2], 3), round(row[3], 3))
        if key in seen: continue
        seen.add(key)
        deduped.append(row)
    result = {
        "version": 1,
        "source": "© OpenStreetMap contributors (ODbL)",
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "items": deduped,
    }
    dest = Path(args.output)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    print("Indexed named Uruguay POIs:", len(deduped), "bytes:", dest.stat().st_size)
    for word in ["punta carretas", "plaza italia", "tres cruces", "portones shopping"]:
        found = [x[:6] for x in deduped if word in CANON(x[1])]
        print("CHECK", word, len(found), found[:5])

if __name__ == "__main__":
    main()
