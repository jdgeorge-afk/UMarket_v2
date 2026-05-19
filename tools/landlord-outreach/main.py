#!/usr/bin/env python3
"""
UMarket Landlord Outreach Bot — Main Orchestrator

Usage:
  python main.py --scrape                # Run all scrapers, save raw JSON
  python main.py --process               # Process/dedup raw JSON
  python main.py --sheets                # Write processed data to Google Sheet
  python main.py --drafts                # Create Gmail drafts for landlords with email
  python main.py --drafts --dry-run      # Preview drafts without calling Gmail API
  python main.py --all                   # Run all steps in sequence
  python main.py --all --skip-zillow     # Run all steps, skip Zillow (avoids ToS risk)
  python main.py --stats                 # Print stats from processed data

Example full run:
  python main.py --all --skip-zillow
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")

# Resolve paths relative to this file
BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
PROCESSED_FILE = PROCESSED_DIR / "landlords.json"

RAW_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Step 1: Scrape
# ---------------------------------------------------------------------------

def run_scrape(skip_zillow: bool = False, detail_mode: bool = False, test_mode: bool = False) -> Dict[str, List[Dict]]:
    """Run all scrapers and save raw JSON files. Returns combined raw data dict."""
    from scrapers import craigslist, rentler, google_maps, county_records

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    all_raw: Dict[str, List[Dict]] = {}

    # --- Craigslist ---
    logger.info("=" * 60)
    logger.info("SCRAPER: Craigslist")
    logger.info("=" * 60)
    limit = 1 if test_mode else None

    try:
        cl_results = craigslist.scrape(fetch_details=detail_mode)
        cl_results = cl_results[:limit] if limit else cl_results
        all_raw["craigslist"] = cl_results
        _save_raw(cl_results, "craigslist", timestamp)
        logger.info(f"Craigslist: {len(cl_results)} listings")
    except Exception as e:
        logger.error(f"Craigslist scraper failed: {e}")
        all_raw["craigslist"] = []

    # --- Rentler ---
    logger.info("=" * 60)
    logger.info("SCRAPER: Rentler")
    logger.info("=" * 60)
    try:
        rentler_results = rentler.scrape(fetch_details=detail_mode)
        rentler_results = rentler_results[:limit] if limit else rentler_results
        all_raw["rentler"] = rentler_results
        _save_raw(rentler_results, "rentler", timestamp)
        logger.info(f"Rentler: {len(rentler_results)} listings")
    except Exception as e:
        logger.error(f"Rentler scraper failed: {e}")
        all_raw["rentler"] = []

    # --- Google Maps ---
    logger.info("=" * 60)
    logger.info("SCRAPER: Google Maps / Places API")
    logger.info("=" * 60)
    try:
        maps_results = google_maps.scrape()
        maps_results = maps_results[:limit] if limit else maps_results
        all_raw["google_maps"] = maps_results
        _save_raw(maps_results, "google_maps", timestamp)
        logger.info(f"Google Maps: {len(maps_results)} businesses")
    except Exception as e:
        logger.error(f"Google Maps scraper failed: {e}")
        all_raw["google_maps"] = []

    # --- County Records ---
    logger.info("=" * 60)
    logger.info("SCRAPER: Salt Lake County Assessor")
    logger.info("=" * 60)
    try:
        county_results = county_records.scrape()
        county_results = county_results[:limit] if limit else county_results
        all_raw["county_records"] = county_results
        _save_raw(county_results, "county_records", timestamp)
        logger.info(f"County Records: {len(county_results)} records")
    except Exception as e:
        logger.error(f"County records scraper failed: {e}")
        all_raw["county_records"] = []

    # --- Zillow (optional) ---
    if skip_zillow:
        logger.info("Skipping Zillow scraper (--skip-zillow flag set)")
        all_raw["zillow"] = []
    else:
        logger.info("=" * 60)
        logger.info("SCRAPER: Zillow (Selenium) — ToS WARNING applies")
        logger.info("=" * 60)
        try:
            from scrapers import apartments_zillow
            zillow_results = apartments_zillow.scrape()
            all_raw["zillow"] = zillow_results
            _save_raw(zillow_results, "zillow", timestamp)
            logger.info(f"Zillow: {len(zillow_results)} listings")
        except Exception as e:
            logger.error(f"Zillow scraper failed: {e}")
            all_raw["zillow"] = []

    # Save combined raw file
    combined_path = RAW_DIR / f"all_raw_{timestamp}.json"
    with open(combined_path, "w") as f:
        json.dump(all_raw, f, indent=2)
    logger.info(f"Raw data saved to {combined_path}")

    _print_scrape_summary(all_raw)
    return all_raw


def _save_raw(data: List[Dict], source: str, timestamp: str) -> None:
    path = RAW_DIR / f"{source}_{timestamp}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    logger.debug(f"Saved {len(data)} records to {path}")


def _print_scrape_summary(all_raw: Dict[str, List[Dict]]) -> None:
    logger.info("")
    logger.info("=" * 60)
    logger.info("SCRAPE SUMMARY")
    logger.info("=" * 60)
    total = 0
    for source, records in all_raw.items():
        count = len(records)
        total += count
        logger.info(f"  {source:20s}: {count:4d} records")
    logger.info(f"  {'TOTAL':20s}: {total:4d} records")
    logger.info("")


# ---------------------------------------------------------------------------
# Step 2: Process
# ---------------------------------------------------------------------------

def run_process(all_raw: Dict[str, List[Dict]] = None) -> List:
    """Load raw JSON (or use provided data), process/dedup, save to processed/landlords.json."""
    from data.processor import process_all
    from data.models import Landlord

    if all_raw is None:
        # Load most recent combined raw file
        raw_files = sorted(RAW_DIR.glob("all_raw_*.json"))
        if not raw_files:
            # Try loading individual source files and combining
            all_raw = {}
            for source_file in sorted(RAW_DIR.glob("*.json")):
                if "all_raw" not in source_file.name:
                    source_name = source_file.stem.rsplit("_", 2)[0]
                    with open(source_file) as f:
                        all_raw.setdefault(source_name, []).extend(json.load(f))
        else:
            latest = raw_files[-1]
            logger.info(f"Loading raw data from {latest}")
            with open(latest) as f:
                all_raw = json.load(f)

    if not all_raw:
        logger.error("No raw data found. Run --scrape first.")
        return []

    logger.info("Processing and deduplicating records...")
    landlords = process_all(all_raw)

    # Enrich with emails scraped from company websites
    logger.info("Enriching with emails from company websites...")
    from scrapers.website_email import enrich_with_emails
    landlords = enrich_with_emails(landlords)

    # Save processed data
    landlords_json = [l.to_dict() for l in landlords]
    with open(PROCESSED_FILE, "w") as f:
        json.dump(landlords_json, f, indent=2)
    logger.info(f"Saved {len(landlords)} processed landlords to {PROCESSED_FILE}")

    _print_process_summary(landlords)
    return landlords


def _print_process_summary(landlords) -> None:
    from collections import Counter

    logger.info("")
    logger.info("=" * 60)
    logger.info("PROCESS SUMMARY")
    logger.info("=" * 60)
    logger.info(f"  Total unique landlords: {len(landlords)}")

    tier_counts = Counter(l.distance_tier for l in landlords)
    logger.info(f"  Tier 1 (walking dist): {tier_counts.get(1, 0)}")
    logger.info(f"  Tier 2 (broader SLC):  {tier_counts.get(2, 0)}")
    logger.info(f"  Tier unknown:          {tier_counts.get(None, 0)}")

    with_email = sum(1 for l in landlords if l.email)
    with_phone = sum(1 for l in landlords if l.phone)
    logger.info(f"  With email address:    {with_email}")
    logger.info(f"  With phone number:     {with_phone}")
    logger.info(f"  With no contact info:  {sum(1 for l in landlords if not l.email and not l.phone)}")
    logger.info("")


# ---------------------------------------------------------------------------
# Step 3: Sheets
# ---------------------------------------------------------------------------

def run_sheets(landlords=None) -> None:
    """Write processed landlords to Google Sheet."""
    from sheets.writer import write_landlords, write_stats
    from data.models import Landlord

    if landlords is None:
        landlords = _load_processed_landlords()

    if not landlords:
        logger.error("No processed data. Run --process first.")
        return

    logger.info(f"Writing {len(landlords)} landlords to Google Sheet...")
    try:
        ws = write_landlords(landlords)
        write_stats(landlords)
        logger.info(f"Google Sheet updated: {ws.spreadsheet.url}")
    except Exception as e:
        logger.error(f"Google Sheets write failed: {e}")
        raise


# ---------------------------------------------------------------------------
# Step 4: Drafts
# ---------------------------------------------------------------------------

def run_drafts(landlords=None, dry_run: bool = False) -> None:
    """Create Gmail drafts for landlords with email addresses."""
    from outreach.template import generate_email
    from outreach.draft_creator import create_drafts_for_landlords
    from sheets.writer import write_landlords

    if landlords is None:
        landlords = _load_processed_landlords()

    if not landlords:
        logger.error("No processed data. Run --process first.")
        return

    # Generate email bodies for all landlords first
    logger.info("Generating personalized email drafts...")
    for landlord in landlords:
        if not landlord.email_draft:
            landlord.email_draft = generate_email(landlord)

    # Create Gmail drafts
    updated = create_drafts_for_landlords(landlords, dry_run=dry_run)

    # Update the Google Sheet with draft status
    if not dry_run:
        try:
            logger.info("Updating Google Sheet with draft status...")
            write_landlords(updated)
        except Exception as e:
            logger.warning(f"Could not update Sheet with draft status: {e}")

    # Save updated processed file
    from data.models import Landlord
    landlords_json = [l.to_dict() for l in updated]
    with open(PROCESSED_FILE, "w") as f:
        json.dump(landlords_json, f, indent=2)

    drafted = sum(1 for l in updated if l.outreach_status == "drafted")
    logger.info(f"Drafts created: {drafted}")


# ---------------------------------------------------------------------------
# Step 5: Stats
# ---------------------------------------------------------------------------

def run_stats() -> None:
    """Print stats from processed data."""
    landlords = _load_processed_landlords()
    if not landlords:
        logger.info("No processed data found. Run --process first.")
        return
    _print_process_summary(landlords)

    from collections import Counter
    logger.info("BY SOURCE:")
    source_counts = Counter(l.source or "unknown" for l in landlords)
    for source, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        logger.info(f"  {source:25s}: {count}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_processed_landlords():
    """Load processed landlords from JSON file."""
    from data.models import Landlord

    if not PROCESSED_FILE.exists():
        return []

    with open(PROCESSED_FILE) as f:
        raw = json.load(f)

    landlords = []
    for d in raw:
        try:
            landlords.append(Landlord.from_dict(d))
        except Exception as e:
            logger.warning(f"Could not deserialize landlord: {e}")
    return landlords


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="UMarket Landlord Outreach Bot",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--scrape", action="store_true",
        help="Run all scrapers and save raw JSON to data/raw/"
    )
    parser.add_argument(
        "--process", action="store_true",
        help="Process/dedup raw JSON and save to data/processed/landlords.json"
    )
    parser.add_argument(
        "--sheets", action="store_true",
        help="Write processed data to Google Sheet"
    )
    parser.add_argument(
        "--drafts", action="store_true",
        help="Create Gmail drafts for landlords with email addresses"
    )
    parser.add_argument(
        "--stats", action="store_true",
        help="Print stats from processed data"
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Run all steps: scrape → process → sheets → drafts"
    )
    parser.add_argument(
        "--skip-zillow", action="store_true",
        help="Skip the Zillow scraper (avoids ToS risk)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="For --drafts: generate email text but don't call Gmail API"
    )
    parser.add_argument(
        "--detail", action="store_true",
        help="For --scrape: visit each listing page to extract contact info (slower)"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable debug logging"
    )
    parser.add_argument(
        "--test", action="store_true",
        help="Test mode: limit each scraper to 1 result to verify the pipeline"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if not any([args.scrape, args.process, args.sheets, args.drafts, args.stats, args.all]):
        print(__doc__)
        sys.exit(0)

    start_time = time.time()
    all_raw = None
    landlords = None

    if args.all or args.scrape:
        all_raw = run_scrape(
            skip_zillow=args.skip_zillow,
            detail_mode=args.detail,
            test_mode=args.test,
        )

    if args.all or args.process:
        landlords = run_process(all_raw=all_raw)

    if args.all or args.sheets:
        run_sheets(landlords=landlords)

    if args.all or args.drafts:
        run_drafts(landlords=landlords, dry_run=args.dry_run)

    if args.stats:
        run_stats()

    elapsed = time.time() - start_time
    logger.info(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
