"""
Zillow / Apartments.com Selenium-based scraper.

#############################################################################
# IMPORTANT TERMS OF SERVICE WARNING
#
# Zillow (zillow.com) and Apartments.com (apartments.com) explicitly PROHIBIT
# automated scraping in their Terms of Service:
#
#   Zillow ToS: https://www.zillow.com/z/corp/terms/
#     "You agree not to use any robot, spider, scraper, or other automated
#      means to access the Site for any purpose without our express written
#      permission."
#
#   Apartments.com ToS: https://www.apartments.com/terms-of-use/
#     Similar prohibitions on automated data collection.
#
# Using this scraper against those sites may:
#   - Result in your IP being permanently blocked
#   - Violate the Computer Fraud and Abuse Act (CFAA) or similar laws
#   - Expose you to civil liability
#
# USE AT YOUR OWN RISK. This code is provided for educational purposes only.
# Consider using Zillow's official API (https://www.zillow.com/howzillow/partners/)
# or the RentCafe / CoStar APIs as compliant alternatives.
#############################################################################

This module attempts to scrape Zillow rental listings near the University of Utah
using Selenium with headless Chrome. It will gracefully return an empty list if
blocked or if the structure changes.
"""

import time
import random
import logging
from typing import List, Dict, Any, Optional

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        TimeoutException,
        NoSuchElementException,
        WebDriverException,
    )
    from webdriver_manager.chrome import ChromeDriverManager
    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False

from config import (
    UOFU_LAT,
    UOFU_LNG,
    REQUEST_DELAY_MIN,
    REQUEST_DELAY_MAX,
    MAX_PAGES,
    USER_AGENTS,
)

logger = logging.getLogger(__name__)

ZILLOW_SEARCH_URL = (
    "https://www.zillow.com/university-of-utah-salt-lake-city-ut/rentals/"
    "?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A"
    "%22University%20of%20Utah%2C%20Salt%20Lake%20City%2C%20UT%22%7D"
)


def _build_driver() -> Optional[object]:
    """Build and return a headless Selenium Chrome driver."""
    if not HAS_SELENIUM:
        logger.error("Selenium not installed. Run: pip install selenium webdriver-manager")
        return None

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument(f"--user-agent={random.choice(USER_AGENTS)}")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")

    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        # Mask Selenium fingerprint
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        return driver
    except Exception as e:
        logger.error(f"Failed to initialize Chrome driver: {e}")
        return None


def _is_blocked(driver) -> bool:
    """Check if the current page is a block/CAPTCHA page."""
    page_source = driver.page_source.lower()
    block_signals = [
        "access denied",
        "captcha",
        "robot",
        "automated",
        "unusual traffic",
        "please verify",
        "cloudflare",
        "403 forbidden",
    ]
    title = driver.title.lower()
    return any(s in page_source or s in title for s in block_signals)


