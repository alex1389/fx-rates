#!/usr/bin/env python3
"""Fetch the ECB daily reference exchange rates and write rates.json (EUR-based)."""
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
NS = {
    "gesmes": "http://www.gesmes.org/xml/2002-08-01",
    "ecb": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref",
}
OUTPUT_PATH = "rates.json"


def fetch_rates():
    with urllib.request.urlopen(ECB_URL, timeout=30) as resp:
        xml_bytes = resp.read()
    root = ET.fromstring(xml_bytes)
    cube_time = root.find(".//ecb:Cube[@time]", NS)
    date = cube_time.get("time")
    rates = {"EUR": 1.0}
    for cube in cube_time.findall("ecb:Cube", NS):
        rates[cube.get("currency")] = float(cube.get("rate"))
    return date, rates


def main():
    date, rates = fetch_rates()
    payload = {
        "base": "EUR",
        "date": date,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "rates": rates,
    }
    with open(OUTPUT_PATH, "w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")
    print(f"Wrote {OUTPUT_PATH} for {date} with {len(rates)} currencies")


if __name__ == "__main__":
    main()
