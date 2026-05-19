# UMarket Landlord Outreach Bot

Scrapes landlord contact info near the University of Utah, populates a Google Sheet, and creates personalized Gmail drafts ready to send.

---

## Intern Setup Guide

### What you need from Rian before starting
- The **Google Places API key**
- The **`gmail_oauth_credentials.json`** file

Put both in a safe place — you'll use them in the steps below.

---

### Step 1 — Clone the repo

Open Terminal and run:

```bash
git clone https://github.com/jdgeorge-afk/UMarket_v2.git
cd UMarket_v2/tools/landlord-outreach
```

---

### Step 2 — Run the setup script

```bash
bash setup.sh
```

This installs all dependencies and creates your `.env` file automatically.

---

### Step 3 — Fill in your `.env` file

Open the `.env` file (it's in the `landlord-outreach` folder) in any text editor and fill in:

```
GOOGLE_PLACES_API_KEY=   ← paste the key Rian gave you
GMAIL_USER=              ← your own Gmail address (drafts will appear here)
```

---

### Step 4 — Drop in the credentials file

Copy the `gmail_oauth_credentials.json` file Rian gave you into the `landlord-outreach` folder.

---

### Step 5 — Run the bot

```bash
python3 main.py --all --skip-zillow
```

The first time you run it, a browser window will open asking you to sign into your Google account and grant permission. Do that once — it saves a token and never asks again.

When it finishes you'll see:
- A **Google Sheet** in your Google Drive called "UMarket Landlord Outreach"
- **Gmail drafts** in your inbox, one per landlord with an email — just click Send

---

### Running it again later

```bash
python3 main.py --all --skip-zillow
```

It automatically skips landlords already in the sheet and only drafts new ones.

---

### Common commands

| Command | What it does |
|---|---|
| `python3 main.py --all --skip-zillow` | Full run (recommended) |
| `python3 main.py --scrape --skip-zillow` | Scrape only, no sheet/drafts |
| `python3 main.py --sheets` | Push data to Sheet only |
| `python3 main.py --drafts` | Create Gmail drafts only |
| `python3 main.py --stats` | Print summary stats |

---

### Questions?

Ask Rian or message the team Slack.
