#!/bin/bash
set -e

echo "======================================"
echo " UMarket Landlord Outreach Bot Setup"
echo "======================================"

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed. Download it from https://python.org"
    exit 1
fi

echo "Python version: $(python3 --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
pip3 install -r requirements.txt

# Copy .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "Created .env — open it and fill in your email and API key."
fi

# Create data directories
mkdir -p data/raw data/processed

echo ""
echo "======================================"
echo " Setup complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Open .env and set your GMAIL_USER and GOOGLE_PLACES_API_KEY"
echo "  2. Drop gmail_oauth_credentials.json into this folder"
echo "  3. Run: python3 main.py --all --skip-zillow"
echo ""
