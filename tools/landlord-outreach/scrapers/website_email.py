"""
Website contact scraper.
For each landlord that has a website but no email, visits their site
and scrapes the contact/about page for an email address.
"""

import re
import time
import logging
import random
from typing import Optional, List
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from config import USER_AGENTS

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Image/asset file extensions that get falsely matched as email local-parts
IMAGE_EXT_RE = re.compile(
    r"\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff?|avif|heic|mp4|mov|pdf|zip|js|css|json|xml|woff2?)$",
    re.IGNORECASE,
)

CONTACT_PATHS = [
    "/contact", "/contact-us", "/contactus", "/about", "/about-us",
    "/team", "/staff", "/info", "/reach-us", "/get-in-touch",
]

BLACKLISTED_DOMAINS = {
    # Error tracking / analytics
    "sentry.io", "sentry-next.wixpress.com", "errorception.com",
    "bugsnag.com", "rollbar.com", "logrocket.com", "datadog.com",
    "newrelic.com", "raygun.io", "trackjs.com",
    # Website builders / hosting (placeholder addresses)
    "wix.com", "wixpress.com", "wordpress.com", "squarespace.com",
    "weebly.com", "godaddy.com", "shopify.com", "webflow.io",
    # Generic placeholder domains
    "example.com", "yourdomain.com", "email.com", "domain.com",
    "placeholder.com", "test.com", "mysite.com",
    # Social / big tech (never a landlord contact)
    "google.com", "gmail.com", "facebook.com", "instagram.com",
    "twitter.com", "linkedin.com", "youtube.com", "tiktok.com",
    # Image CDNs commonly seen in alt text / filenames
    "cloudinary.com", "imgix.net", "wp.com",
}


def _get(url: str, timeout: int = 10) -> Optional[str]:
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    try:
        r = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    return None


def _is_fake_email(email: str) -> bool:
    """
    Return True if the address looks like a false positive rather than a real
    contact email.  Catches image filenames, error-tracker noise, etc.
    """
    local, _, domain = email.partition("@")

    # Reject if the local-part ends with an image/asset extension
    # e.g. "the-view-hero@3x-scaled.jpg" → local = "the-view-hero@3x-scaled", no — wait,
    # regex captures the whole token including the TLD-lookalike suffix, so check full email.
    if IMAGE_EXT_RE.search(email):
        return True

    # Reject if the local-part itself looks like a filename (contains a dot+ext before @)
    if re.search(r"\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff?)$", local, re.IGNORECASE):
        return True

    # Reject excessively long local parts (>64 chars per RFC, but we also catch garbage)
    if len(local) > 64:
        return True

    # Reject if the domain part looks like a path segment (contains /)
    if "/" in domain:
        return True

    # Reject if domain has no dot (not a valid TLD)
    if "." not in domain:
        return True

    return False


def _extract_emails(html: str, base_domain: str) -> List[str]:
    """Extract emails from HTML, filtered to plausible business addresses."""
    found = EMAIL_RE.findall(html)
    results = []
    for email in found:
        email = email.lower().strip(".")
        domain = email.split("@")[-1]
        if domain in BLACKLISTED_DOMAINS:
            continue
        if _is_fake_email(email):
            continue
        if base_domain and base_domain in domain:
            results.insert(0, email)  # same domain = higher priority
        else:
            results.append(email)
    # deduplicate preserving order
    seen = set()
    deduped = []
    for e in results:
        if e not in seen:
            seen.add(e)
            deduped.append(e)
    return deduped


def scrape_email_from_website(website_url: str) -> Optional[str]:
    """
    Visit a website and try to find a contact email.
    Checks the homepage first, then common contact page paths.
    Returns the best email found, or None.
    """
    if not website_url or not website_url.startswith("http"):
        return None

    parsed = urlparse(website_url)
    base_domain = parsed.netloc.replace("www.", "")

    # Try homepage first
    html = _get(website_url)
    if html:
        emails = _extract_emails(html, base_domain)
        if emails:
            logger.debug(f"Found email on homepage of {base_domain}: {emails[0]}")
            return emails[0]

    # Try common contact pages
    for path in CONTACT_PATHS:
        contact_url = urljoin(website_url, path)
        time.sleep(random.uniform(0.5, 1.2))
        html = _get(contact_url)
        if html:
            emails = _extract_emails(html, base_domain)
            if emails:
                logger.debug(f"Found email at {contact_url}: {emails[0]}")
                return emails[0]

    logger.debug(f"No email found on {base_domain}")
    return None


def enrich_with_emails(landlords: list) -> list:
    """
    For each landlord missing an email but with a website/listing_url,
    attempt to scrape their email from their website.
    Modifies landlords in place and returns the list.
    """
    candidates = [
        l for l in landlords
        if not l.email and (l.website or "").startswith("http")
    ]
    logger.info(f"Website email scraper: checking {len(candidates)} landlords without email")

    found = 0
    for landlord in candidates:
        email = scrape_email_from_website(landlord.website)
        if email:
            landlord.email = email
            found += 1
            logger.info(f"  Found email for {landlord.name}: {email}")
        time.sleep(random.uniform(1.0, 2.0))

    logger.info(f"Website email scraper: found emails for {found}/{len(candidates)} landlords")
    return landlords
