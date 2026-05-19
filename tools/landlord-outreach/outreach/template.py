"""
Email template generator for UMarket landlord outreach.
Generates personalized email drafts based on landlord data.
"""

from typing import Optional
from data.models import Landlord
from config import UMARKET_LANDING_PAGE, UMARKET_STUDENT_COUNT


def _salutation(landlord: Landlord) -> str:
    """Generate appropriate salutation."""
    if landlord.company and not landlord.name or landlord.name.lower() in ("unknown", "unknown owner", ""):
        return f"Hi {landlord.company} Team,"
    first = landlord.first_name()
    if first and first.lower() not in ("unknown", ""):
        return f"Hi {first},"
    if landlord.company:
        return f"Hi {landlord.company} Team,"
    return "Hi there,"


def _campus_proximity_line(landlord: Landlord) -> str:
    """Return a personalized line about proximity to campus if tier 1."""
    if landlord.distance_tier == 1:
        return (
            "Your property is walking distance from campus — "
            "listings like yours get the highest visibility on our platform."
        )
    return (
        "Salt Lake City is home to thousands of U students actively searching for housing."
    )


def generate_email(landlord: Landlord) -> str:
    """
    Generate a personalized outreach email for a landlord.
    Returns the full email body as a string.
    """
    salutation = _salutation(landlord)

    body = f"""{salutation}

I'm a student at the University of Utah and I've found the perfect spot for you to reach our student base! UMarket is a one-stop student housing platform built specifically for college students looking for rentals, subleases, and roommates.

In just our first week, we have over 150 active users and 2,000+ unique student visitors, all U of U students actively looking for housing in Salt Lake.

Listing your properties with us is free and takes less than two minutes. You'd be putting your vacancies directly in front of a verified student audience already searching for housing near campus. We'd love to have you join our community.

Check it out here: u-market.app

Feel free to reply if you have any questions!

Best,
UMarket

Built by students. For students.
"""
    return body.strip()


def generate_subject() -> str:
    """Return the standard email subject line."""
    return "Free Student Housing Listings — UMarket"


def preview_email(landlord: Landlord) -> str:
    """Return subject + body formatted for preview."""
    return f"Subject: {generate_subject()}\n\n{generate_email(landlord)}"
