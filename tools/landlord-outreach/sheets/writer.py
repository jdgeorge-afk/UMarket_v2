"""
Google Sheets writer for UMarket Landlord Outreach Bot.
Creates a clean, formatted spreadsheet auto-populated with landlord contact info.
"""

import os
import logging
from typing import List, Dict, Any
from collections import Counter

import gspread
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from gspread_formatting import (
    CellFormat, TextFormat, Color, format_cell_range,
    set_frozen, set_column_width, ConditionalFormatRule,
    GridRange, BooleanRule, BooleanCondition, get_conditional_format_rules,
)

from data.models import Landlord
from config import SPREADSHEET_NAME, MAIN_SHEET_NAME, STATS_SHEET_NAME, GMAIL_USER

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.drafts",
]

OAUTH_CREDS_FILE = "gmail_oauth_credentials.json"
TOKEN_FILE = "token.json"

# ── Colours ──────────────────────────────────────────────────────────────────
HEADER_BG      = Color(0.122, 0.165, 0.38)   # deep navy
HEADER_FG      = Color(1, 1, 1)               # white
TIER1_BG       = Color(0.878, 0.961, 0.878)   # light green  (near campus)
TIER2_BG       = Color(0.878, 0.929, 0.980)   # light blue   (broader SLC)
ALT_BG         = Color(0.969, 0.969, 0.969)   # light grey alternating rows
STATUS_PENDING = Color(1.0,   0.949, 0.8)     # warm yellow
STATUS_DRAFTED = Color(0.8,   0.878, 1.0)     # soft blue
STATUS_SENT    = Color(0.8,   1.0,   0.878)   # soft green
STATUS_RESPONDED = Color(0.6, 0.929, 0.686)   # stronger green

# Column widths in pixels  (8 columns: A-H)
COL_WIDTHS = {
    "A": 180,  # Name
    "B": 200,  # Company
    "C": 230,  # Email
    "D": 150,  # Phone
    "E": 150,  # Distance from UofU
    "F": 260,  # Address
    "G": 130,  # Outreach Status
    "H": 280,  # Listing / Website
}


