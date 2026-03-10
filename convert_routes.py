#!/usr/bin/env python3
"""
Convert GPX route files to a single GeoJSON FeatureCollection.
Run from the project root:  python3 convert_routes.py
Output: assets/data/berlin-routes.geojson
"""

import json
import math
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

GPX_DIR = os.path.join(os.path.dirname(__file__), "Run_Map", "Run_Map", "Resources")
OUT_PATH = os.path.join(os.path.dirname(__file__), "assets", "data", "berlin-routes.geojson")
NS = "http://www.topografix.com/GPX/1/1"


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def parse_gpx(path):
    tree = ET.parse(path)
    root = tree.getroot()
    tag = lambda t: f"{{{NS}}}{t}"

    coords = []
    times = []

    for trkpt in root.iter(tag("trkpt")):
        lat = float(trkpt.attrib["lat"])
        lon = float(trkpt.attrib["lon"])
        coords.append([lon, lat])

        time_el = trkpt.find(tag("time"))
        if time_el is not None and time_el.text:
            times.append(time_el.text.strip())

    if not coords:
        return None

    # Distance
    dist_km = sum(
        haversine_km(
            coords[i][1], coords[i][0],
            coords[i + 1][1], coords[i + 1][0]
        )
        for i in range(len(coords) - 1)
    )

    # Date from filename or first timestamp
    fname = os.path.basename(path)
    m = re.search(r"(\d{8})_(\d{6})", fname)
    if m:
        raw = m.group(1)
        date_str = f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    elif times:
        date_str = times[0][:10]
    else:
        date_str = "unknown"

    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coords,
        },
        "properties": {
            "date": date_str,
            "points": len(coords),
            "distance_km": round(dist_km, 2),
            "filename": fname,
        },
    }


def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    features = []
    for fname in sorted(os.listdir(GPX_DIR)):
        if not fname.lower().endswith(".gpx"):
            continue
        path = os.path.join(GPX_DIR, fname)
        print(f"  parsing {fname} ...", end=" ", flush=True)
        feat = parse_gpx(path)
        if feat:
            features.append(feat)
            print(f"{feat['properties']['distance_km']} km, {feat['properties']['points']} pts")
        else:
            print("no track points found, skipped")

    geojson = {"type": "FeatureCollection", "features": features}

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    total_km = sum(f["properties"]["distance_km"] for f in features)
    print(f"\nWrote {len(features)} routes ({total_km:.1f} km total) → {OUT_PATH}")


if __name__ == "__main__":
    main()
