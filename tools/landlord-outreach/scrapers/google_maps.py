"""
Google Places API scraper for property management companies near UofU.
Uses Text Search + Place Details to get name, address, phone, and website.
"""

import json
import time
import logging
import math
import os
from typing import List, Dict, Any, Optional

import requests

from config import (
    GOOGLE_PLACES_API_KEY,
    PLACES_QUERIES,
    UOFU_LAT,
    UOFU_LNG,
    TIER_1_RADIUS_MILES,
    TIER_2_RADIUS_MILES,
    REQUEST_DELAY_MIN,
    REQUEST_DELAY_MAX,
    PLACES_TEXT_SEARCH_COST_PER_CALL,
    PLACES_DETAILS_COST_PER_CALL,
    GOOGLE_API_BUDGET_LIMIT_USD,
    GOOGLE_API_COST_LOG,
)

logger = logging.getLogger(__name__)

PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


# ── Budget tracking ──────────────────────────────────────────────────────────

def _load_spend_log() -> dict:
    if os.path.exists(GOOGLE_API_COST_LOG):
        try:
            with open(GOOGLE_API_COST_LOG) as f:
                return json.load(f)
        except Exception:
            pass
    return {"total_usd": 0.0, "runs": []}


def _save_spend_log(log: dict) -> None:
    os.makedirs(os.path.dirname(GOOGLE_API_COST_LOG), exist_ok=True)
    with open(GOOGLE_API_COST_LOG, "w") as f:
        json.dump(log, f, indent=2)


def _record_spend(text_search_calls: int, detail_calls: int) -> float:
    """Record this run's spend and return the new cumulative total."""
    run_cost = (
        text_search_calls * PLACES_TEXT_SEARCH_COST_PER_CALL
        + detail_calls * PLACES_DETAILS_COST_PER_CALL
    )
    log = _load_spend_log()
    log["total_usd"] = round(log["total_usd"] + run_cost, 4)
    log["runs"].append({
        "text_search_calls": text_search_calls,
        "detail_calls": detail_calls,
        "run_cost_usd": round(run_cost, 4),
        "cumulative_usd": log["total_usd"],
    })
    _save_spend_log(log)
    return log["total_usd"]


def print_spend_summary() -> None:
    """Print cumulative Google API spend. Call anytime to check your balance."""
    log = _load_spend_log()
    total = log["total_usd"]
    remaining = GOOGLE_API_BUDGET_LIMIT_USD - total
    print(f"\n{'─'*45}")
    print(f"  Google API spend:   ${total:.4f}")
    print(f"  Budget limit:       ${GOOGLE_API_BUDGET_LIMIT_USD:.2f}")
    print(f"  Remaining:          ${remaining:.4f}")
    if remaining < 20:
        print(f"  ⚠️  WARNING: Less than $20 remaining — notify team to rotate API key!")
    print(f"{'─'*45}\n")


def _check_budget(estimated_new_spend: float) -> bool:
    """Return True if it's safe to proceed, False if budget would be exceeded."""
    log = _load_spend_log()
    projected = log["total_usd"] + estimated_new_spend
    if projected >= GOOGLE_API_BUDGET_LIMIT_USD:
        logger.error(
            f"BUDGET LIMIT REACHED — projected spend ${projected:.2f} would exceed "
            f"${GOOGLE_API_BUDGET_LIMIT_USD:.2f} limit. "
            f"Notify the team to rotate to a new API key before running again."
        )
        return False
    if projected >= GOOGLE_API_BUDGET_LIMIT_USD * 0.9:
        logger.warning(
            f"Approaching budget limit — projected cumulative spend: ${projected:.2f} "
            f"(limit: ${GOOGLE_API_BUDGET_LIMIT_USD:.2f})"
        )
    return True

# ~1.5 miles in meters
TIER_1_RADIUS_M = int(TIER_1_RADIUS_MILES * 1609.34)
# ~5.0 miles in meters
TIER_2_RADIUS_M = int(TIER_2_RADIUS_MILES * 1609.34)


