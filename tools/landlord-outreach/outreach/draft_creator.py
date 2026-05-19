"""
Gmail draft creator for UMarket landlord outreach.
Uses Gmail API (google-api-python-client) with OAuth2 service account credentials
to create email drafts in the umarket.i.team@gmail.com inbox.

Setup notes:
  1. Enable Gmail API in Google Cloud Console for your project
  2. For service account access to Gmail, you must set up Domain-Wide Delegation
     OR use OAuth2 with user consent (recommended for a single Gmail account).
  3. Place credentials.json (OAuth2 client secret) in the project root.
  4. On first run, a browser window opens for consent; token is saved to token.json.
"""

import os
import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from data.models import Landlord
from outreach.template import generate_email, generate_subject
from config import GMAIL_USER, GOOGLE_SHEETS_CREDS_FILE

logger = logging.getLogger(__name__)

# Gmail OAuth2 scopes needed
GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.drafts",
]

TOKEN_FILE = "token.json"
# Use the OAuth2 client credentials file (different from service account)
# Default to "gmail_oauth_credentials.json" to distinguish from Sheets service account
GMAIL_OAUTH_CREDS_FILE = os.getenv("GMAIL_OAUTH_CREDS_FILE", "gmail_oauth_credentials.json")


def _get_gmail_service():
    """
    Authenticate and return a Gmail API service object.
    Uses OAuth2 with stored token; prompts for consent on first run.
    """
    creds: Optional[Credentials] = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, GMAIL_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                logger.warning(f"Token refresh failed: {e}. Re-authenticating.")
                creds = None

        if not creds:
            if not os.path.exists(GMAIL_OAUTH_CREDS_FILE):
                raise FileNotFoundError(
                    f"Gmail OAuth credentials file not found: {GMAIL_OAUTH_CREDS_FILE}\n"
                    "Download it from Google Cloud Console → APIs & Services → Credentials → "
                    "OAuth 2.0 Client IDs → Download JSON"
                )
            flow = InstalledAppFlow.from_client_secrets_file(GMAIL_OAUTH_CREDS_FILE, GMAIL_SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as token_file:
            token_file.write(creds.to_json())
        logger.info(f"Gmail OAuth token saved to {TOKEN_FILE}")

    service = build("gmail", "v1", credentials=creds)
    return service


def _build_mime_message(to: str, subject: str, body: str) -> str:
    """
    Build a MIME email message and return it base64url-encoded.
    """
    msg = MIMEMultipart("alternative")
    msg["From"] = GMAIL_USER
    msg["To"] = to
    msg["Subject"] = subject

    # Plain text part
    text_part = MIMEText(body, "plain", "utf-8")
    msg.attach(text_part)

    # HTML part — convert plain text to HTML and hyperlink u-market.app
    import re as _re
    html_body = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    html_body = html_body.replace("\n\n", "</p><p>").replace("\n", "<br>")
    # Make u-market.app a real clickable hyperlink
    html_body = _re.sub(
        r"(https?://u-market\.app\S*|u-market\.app\S*)",
        lambda m: f'<a href="https://{m.group(0).lstrip("https://")}">{m.group(0)}</a>',
        html_body,
    )
    html_body = (
        "<html><body style='font-family:Arial,sans-serif;font-size:14px;color:#222;'>"
        f"<p>{html_body}</p>"
        "</body></html>"
    )
    html_part = MIMEText(html_body, "html", "utf-8")
    msg.attach(html_part)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return raw


def create_draft(
    service,
    to_email: str,
    subject: str,
    body: str,
) -> Optional[Dict[str, Any]]:
    """
    Create a single Gmail draft.

    Args:
        service: Gmail API service object
        to_email: Recipient email address
        subject: Email subject line
        body: Email body text

    Returns:
        The created draft resource dict, or None on failure.
    """
    raw = _build_mime_message(to_email, subject, body)
    try:
        draft = service.users().drafts().create(
            userId="me",
            body={"message": {"raw": raw}},
        ).execute()
        logger.debug(f"Created draft for {to_email}: {draft.get('id')}")
        return draft
    except HttpError as e:
        logger.error(f"Gmail API error creating draft for {to_email}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error creating draft for {to_email}: {e}")
        return None


def create_drafts_for_landlords(
    landlords: List[Landlord],
    dry_run: bool = False,
) -> List[Landlord]:
    """
    Create Gmail drafts for all landlords that have an email address.
    Updates landlord.outreach_status to "drafted" and stores email body in landlord.email_draft.

    Args:
        landlords: List of Landlord objects to process
        dry_run: If True, generate the email text but don't actually call Gmail API

    Returns:
        The same list with outreach_status and email_draft populated.
    """
    # Deduplicate by email — only draft once per address even if multiple
    # landlord records share the same email (e.g. two listings from same company).
    seen_emails: dict = {}
    eligible = []
    skipped_dups = 0
    for l in landlords:
        if not l.email or l.outreach_status != "pending":
            continue
        key = l.email.strip().lower()
        if key in seen_emails:
            skipped_dups += 1
            logger.debug(f"  Skipping duplicate email {l.email} (already drafting for {seen_emails[key]})")
            # Mark the duplicate as drafted so it doesn't get re-processed next run
            l.outreach_status = "drafted"
        else:
            seen_emails[key] = l.name
            eligible.append(l)

    logger.info(
        f"Creating Gmail drafts for {len(eligible)} landlords "
        f"({skipped_dups} duplicate emails skipped, dry_run={dry_run})"
    )

    if not eligible:
        logger.info("No eligible landlords found (need email + pending status)")
        return landlords

    service = None
    if not dry_run:
        try:
            service = _get_gmail_service()
        except FileNotFoundError as e:
            logger.error(str(e))
            logger.info("Falling back to dry_run mode (email text generated but not sent)")
            dry_run = True
        except Exception as e:
            logger.error(f"Failed to initialize Gmail service: {e}")
            dry_run = True

    subject = generate_subject()
    drafted_count = 0
    failed_count = 0

    for landlord in eligible:
        body = generate_email(landlord)
        landlord.email_draft = body

        if dry_run:
            logger.info(f"  [DRY RUN] Would draft to: {landlord.email}")
            landlord.outreach_status = "drafted"
            drafted_count += 1
        else:
            draft = create_draft(service, landlord.email, subject, body)
            if draft:
                landlord.outreach_status = "drafted"
                drafted_count += 1
                logger.info(f"  Draft created for {landlord.email} (id={draft.get('id')})")
            else:
                failed_count += 1
                logger.warning(f"  Failed to create draft for {landlord.email}")

    logger.info(
        f"Draft creation complete: {drafted_count} created, "
        f"{failed_count} failed, "
        f"{len(landlords) - len(eligible)} skipped (no email or not pending)"
    )
    return landlords


def create_drafts_from_sheet(sheet_records: List[Dict[str, Any]], dry_run: bool = False) -> int:
    """
    Create Gmail drafts for landlords read from Google Sheets.
    Processes rows where 'Outreach Status' == 'pending' and 'Email' is not empty.

    Args:
        sheet_records: List of row dicts from gspread get_all_records()
        dry_run: If True, generate text but don't call Gmail API

    Returns:
        Number of drafts created.
    """
    # Convert sheet records to minimal Landlord objects
    landlords = []
    for row in sheet_records:
        email = (row.get("Email") or "").strip()
        status = (row.get("Outreach Status") or "pending").strip()
        if not email or status != "pending":
            continue

        name = row.get("Name") or "Unknown"
        company = row.get("Company") or None
        address = row.get("Address") or None
        tier_raw = row.get("Distance Tier")
        tier = int(tier_raw) if tier_raw and str(tier_raw).isdigit() else None

        # Use stored email draft if present, otherwise generate
        existing_draft = row.get("Email Draft") or None

        landlord = Landlord(
            name=str(name),
            company=company,
            email=email,
            address=address,
            distance_tier=tier,
            outreach_status=status,
            email_draft=existing_draft,
        )
        landlords.append(landlord)

    updated = create_drafts_for_landlords(landlords, dry_run=dry_run)
    return sum(1 for l in updated if l.outreach_status == "drafted")
