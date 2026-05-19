"""
Data processor for UMarket Landlord Outreach Bot.
Handles deduplication, normalization, and distance tier tagging.
"""

import re
import logging
from typing import List, Optional, Dict, Any

try:
    import phonenumbers
    HAS_PHONENUMBERS = True
except ImportError:
    HAS_PHONENUMBERS = False

try:
    from haversine import haversine, Unit
    HAS_HAVERSINE = True
except ImportError:
    HAS_HAVERSINE = False

from data.models import Landlord
from config import (
    UOFU_LAT, UOFU_LNG,
    TIER_1_RADIUS_MILES, TIER_2_RADIUS_MILES
)

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)
PHONE_REGEX = re.compile(
    r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"
)


def extract_emails(text: str) -> List[str]:
    """Extract all email addresses from a block of text."""
    if not text:
        return []
    return EMAIL_REGEX.findall(text)


def extract_phones(text: str) -> List[str]:
    """Extract all phone numbers from a block of text."""
    if not text:
        return []
    return PHONE_REGEX.findall(text)


def normalize_phone(phone: str) -> Optional[str]:
    """
    Normalize a phone number string to (XXX) XXX-XXXX format.
    Returns None if the phone cannot be parsed.
    """
    if not phone:
        return None

    if HAS_PHONENUMBERS:
        try:
            parsed = phonenumbers.parse(phone, "US")
            if phonenumbers.is_valid_number(parsed):
                return phonenumbers.format_number(
                    parsed, phonenumbers.PhoneNumberFormat.NATIONAL
                )
        except Exception:
            pass

    # Fallback: strip to digits and format manually
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits[0] == "1":
        digits = digits[1:]
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return None


def normalize_email(email: str) -> Optional[str]:
    """Normalize an email address: lowercase and strip whitespace."""
    if not email:
        return None
    return email.strip().lower()


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in miles between two lat/lng points."""
    if HAS_HAVERSINE:
        return haversine((lat1, lng1), (lat2, lng2), unit=Unit.MILES)
    # Fallback: approximate haversine
    import math
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def get_distance_tier(lat: Optional[float], lng: Optional[float]) -> Optional[int]:
    """
    Return distance tier based on distance from UofU:
      1 = walking distance (<=1.5 miles)
      2 = broader SLC (<=5.0 miles)
      None = outside range or coords unavailable
    """
    if lat is None or lng is None:
        return None
    dist = haversine_miles(UOFU_LAT, UOFU_LNG, lat, lng)
    if dist <= TIER_1_RADIUS_MILES:
        return 1
    if dist <= TIER_2_RADIUS_MILES:
        return 2
    return None


def raw_dict_to_landlord(raw: Dict[str, Any], source: str) -> Landlord:
    """
    Convert a raw scraper dict to a Landlord object.
    Normalizes phone/email and tags distance tier.
    """
    name = raw.get("name") or raw.get("title") or raw.get("landlord") or "Unknown"
    company = raw.get("company") or raw.get("company_name")
    address = raw.get("address") or raw.get("location")
    listing_url = raw.get("listing_url") or raw.get("url")
    website = raw.get("website") or None   # actual company website
    notes = raw.get("notes")

    # Phone
    raw_phone = raw.get("phone") or raw.get("phone_number")
    if not raw_phone and raw.get("description"):
        phones = extract_phones(raw["description"])
        raw_phone = phones[0] if phones else None
    phone = normalize_phone(raw_phone) if raw_phone else None

    # Email
    raw_email = raw.get("email")
    if not raw_email and raw.get("description"):
        emails = extract_emails(raw["description"])
        raw_email = emails[0] if emails else None
    email = normalize_email(raw_email) if raw_email else None

    # Distance tier
    lat = raw.get("lat") or raw.get("latitude")
    lng = raw.get("lng") or raw.get("longitude")
    try:
        lat = float(lat) if lat is not None else None
        lng = float(lng) if lng is not None else None
    except (ValueError, TypeError):
        lat = lng = None
    tier = get_distance_tier(lat, lng)

    return Landlord(
        name=str(name).strip(),
        company=str(company).strip() if company else None,
        email=email,
        phone=phone,
        social_media=raw.get("social_media", {}),
        address=str(address).strip() if address else None,
        distance_tier=tier,
        source=source,
        listing_url=listing_url,
        website=website,
        notes=notes,
    )


def deduplicate(landlords: List[Landlord]) -> List[Landlord]:
    """
    Deduplicate Landlord list.
    Priority order: phone → email → name+address
    When merging, prefer the record with more data.
    """
    seen_phones: Dict[str, int] = {}   # normalized phone -> index in result
    seen_emails: Dict[str, int] = {}   # normalized email -> index in result
    seen_name_addr: Dict[str, int] = {}  # "name|address" -> index in result
    result: List[Landlord] = []

    for landlord in landlords:
        phone_key = landlord.phone  # already normalized
        email_key = landlord.email  # already normalized
        name_addr_key = None
        if landlord.name and landlord.address:
            name_addr_key = f"{landlord.name.lower()}|{landlord.address.lower()}"

        # Check for duplicates
        dup_idx = None
        if phone_key and phone_key in seen_phones:
            dup_idx = seen_phones[phone_key]
        elif email_key and email_key in seen_emails:
            dup_idx = seen_emails[email_key]
        elif name_addr_key and name_addr_key in seen_name_addr:
            dup_idx = seen_name_addr[name_addr_key]

        if dup_idx is not None:
            # Merge: fill in missing fields from the new record
            existing = result[dup_idx]
            existing.email = existing.email or landlord.email
            existing.phone = existing.phone or landlord.phone
            existing.company = existing.company or landlord.company
            existing.address = existing.address or landlord.address
            existing.listing_url = existing.listing_url or landlord.listing_url
            if landlord.distance_tier is not None and existing.distance_tier is None:
                existing.distance_tier = landlord.distance_tier
            # Merge social media
            for k, v in (landlord.social_media or {}).items():
                existing.social_media.setdefault(k, v)
            # Append sources
            sources = set()
            if existing.source:
                sources.update(existing.source.split(", "))
            if landlord.source:
                sources.add(landlord.source)
            existing.source = ", ".join(sorted(sources))
            logger.debug(f"Merged duplicate: {landlord.name} -> {existing.name}")
        else:
            idx = len(result)
            result.append(landlord)
            if phone_key:
                seen_phones[phone_key] = idx
            if email_key:
                seen_emails[email_key] = idx
            if name_addr_key:
                seen_name_addr[name_addr_key] = idx

    logger.info(f"Deduplication: {len(landlords)} -> {len(result)} records")
    return result


def process_raw_data(raw_records: List[Dict[str, Any]], source: str) -> List[Landlord]:
    """Convert raw scraper output to normalized Landlord objects."""
    landlords = []
    for raw in raw_records:
        try:
            landlord = raw_dict_to_landlord(raw, source)
            landlords.append(landlord)
        except Exception as e:
            logger.warning(f"Failed to process record from {source}: {e} | {raw}")
    return landlords


def process_all(all_raw: Dict[str, List[Dict[str, Any]]]) -> List[Landlord]:
    """
    Process all raw data from all scrapers and return deduplicated Landlord list.
    all_raw: {source_name: [raw_dict, ...], ...}
    """
    all_landlords: List[Landlord] = []
    for source, records in all_raw.items():
        logger.info(f"Processing {len(records)} records from {source}")
        landlords = process_raw_data(records, source)
        all_landlords.extend(landlords)

    return deduplicate(all_landlords)
