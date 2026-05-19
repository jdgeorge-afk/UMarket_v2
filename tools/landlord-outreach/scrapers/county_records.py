"""
Salt Lake County Assessor public records scraper.
Source: https://slco.org/assessor/

The SL County Assessor provides a public property search at:
  https://slco.org/assessor/

As of 2024, they offer:
  - A web-based property search (by address, owner, parcel)
  - No official public bulk-download CSV API (parcel data is sold to title companies)

This scraper uses the public search form to look up properties in target ZIP codes
and extract owner name and mailing address. We focus on residential parcels in
ZIP codes near the U of U: 84102, 84105, 84108, 84112.

Note: The county site may add CAPTCHA or rate-limiting. Requests are throttled
and the scraper gracefully handles failures.
"""

import time
import random
import logging
import re
from typing import List, Dict, Any, Optional

import requests
from bs4 import BeautifulSoup

from config import (
    COUNTY_ZIPCODES,
    REQUEST_DELAY_MIN,
    REQUEST_DELAY_MAX,
    USER_AGENTS,
    MAX_PAGES,
)

logger = logging.getLogger(__name__)

ASSESSOR_BASE = "https://slco.org/assessor"
# Public parcel query endpoint (form-based search)
ASSESSOR_SEARCH_URL = "https://slco.org/assessor/new/search.cfm"
# Alternative: iasWorld public access portal used by many Utah counties
IASWORLD_BASE = "https://slco.org/assessor/new"

# Street name samples for ZIP code searches (we search by ZIP + address range)
# The assessor search doesn't support plain ZIP-code-only queries, so we search
# common street names in each neighborhood and paginate.
UNIVERSITY_STREETS = [
    "University",
    "Campus",
    "Presidents Circle",
    "Wasatch",
    "1300 E",
    "1100 E",
    "900 E",
    "700 E",
    "500 S",
    "400 S",
    "200 S",
    "900 S",
]

MAX_RESULTS_PER_SEARCH = 50  # Cap per street to avoid enormous scrapes


def _get_headers() -> Dict[str, str]:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": ASSESSOR_BASE,
    }


def _search_by_address(street: str, session: requests.Session) -> List[Dict[str, Any]]:
    """
    Search the county assessor for properties on a given street.
    Returns list of dicts with owner_name, address, parcel_id.
    """
    results = []
    params = {
        "StreetName": street,
        "submit": "Search",
    }
    try:
        resp = session.get(
            ASSESSOR_SEARCH_URL,
            params=params,
            headers=_get_headers(),
            timeout=20,
        )
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"County assessor search failed for '{street}': {e}")
        return results

    soup = BeautifulSoup(resp.text, "lxml")

    # Parse the results table (structure varies by county site version)
    table = soup.find("table", id="searchResults") or soup.find("table", class_="results")
    if not table:
        # Try to find any table with parcel data
        tables = soup.find_all("table")
        for t in tables:
            headers_row = t.find("tr")
            if headers_row:
                header_text = headers_row.get_text().lower()
                if "owner" in header_text or "parcel" in header_text:
                    table = t
                    break

    if not table:
        logger.debug(f"No results table found for street '{street}'")
        return results

    rows = table.find_all("tr")[1:]  # skip header row
    for row in rows[:MAX_RESULTS_PER_SEARCH]:
        cells = row.find_all("td")
        if len(cells) < 2:
            continue
        cell_texts = [c.get_text(strip=True) for c in cells]

        # Try to identify columns by position / content
        parcel_id = ""
        owner_name = ""
        address = ""

        for i, text in enumerate(cell_texts):
            # Parcel IDs look like "12-34-567-890"
            if re.match(r"\d{2}-\d{2}-\d{3}-\d{3,4}", text):
                parcel_id = text
            # Owner names are typically ALL CAPS
            elif text.isupper() and len(text) > 4 and not any(c.isdigit() for c in text[:3]):
                owner_name = text
            # Address usually has digits + street
            elif re.search(r"\d+\s+\w+", text) and not address:
                address = text

        if owner_name or parcel_id:
            # Check if it's likely a rental (not LLC / Trust / Corp = corporate landlord)
            # or individual owner (may be a small landlord)
            link = row.find("a", href=True)
            detail_url = ""
            if link:
                href = link["href"]
                if not href.startswith("http"):
                    detail_url = f"{ASSESSOR_BASE}/{href.lstrip('/')}"
                else:
                    detail_url = href

            results.append({
                "name": owner_name or "Unknown Owner",
                "parcel_id": parcel_id,
                "address": address,
                "listing_url": detail_url,
                "source": "county_records",
            })

    return results