def _miles_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Simple haversine distance in miles."""
    R = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _get_distance_tier(lat: Optional[float], lng: Optional[float]) -> Optional[int]:
    if lat is None or lng is None:
        return None
    dist = _miles_between(UOFU_LAT, UOFU_LNG, lat, lng)
    if dist <= TIER_1_RADIUS_MILES:
        return 1
    if dist <= TIER_2_RADIUS_MILES:
        return 2
    return None


def _text_search(query: str, api_key: str) -> List[Dict]:
    """Run a Google Places Text Search and return all result pages."""
    results = []
    params = {
        "query": query,
        "key": api_key,
        "location": f"{UOFU_LAT},{UOFU_LNG}",
        "radius": TIER_2_RADIUS_M,
    }
    while True:
        try:
            resp = requests.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning(f"Places text search failed for '{query}': {e}")
            break

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            logger.warning(f"Places API error: {data.get('status')} for '{query}'")
            break

        results.extend(data.get("results", []))

        next_page_token = data.get("next_page_token")
        if not next_page_token:
            break

        # Google requires a short delay before using next_page_token
        time.sleep(2.5)
        params = {"key": api_key, "pagetoken": next_page_token}

    return results


def _get_place_details(place_id: str, api_key: str) -> Dict:
    """Fetch detailed info for a place by place_id."""
    params = {
        "place_id": place_id,
        "key": api_key,
        "fields": ",".join([
            "name",
            "formatted_address",
            "formatted_phone_number",
            "international_phone_number",
            "website",
            "types",
            "geometry",
            "business_status",
            "opening_hours",
            "rating",
            "url",
        ]),
    }
    try:
        resp = requests.get(PLACES_DETAILS_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "OK":
            return data.get("result", {})
    except Exception as e:
        logger.warning(f"Place details fetch failed for {place_id}: {e}")
    return {}


def scrape() -> List[Dict[str, Any]]:
    """
    Use Google Places API to find property management companies and landlords near UofU.

    Returns:
        List of raw dicts with business info.
    """
    if not GOOGLE_PLACES_API_KEY:
        logger.error("GOOGLE_PLACES_API_KEY not set — skipping Google Maps scraper")
        return []

    # Estimate worst-case cost before making any calls:
    # len(queries) text searches + up to 20 results each = up to 20 detail calls per query
    estimated_text = len(PLACES_QUERIES)
    estimated_details = len(PLACES_QUERIES) * 20
    estimated_cost = (
        estimated_text * PLACES_TEXT_SEARCH_COST_PER_CALL
        + estimated_details * PLACES_DETAILS_COST_PER_CALL
    )
    if not _check_budget(estimated_cost):
        return []

    all_results: List[Dict[str, Any]] = []
    seen_place_ids: set = set()
    actual_text_calls = 0
    actual_detail_calls = 0

    for query in PLACES_QUERIES:
        logger.info(f"Google Places search: '{query}'")
        places = _text_search(query, GOOGLE_PLACES_API_KEY)
        actual_text_calls += 1
        logger.info(f"  Found {len(places)} places")

        for place in places:
            place_id = place.get("place_id")
            if not place_id or place_id in seen_place_ids:
                continue
            seen_place_ids.add(place_id)

            # Get full details
            details = _get_place_details(place_id, GOOGLE_PLACES_API_KEY)
            actual_detail_calls += 1
            if not details:
                details = place  # fallback to search result data

            name = details.get("name", "") or place.get("name", "")
            address = details.get("formatted_address", "") or place.get("formatted_address", "")
            phone = details.get("formatted_phone_number", "") or details.get("international_phone_number", "")
            website = details.get("website", "")
            types = details.get("types", [])
            maps_url = details.get("url", "")

            # Extract coordinates
            geo = details.get("geometry") or place.get("geometry", {})
            loc = (geo.get("location") or {}) if isinstance(geo, dict) else {}
            lat = loc.get("lat")
            lng = loc.get("lng")

            tier = _get_distance_tier(lat, lng)

            result = {
                "name": name,
                "address": address,
                "phone": phone,
                "website": website,
                "listing_url": maps_url or website,
                "lat": lat,
                "lng": lng,
                "distance_tier": tier,
                "types": ", ".join(types),
                "place_id": place_id,
                "source": "google_maps",
                "notes": f"Types: {', '.join(types)}",
            }

            # Extract social from website domain if it looks like a known platform
            social = {}
            if website:
                for platform in ["facebook.com", "instagram.com", "twitter.com", "linkedin.com"]:
                    if platform in website:
                        social[platform.split(".")[0]] = website
            result["social_media"] = social

            all_results.append(result)
            time.sleep(0.3)  # small pause between detail requests

        time.sleep(REQUEST_DELAY_MIN)

    cumulative = _record_spend(actual_text_calls, actual_detail_calls)
    run_cost = (
        actual_text_calls * PLACES_TEXT_SEARCH_COST_PER_CALL
        + actual_detail_calls * PLACES_DETAILS_COST_PER_CALL
    )
    logger.info(
        f"Google Maps: {len(all_results)} unique businesses found | "
        f"This run: ${run_cost:.4f} | Cumulative: ${cumulative:.4f} / ${GOOGLE_API_BUDGET_LIMIT_USD:.2f}"
    )
    if cumulative >= GOOGLE_API_BUDGET_LIMIT_USD * 0.9:
        logger.warning(
            "⚠️  Approaching budget limit — notify team to rotate API key before next run!"
        )
    return all_results