def _get_client() -> gspread.Client:
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(OAUTH_CREDS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return gspread.authorize(creds)


def _open_or_create_spreadsheet(client: gspread.Client) -> gspread.Spreadsheet:
    try:
        ss = client.open(SPREADSHEET_NAME)
        logger.info(f"Opened existing spreadsheet: {SPREADSHEET_NAME}")
        return ss
    except gspread.SpreadsheetNotFound:
        logger.info(f"Creating new spreadsheet: {SPREADSHEET_NAME}")
        ss = client.create(SPREADSHEET_NAME)
        logger.info(f"Spreadsheet created in {GMAIL_USER}'s Drive")
        return ss


def _ensure_sheet(ss: gspread.Spreadsheet, title: str) -> gspread.Worksheet:
    try:
        return ss.worksheet(title)
    except gspread.WorksheetNotFound:
        return ss.add_worksheet(title=title, rows=2000, cols=20)


def _apply_header_format(ws: gspread.Worksheet) -> None:
    """Bold navy header row with white text."""
    fmt = CellFormat(
        backgroundColor=HEADER_BG,
        textFormat=TextFormat(bold=True, foregroundColor=HEADER_FG, fontSize=11),
        horizontalAlignment="CENTER",
    )
    format_cell_range(ws, "A1:H1", fmt)
    set_frozen(ws, rows=1)


def _apply_column_widths(ws: gspread.Worksheet) -> None:
    for col, width in COL_WIDTHS.items():
        try:
            set_column_width(ws, col, width)
        except Exception:
            pass


def _apply_status_conditional_formats(ws: gspread.Worksheet) -> None:
    """Color the Outreach Status column (I) based on value."""
    rules = get_conditional_format_rules(ws)
    rules.clear()

    status_col_index = 8  # 0-indexed, column I
    sheet_id = ws.id

    def make_rule(value: str, bg: Color) -> ConditionalFormatRule:
        return ConditionalFormatRule(
            ranges=[GridRange.from_a1_range("G2:G2000", ws)],  # Outreach Status = col G
            booleanRule=BooleanRule(
                condition=BooleanCondition("TEXT_EQ", [value]),
                format=CellFormat(backgroundColor=bg),
            ),
        )

    rules.append(make_rule("pending",   STATUS_PENDING))
    rules.append(make_rule("drafted",   STATUS_DRAFTED))
    rules.append(make_rule("sent",      STATUS_SENT))
    rules.append(make_rule("responded", STATUS_RESPONDED))
    rules.save()


def _format_data_rows(ws: gspread.Worksheet, num_rows: int) -> None:
    """Apply base font and wrap to all data rows."""
    if num_rows < 1:
        return
    fmt = CellFormat(
        textFormat=TextFormat(fontSize=10),
        wrapStrategy="CLIP",
    )
    format_cell_range(ws, f"A2:H{num_rows + 1}", fmt)

    # Make email and URL columns blue/underlined to look clickable
    link_fmt = CellFormat(
        textFormat=TextFormat(
            fontSize=10,
            foregroundColor=Color(0.13, 0.37, 0.78),
        )
    )
    format_cell_range(ws, f"C2:C{num_rows + 1}", link_fmt)  # Email
    format_cell_range(ws, f"H2:H{num_rows + 1}", link_fmt)  # Listing / Website


def _get_existing_keys(ws: gspread.Worksheet) -> Dict[str, int]:
    keys: Dict[str, int] = {}
    try:
        records = ws.get_all_values()
    except Exception:
        return keys
    if len(records) < 2:
        return keys
    headers = [h.lower() for h in records[0]]
    email_col = headers.index("email") if "email" in headers else None
    phone_col = headers.index("phone") if "phone" in headers else None
    for row_idx, row in enumerate(records[1:], start=2):
        if email_col is not None and email_col < len(row) and row[email_col]:
            keys[row[email_col].strip().lower()] = row_idx
        if phone_col is not None and phone_col < len(row) and row[phone_col]:
            keys[row[phone_col].strip()] = row_idx
    return keys


def write_landlords(landlords: List[Landlord]) -> gspread.Worksheet:
    """
    Write landlords to the Google Sheet with full formatting.
    Creates the sheet if it doesn't exist, appends new rows, skips duplicates.
    """
    client = _get_client()
    ss = _open_or_create_spreadsheet(client)

    # Get or create main worksheet
    existing = [ws.title for ws in ss.worksheets()]
    if MAIN_SHEET_NAME not in existing:
        if "Sheet1" in existing:
            ws = ss.worksheet("Sheet1")
            ws.update_title(MAIN_SHEET_NAME)
        else:
            ws = _ensure_sheet(ss, MAIN_SHEET_NAME)
    else:
        ws = ss.worksheet(MAIN_SHEET_NAME)

    # Write headers if empty
    if not ws.acell("A1").value:
        ws.append_row(Landlord.sheet_headers(), value_input_option="RAW")
        _apply_header_format(ws)
        _apply_column_widths(ws)
        _apply_status_conditional_formats(ws)
        logger.info("Sheet initialized with headers and formatting")

    existing_keys = _get_existing_keys(ws)
    new_rows = []

    for landlord in landlords:
        email_key = (landlord.email or "").strip().lower()
        phone_key = (landlord.phone or "").strip()
        if existing_keys.get(email_key) or existing_keys.get(phone_key):
            continue
        new_rows.append(landlord.to_sheet_row())
        if email_key:
            existing_keys[email_key] = -1
        if phone_key:
            existing_keys[phone_key] = -1

    if new_rows:
        ws.append_rows(new_rows, value_input_option="USER_ENTERED")
        total_rows = len(ws.get_all_values())
        _format_data_rows(ws, total_rows - 1)
        logger.info(f"Added {len(new_rows)} new landlords to sheet")
    else:
        logger.info("No new landlords to add (all already in sheet)")

    logger.info(f"Sheet URL: https://docs.google.com/spreadsheets/d/{ss.id}")
    return ws


def write_stats(landlords: List[Landlord]) -> gspread.Worksheet:
    client = _get_client()
    ss = _open_or_create_spreadsheet(client)
    stats_ws = _ensure_sheet(ss, STATS_SHEET_NAME)
    stats_ws.clear()

    rows = [["UMarket Landlord Outreach — Stats"], [""]]
    rows.append(["SOURCE", "Count"])
    for src, cnt in sorted(Counter(l.source or "unknown" for l in landlords).items(), key=lambda x: -x[1]):
        rows.append([src, cnt])
    rows += [["TOTAL", len(landlords)], [""]]
    rows.append(["DISTANCE TIER", "Count"])
    for tier, cnt in sorted(Counter(l.distance_tier for l in landlords).items(), key=lambda x: (x[0] is None, x[0])):
        label = {1: "Tier 1 (≤1.5mi)", 2: "Tier 2 (≤5mi)", None: "Unknown"}.get(tier, str(tier))
        rows.append([label, cnt])
    rows += [[""], ["CONTACT INFO", "Count"]]
    rows.append(["Has email",  sum(1 for l in landlords if l.email)])
    rows.append(["Has phone",  sum(1 for l in landlords if l.phone)])
    rows.append(["Has both",   sum(1 for l in landlords if l.email and l.phone)])
    rows.append(["No contact", sum(1 for l in landlords if not l.email and not l.phone)])

    stats_ws.update("A1", rows, value_input_option="USER_ENTERED")

    fmt = CellFormat(backgroundColor=HEADER_BG, textFormat=TextFormat(bold=True, foregroundColor=HEADER_FG, fontSize=11))
    for cell in ["A1", "A3", "A9", "A12"]:
        try:
            format_cell_range(stats_ws, cell, fmt)
        except Exception:
            pass
    try:
        set_frozen(stats_ws, rows=0)  # no frozen rows on stats sheet
    except Exception:
        pass

    logger.info("Stats sheet updated")
    return stats_ws
