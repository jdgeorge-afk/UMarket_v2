"""
Data models for UMarket Landlord Outreach Bot.
"""

from dataclasses import dataclass, field
from typing import Optional, List
from dataclasses_json import dataclass_json


@dataclass_json
@dataclass
class Landlord:
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    social_media: dict = field(default_factory=dict)  # {platform: handle/url}
    address: Optional[str] = None
    distance_tier: Optional[int] = None  # 1 = walking distance, 2 = broader SLC, None = unknown
    source: Optional[str] = None
    listing_url: Optional[str] = None
    website: Optional[str] = None   # actual company website (used for email scraping)
    notes: Optional[str] = None
    outreach_status: str = "pending"  # pending, drafted, sent, responded
    email_draft: Optional[str] = None  # The full draft text

    def has_contact(self) -> bool:
        """Returns True if we have at least one way to contact this landlord."""
        return bool(self.email or self.phone)

    def display_name(self) -> str:
        """Returns the best available display name."""
        if self.company:
            return self.company
        return self.name

    def first_name(self) -> str:
        """Best-guess at first name for personalization."""
        if not self.name:
            return ""
        parts = self.name.strip().split()
        if parts:
            return parts[0].capitalize()
        return ""

    def to_sheet_row(self) -> list:
        """Convert to a list for writing to Google Sheets."""
        tier_label = {1: "Walking distance", 2: "Broader SLC", None: ""}.get(self.distance_tier, "")
        return [
            self.name or "",
            self.company or "",
            self.email or "",
            self.phone or "",
            tier_label,
            self.address or "",
            self.outreach_status or "pending",
            self.listing_url or self.website or "",
        ]

    @classmethod
    def sheet_headers(cls) -> list:
        return [
            "Name",
            "Company",
            "Email",
            "Phone",
            "Distance from UofU",
            "Address",
            "Outreach Status",
            "Listing / Website",
        ]
