"""
Central configuration for UMarket Landlord Outreach Bot.
Loads API keys and settings from environment variables.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# University of Utah coordinates
UOFU_LAT = 40.7649
UOFU_LNG = -111.8421

# Distance tiers
TIER_1_RADIUS_MILES = 1.5   # Walking distance to campus
TIER_2_RADIUS_MILES = 5.0   # Broader Salt Lake City area

# Target ZIP codes near University of Utah
TARGET_ZIPCODES = ["84102", "84105", "84108", "84112"]

# API credentials
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_SHEETS_CREDS_FILE = os.getenv("GOOGLE_SHEETS_CREDS_FILE", "credentials.json")
GMAIL_USER = os.getenv("GMAIL_USER", "umarket.i.team@gmail.com")

# Google Sheets config
SPREADSHEET_NAME = "UMarket Landlord Outreach"
MAIN_SHEET_NAME = "Landlords"
STATS_SHEET_NAME = "Stats"

# Scraper settings
REQUEST_DELAY_MIN = 1.0   # seconds between requests (min)
REQUEST_DELAY_MAX = 2.5   # seconds between requests (max)
MAX_PAGES = 5

# Craigslist config
CRAIGSLIST_BASE = "https://saltlakecity.craigslist.org"
CRAIGSLIST_PATHS = ["/search/apa", "/search/roo"]  # apartments, rooms

# Rentler config
RENTLER_BASE = "https://rentler.com"
RENTLER_SEARCH = "https://rentler.com/rent/slc"

# Google Places search queries
PLACES_QUERIES = [
    "property management company Salt Lake City Utah",
    "apartment complex University of Utah",
    "student housing Salt Lake City Utah",
    "rental property manager near University of Utah",
    "landlord apartments near University of Utah campus",
]

# County Assessor ZIP codes to search
COUNTY_ZIPCODES = ["84102", "84105", "84108", "84112"]

# User-Agent pool for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

# Email campaign
EMAIL_SUBJECT = "Partner with UMarket — Free Student Housing Listings (For Now)"
UMARKET_LANDING_PAGE = "https://u-market.app"
UMARKET_STUDENT_COUNT = "15,000+"

# Google Places API pricing (USD per 1,000 calls)
# https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
PLACES_TEXT_SEARCH_COST_PER_CALL = 0.032   # $32 / 1,000
PLACES_DETAILS_COST_PER_CALL = 0.017       # $17 / 1,000

# Budget guard — stop and warn before hitting this estimated spend (USD)
GOOGLE_API_BUDGET_LIMIT_USD = 280.0        # warn at $280, well under the $300 free credit
GOOGLE_API_COST_LOG = "data/google_api_spend.json"  # persists cumulative spend across runs