def _search_by_zip(zipcode: str, session: requests.Session) -> List[Dict[str, Any]]:
    """
    Search county records for a given ZIP code via the assessor search form.
    Falls back to street-by-street searches since ZIP-only isn't always supported.
    """
    results = []
    params = {
        "Zip": zipcode,
        "submit": "Search",
    }
    try:
        resp = session.get(
            ASSESSOR_SEARCH_URL,
            params=params,
            headers=_get_headers(),
            timeout=20,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        table = soup.find("table", id="searchResults") or soup.find("table", class_="results")
        if table:
            rows = table.find_all("tr")[1:]
            for row in rows[:100]:
                cells = row.find_all("td")
                if len(cells) < 2:
                    continue
                cell_texts = [c.get_text(strip=True) for c in cells]
                link = row.find("a", href=True)
                detail_url = ""
                if link:
                    href = link["href"]
                    if not href.startswith("http"):
                        detail_url = f"{ASSESSOR_BASE}/{href.lstrip('/')}"
                    else:
                        detail_url = href

                # Guess columns: typically parcel | address | owner | value
                owner_name = ""
                address = ""
                for text in cell_texts:
                    if text.isupper() and len(text) > 4 and not any(c.isdigit() for c in text[:3]):
                        owner_name = text
                    elif re.search(r"\d+\s+\w+", text) and not address:
                        address = text

                if owner_name:
                    results.append({
                        "name": owner_name,
                        "address": address,
                        "listing_url": detail_url,
                        "source": "county_records",
                    })

    except Exception as e:
        logger.warning(f"County assessor ZIP search failed for {zipcode}: {e}")

    return results


def scrape() -> List[Dict[str, Any]]:
    """
    Scrape Salt Lake County Assessor for property owners in target ZIP codes.

    Strategy:
    1. Try ZIP-code based search for each target ZIP
    2. Fall back to street-name searches for University-area streets

    Returns:
        List of raw dicts with owner name, address, parcel info.
    """
    session = requests.Session()
    all_results: List[Dict[str, Any]] = []
    seen_parcels: set = set()

    logger.info("Scraping Salt Lake County Assessor records...")

    # Method 1: ZIP code searches
    for zipcode in COUNTY_ZIPCODES:
        logger.info(f"  Searching ZIP {zipcode}...")
        records = _search_by_zip(zipcode, session)
        for r in records:
            key = r.get("parcel_id") or (r.get("name", "") + r.get("address", ""))
            if key and key not in seen_parcels:
                seen_parcels.add(key)
                all_results.append(r)
        logger.info(f"  Found {len(records)} records for ZIP {zipcode}")
        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    # Method 2: Street-name searches (adds coverage if ZIP search is limited)
    for street in UNIVERSITY_STREETS:
        logger.info(f"  Searching street '{street}'...")
        records = _search_by_address(street, session)
        added = 0
        for r in records:
            key = r.get("parcel_id") or (r.get("name", "") + r.get("address", ""))
            if key and key not in seen_parcels:
                seen_parcels.add(key)
                all_results.append(r)
                added += 1
        logger.info(f"  Found {len(records)} records ({added} new) for '{street}'")
        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    logger.info(f"County Records: total {len(all_results)} unique records scraped")
    return all_results
