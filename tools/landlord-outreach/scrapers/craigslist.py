"""
Craigslist scraper for SLC housing listings.
Targets /search/apa (apartments) and /search/roo (rooms).
"""

import time
import random
import logging
import re
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlencode

import requests
from bs4 import BeautifulSoup

from config import (
    CRAIGSLIST_BASE,
    CRAIGSLIST_PATHS,
    MAX_PAGES,
    REQUEST_DELAY_MIN,
    REQUEST_DELAY_MAX,
    USER_AGENTS,
)

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}")


def _get_headers() -> Dict[str, str]:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }


def _fetch(url: str, session: requests.Session) -> Optional[BeautifulSoup]:
    """Fetch a URL and return a BeautifulSoup, or None on failure."""
    try:
        resp = session.get(url, headers=_get_headers(), timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        logger.warning(f"Craigslist fetch failed for {url}: {e}")
        return None


def _extract_listing_detail(url: str, session: requests.Session) -> Dict[str, Any]:
    """
    Visit an individual listing page to extract phone/email from the body text.
    Returns a dict with optional phone and email.
    """
    result: Dict[str, Any] = {}
    soup = _fetch(url, session)
    if not soup:
        return result

    body = soup.find("section", id="postingbody")
    text = body.get_text(" ", strip=True) if body else ""

    phones = PHONE_RE.findall(text)
    emails = EMAIL_RE.findall(text)
    if phones:
        result["phone"] = phones[0]
    if emails:
        result["email"] = emails[0]

    # Try to get reply-to email from the reply button
    reply_link = soup.find("a", class_="reply-button")
    if reply_link and reply_link.get("href", "").startswith("mailto:"):
        result["email"] = reply_link["href"].replace("mailto:", "")

    return result


def _parse_listing_row(item, base_url: str) -> Optional[Dict[str, Any]]:
    """Parse a single search-result listing row into a raw dict."""
    try:
        # Support both old and new Craigslist HTML structures
        title_tag = item.find("a", class_="posting-title") or item.find("a", class_="result-title")
        if not title_tag:
            return None

        title = title_tag.get_text(strip=True)
        listing_url = title_tag.get("href", "")
        if not listing_url.startswith("http"):
            listing_url = urljoin(base_url, listing_url)

        price_tag = item.find(class_="priceinfo") or item.find(class_="result-price")
        price = price_tag.get_text(strip=True) if price_tag else ""

        neighborhood_tag = (
            item.find(class_="posting-title")
            and item.find("span", class_="result-hood")
        )
        neighborhood = ""
        if neighborhood_tag:
            neighborhood = neighborhood_tag.get_text(strip=True).strip("() ")

        return {
            "title": title,
            "price": price,
            "location": neighborhood,
            "listing_url": listing_url,
            "source": "craigslist",
        }
    except Exception as e:
        logger.debug(f"Error parsing Craigslist row: {e}")
        return None


def scrape(fetch_details: bool = False) -> List[Dict[str, Any]]:
    """
    Scrape Craigslist SLC apartment and room listings.

    Args:
        fetch_details: If True, visit each listing page to extract contact info.
                       Slower but yields more phone/email data.

    Returns:
        List of raw dicts with listing info.
    """
    session = requests.Session()
    all_results: List[Dict[str, Any]] = []

    for path in CRAIGSLIST_PATHS:
        category = "apartments" if "apa" in path else "rooms"
        logger.info(f"Scraping Craigslist {category}...")

        for page in range(MAX_PAGES):
            params = {"sort": "date"}
            if page > 0:
                params["s"] = page * 120  # Craigslist uses 120-item pages

            url = f"{CRAIGSLIST_BASE}{path}?{urlencode(params)}"
            logger.debug(f"  Page {page + 1}: {url}")

            soup = _fetch(url, session)
            if not soup:
                break

            # Try new Craigslist structure first (2024+)
            items = soup.select("li.cl-search-result")
            if not items:
                # Fallback to older structure
                items = soup.select(".result-row")

            if not items:
                logger.debug(f"  No items found on page {page + 1}, stopping")
                break

            page_results = []
            for item in items:
                parsed = _parse_listing_row(item, CRAIGSLIST_BASE)
                if parsed:
                    page_results.append(parsed)

            logger.info(f"  Found {len(page_results)} listings on page {page + 1}")

            # Optionally fetch each listing for contact info
            if fetch_details:
                for listing in page_results:
                    url_detail = listing.get("listing_url", "")
                    if url_detail:
                        detail = _extract_listing_detail(url_detail, session)
                        listing.update(detail)
                    time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

            all_results.extend(page_results)

            if len(page_results) < 120:
                # Last page (fewer results than full page)
                break

            time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    logger.info(f"Craigslist: total {len(all_results)} listings scraped")
    return all_results