def _scrape_zillow_page(driver, page_num: int) -> List[Dict[str, Any]]:
    """
    Extract listing data from the currently loaded Zillow results page.
    Returns list of raw listing dicts.
    """
    results = []

    try:
        # Wait for listing cards to appear
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-test='property-card']"))
        )
    except TimeoutException:
        logger.debug("Zillow listing cards not found (timeout)")
        return results

    cards = driver.find_elements(By.CSS_SELECTOR, "[data-test='property-card']")
    if not cards:
        # Try alternative selectors
        cards = driver.find_elements(By.CSS_SELECTOR, ".list-card")
        if not cards:
            cards = driver.find_elements(By.CSS_SELECTOR, "article[data-test]")

    logger.debug(f"  Found {len(cards)} Zillow listing cards on page {page_num}")

    for card in cards:
        try:
            result: Dict[str, Any] = {"source": "zillow"}

            # Title / address
            try:
                addr = card.find_element(By.CSS_SELECTOR, "[data-test='property-card-addr']")
                result["address"] = addr.text.strip()
                result["title"] = addr.text.strip()
            except NoSuchElementException:
                try:
                    addr = card.find_element(By.CSS_SELECTOR, ".list-card-addr")
                    result["address"] = addr.text.strip()
                    result["title"] = addr.text.strip()
                except NoSuchElementException:
                    pass

            # Price
            try:
                price = card.find_element(By.CSS_SELECTOR, "[data-test='property-card-price']")
                result["price"] = price.text.strip()
            except NoSuchElementException:
                pass

            # Link to detail page
            try:
                link = card.find_element(By.CSS_SELECTOR, "a[data-test='property-card-link']")
                href = link.get_attribute("href") or ""
                result["listing_url"] = href
            except NoSuchElementException:
                try:
                    link = card.find_element(By.TAG_NAME, "a")
                    result["listing_url"] = link.get_attribute("href") or ""
                except NoSuchElementException:
                    pass

            # Agent/landlord name if visible
            for selector in [
                "[data-test='agent-name']",
                ".list-card-broker-name",
                ".agent-name",
                "[data-test='listing-agent-name']",
            ]:
                try:
                    agent = card.find_element(By.CSS_SELECTOR, selector)
                    result["name"] = agent.text.strip()
                    break
                except NoSuchElementException:
                    continue

            # Phone if shown
            for selector in [
                "[data-test='agent-phone']",
                ".list-card-phone",
                "[href^='tel:']",
            ]:
                try:
                    phone_el = card.find_element(By.CSS_SELECTOR, selector)
                    phone_text = phone_el.text.strip() or phone_el.get_attribute("href", "").replace("tel:", "")
                    if phone_text:
                        result["phone"] = phone_text
                    break
                except NoSuchElementException:
                    continue

            if result.get("address") or result.get("listing_url"):
                results.append(result)

        except Exception as e:
            logger.debug(f"Error parsing Zillow card: {e}")
            continue

    return results


def scrape() -> List[Dict[str, Any]]:
    """
    Scrape Zillow rental listings near the University of Utah using Selenium.

    Returns:
        List of raw listing dicts, or empty list if blocked/failed.
    """
    if not HAS_SELENIUM:
        logger.warning("Selenium unavailable — skipping Zillow scraper")
        return []

    logger.info("Starting Zillow scraper (Selenium/headless Chrome)...")
    logger.warning(
        "NOTE: Zillow's ToS prohibits automated scraping. "
        "This may be blocked. Proceeding with caution."
    )

    driver = _build_driver()
    if not driver:
        return []

    all_results: List[Dict[str, Any]] = []

    try:
        for page_num in range(1, MAX_PAGES + 1):
            if page_num == 1:
                url = ZILLOW_SEARCH_URL
            else:
                # Zillow uses URL-based pagination with _p suffix
                base = ZILLOW_SEARCH_URL.rstrip("/")
                url = f"{base}/{page_num}_p/"

            logger.info(f"  Zillow page {page_num}: {url}")

            try:
                driver.get(url)
            except WebDriverException as e:
                logger.warning(f"  Zillow page load failed: {e}")
                break

            time.sleep(random.uniform(3.0, 5.0))  # Allow dynamic content to load

            if _is_blocked(driver):
                logger.warning("  Zillow has blocked this request (CAPTCHA/block page). Stopping.")
                break

            page_results = _scrape_zillow_page(driver, page_num)
            logger.info(f"  Extracted {len(page_results)} listings from page {page_num}")

            if not page_results:
                logger.info("  No results on this page — stopping pagination")
                break

            all_results.extend(page_results)

            # Check for a "next page" button
            try:
                next_btn = driver.find_element(
                    By.CSS_SELECTOR, "[title='Next page'], [aria-label='Next page']"
                )
                if not next_btn.is_enabled():
                    logger.info("  No more pages (next button disabled)")
                    break
            except NoSuchElementException:
                logger.info("  No next page button found — stopping")
                break

            time.sleep(random.uniform(REQUEST_DELAY_MIN * 2, REQUEST_DELAY_MAX * 2))

    except Exception as e:
        logger.error(f"Zillow scraper encountered unexpected error: {e}")
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    logger.info(f"Zillow: total {len(all_results)} listings extracted")
    return all_results
