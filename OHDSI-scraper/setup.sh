#!/usr/bin/env bash
# OHDSI Paper Harvester — Quick Start Setup
# Run this first to configure your environment

set -e

echo "=========================================="
echo "OHDSI Paper Harvester — Setup"
echo "=========================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 is required"
    exit 1
fi

echo "Python: $(python3 --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install requests beautifulsoup4 2>/dev/null || pip install requests beautifulsoup4 --break-system-packages 2>/dev/null

# Prompt for configuration
echo ""
echo "=== Configuration ==="
echo ""

if [ -z "$HARVESTER_EMAIL" ]; then
    read -p "Your email (required for API access): " email
    export HARVESTER_EMAIL="$email"
    echo "export HARVESTER_EMAIL=\"$email\"" >> .env
fi

echo ""
read -p "OpenAlex API key (optional, press Enter to skip): " openalex_key
if [ -n "$openalex_key" ]; then
    export OPENALEX_API_KEY="$openalex_key"
    echo "export OPENALEX_API_KEY=\"$openalex_key\"" >> .env
fi

read -p "NCBI API key (optional, press Enter to skip): " ncbi_key
if [ -n "$ncbi_key" ]; then
    export NCBI_API_KEY="$ncbi_key"
    echo "export NCBI_API_KEY=\"$ncbi_key\"" >> .env
fi

echo ""
echo "=== Configuration saved to .env ==="
echo ""
echo "To load configuration in future sessions:"
echo "  source .env"
echo ""
echo "=== Recommended Run Sequence ==="
echo ""
echo "1. Test with a small sample first:"
echo "   python harvester.py --author-limit 3 --email $HARVESTER_EMAIL"
echo ""
echo "2. Run metadata-only to see full scope:"
echo "   python harvester.py --skip-download --email $HARVESTER_EMAIL"
echo ""
echo "3. Full pipeline with downloads:"
echo "   python harvester.py --email $HARVESTER_EMAIL"
echo ""
echo "4. Resume from a specific phase if interrupted:"
echo "   python harvester.py --start-phase 3 --email $HARVESTER_EMAIL"
echo ""
echo "Setup complete!"
