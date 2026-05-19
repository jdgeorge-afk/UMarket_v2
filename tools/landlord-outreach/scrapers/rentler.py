"""
Rentler.com scraper for Salt Lake City rental listings.
Extracts property name, landlord/company name, phone, email, address, and listing URL.
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
    RENTLER_BASE,
    MAX_PAGES,
    REQUEST_DELAY_MIN,
    REQUEST_DELAY_MAX,
    USER_AGENTS,
)

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}")

SEARCH_URL = "https://rentler.com/rent/slc"
SEARCH_API = "https://rentler.com/api/listings/search"


def _get_headers() -> Dict[str, str]:
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://rentler.com/",
    }


def _get_json_headers() -> Dict[str, str]:
    headers = _get_headers()
    headers["Accept"] = "application/json, text/javascript, */*"
    headers["X-Requested-With"] = "XMLHttpRequest"
    return headers


def _fetch_html(url: str, session: requests.Session) -> Optional[BeautifulSoup]:
    """Fetch a URL and return BeautifulSoup, or None on failure."""
    try:
        resp = session.get(url, headers=_get_headers(), timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        logger.warning(f"Rentler HTML fetch failed for {url}: {e}")
        return None


def _scrape_listing_detail(url: str, session: requests.Session) -> Dict[str, Any]:
    """
    Scrape a Rentler listing detail page for contact info.
    Returns dict with landlord name, company, phone, email fields.
    """
    result: Dict[str, Any] = {}
    soup = _fetch_html(url, session)
    if not soup:
        return result

    full_text = soup.get_text(" ", strip=True)

    # Phone extraction
    phones = PHONE_RE.findall(full_text)
    if phones:
        result["phone"] = phones[0]

    # Email extraction
    emails = EMAIL_RE.findall(full_text)
    if emails:
        result["email"] = emails[0]

    # Landlord/company name
    landlord_tag = (
        soup.find(class_="landlord-name")
        or soup.find(class_="contact-name")
        or soup.find(attrs={"data-landlord-name": True})
    )
    if landlord_tag:
        result["landlord"] = landlord_tag.get_text(strip=True)

    company_tag = soup.find(class_="company-name") or soup.find(class_="management-company")
    if company_tag:
        result["company"] = company_tag.get_text(strip=True)

    # Address
    address_tag = (
        soup.find(class_="listing-address")
        or soup.find(itemprop="streetAddress")
        or soup.find(class_="property-address")
    )
    if address_tag:
        result["address"] = address_tag.get_text(strip=True)

    return result


def _parse_search_card(card: BeautifulSoup) -> Optional[Dict[str, Any]]:
    """Parse a listing card from the search results page."""
    try:
        # Find the link to the detail page
        link_tag = card.find("a", href=True)
        if not link_tag:
            return None
        href = link_tag.get("href", "")
        if not href.startswith("http"):
            href = urljoin(RENTLER_BASE, href)

        # Property name / title
        title_tag = (
            card.find(class_="listing-title")
            or card.find(class_="property-name")
            or card.find("h2")
            or card.find("h3")
        )
        title = title_tag.get_text(strip=True) if title_tag else ""

        # Price
        price_tag = card.find(class_="price") or card.find(class_="listing-price")
        price = price_tag.get_text(strip=True) if price_tag else ""

        # Address
        addr_tag = (
            card.find(class_="listing-address")
            or card.find(class_="address")
            or card.find(itemprop="streetAddress")
        )
        address = addr_tag.get_text(strip=True) if addr_tag else ""

        return {
            "title": title or "Rentler Listing",
            "price": price,
            "address": address,
            "listing_url": href,
            "source": "rentler",
        }
    except Exception as e:
        logger.debug(f"Error parsing Rentler card: {e}")
        return None


def scrape(fetch_details: bool = True) -> List[Dict[str, Any]]:
    """
    Scrape Rentler.com for Salt Lake City listings.

    Args:
        fetch_details: If True, visit each listing page for contact info.

    Returns:
        List of raw dicts with property and landlord info.
    """
    session = requests.Session()
    all_results: List[Dict[str, Any]] = []
    seen_urls = set()

    logger.info("Scraping Rentler.com SLC listings...")

    for page in range(1, MAX_PAGES + 1):
        page_url = f"{SEARCH_URL}?page={page}"
        logger.debug(f"  Rentler page {page}: {page_url}")

        soup = _fetch_html(page_url, session)
        if not soup:
            logger.warning(f"  Failed to fetch Rentler page {page}")
            break

        # Try multiple selectors for listing cards
        cards = (
            soup.select(".listing-card")
            or soup.select(".property-card")
            or soup.select(".search-result-item")
            or soup.select("[data-listing-id]")
            or soup.select(".rental-listing")
        )

        if not cards:
            logger.info(f"  No listing cards found on Rentler page {page}, stopping")
            break

        page_results = []
        for card in cards:
            parsed = _parse_search_card(card)
            if parsed and parsed.get("listing_url") not in seen_urls:
                seen_urls.add(parsed["listing_url"])
                page_results.append(parsed)

        logger.info(f"  Found {len(page_results)} listings on page {page}")

        if fetch_details:
            for listing in page_results:
                detail_url = listing.get("listing_url")
                if detail_url:
                    detail = _scrape_listing_detail(detail_url, session)
                    # Merge detail info
                    if detail.get("landlord"):
                        listing["name"] = detail["landlord"]
                    if detail.get("company"):
                        listing["company"] = detail["company"]
                    if detail.get("phone"):
                        listing["phone"] = detail["phone"]
                    if detail.get("email"):
                        listing["email"] = detail["email"]
                    if detail.get("address") and not listing.get("address"):
                        listing["address"] = detail["address"]
                    time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

        all_results.extend(page_results)

        if len(cards) < 10:
            break  # Last page

        time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    logger.info(f"Rentler: total {len(all_results)} listings scraped")
    return all_results
