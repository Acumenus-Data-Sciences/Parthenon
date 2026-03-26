#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# darkstar-version-check.sh — HADES Package Version Audit
#
# Compares installed HADES package versions in the Darkstar container
# against the latest available on CRAN and OHDSI r-universe.
#
# Usage:
#   ./scripts/darkstar-version-check.sh            # Compare installed vs latest
#   ./scripts/darkstar-version-check.sh --update    # Show Dockerfile update commands
#
# Schedule: Run monthly or when OHDSI announces releases at
#   https://forums.ohdsi.org/t/hades-development-announcements/12293
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="parthenon-darkstar"
UPDATE_MODE="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Check container is running ────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo -e "${RED}ERROR: ${CONTAINER} is not running.${NC}"
    echo "Start it with: docker compose up -d darkstar"
    exit 1
fi

echo -e "${CYAN}=== Darkstar HADES Package Version Audit ===${NC}"
echo ""

# ── Get installed versions from container ─────────────────────────
echo -e "${CYAN}Querying installed packages in ${CONTAINER}...${NC}"

INSTALLED=$(docker exec "$CONTAINER" Rscript -e '
pkgs <- c(
    "SqlRender", "DatabaseConnector", "Andromeda", "Cyclops",
    "FeatureExtraction", "ResultModelManager", "EmpiricalCalibration",
    "ParallelLogger", "CohortMethod", "PatientLevelPrediction",
    "SelfControlledCaseSeries", "EvidenceSynthesis", "CohortGenerator",
    "CohortDiagnostics", "DeepPatientLevelPrediction", "CohortIncidence",
    "Characterization", "Strategus", "ETLSyntheaBuilder",
    "DataQualityDashboard"
)
installed <- installed.packages()
for (pkg in pkgs) {
    ver <- if (pkg %in% rownames(installed)) installed[pkg, "Version"] else "NOT_INSTALLED"
    cat(sprintf("%s|%s\n", pkg, ver))
}
')

# ── Get latest CRAN versions ─────────────────────────────────────
echo -e "${CYAN}Checking latest CRAN versions...${NC}"

CRAN_VERSIONS=$(docker exec "$CONTAINER" Rscript -e '
pkgs <- c(
    "SqlRender", "DatabaseConnector", "Andromeda", "Cyclops",
    "FeatureExtraction", "ResultModelManager", "EmpiricalCalibration",
    "ParallelLogger", "CohortMethod", "PatientLevelPrediction",
    "SelfControlledCaseSeries", "EvidenceSynthesis", "CohortGenerator",
    "CohortDiagnostics", "DeepPatientLevelPrediction", "CohortIncidence",
    "Characterization", "Strategus", "ETLSyntheaBuilder",
    "DataQualityDashboard"
)
repos <- c(OHDSI = "https://ohdsi.r-universe.dev", CRAN = "https://cloud.r-project.org")
avail <- available.packages(repos = repos)
for (pkg in pkgs) {
    ver <- if (pkg %in% rownames(avail)) avail[pkg, "Version"] else "NOT_FOUND"
    cat(sprintf("%s|%s\n", pkg, ver))
}
')

# ── Compare and display ──────────────────────────────────────────
echo ""
printf "${CYAN}%-30s %-12s %-12s %s${NC}\n" "Package" "Installed" "Latest" "Status"
printf "%-30s %-12s %-12s %s\n" "──────────────────────────────" "────────────" "────────────" "──────────"

NEEDS_UPDATE=()

while IFS='|' read -r pkg installed_ver; do
    # Find matching latest version
    latest_ver=$(echo "$CRAN_VERSIONS" | grep "^${pkg}|" | cut -d'|' -f2)
    latest_ver="${latest_ver:-NOT_FOUND}"

    # Trim whitespace
    installed_ver=$(echo "$installed_ver" | tr -d '[:space:]')
    latest_ver=$(echo "$latest_ver" | tr -d '[:space:]')

    if [ "$installed_ver" = "NOT_INSTALLED" ]; then
        status="${YELLOW}NOT INSTALLED${NC}"
        NEEDS_UPDATE+=("$pkg|$installed_ver|$latest_ver|new")
    elif [ "$latest_ver" = "NOT_FOUND" ]; then
        status="${YELLOW}GitHub-only${NC}"
    elif [ "$installed_ver" = "$latest_ver" ]; then
        status="${GREEN}Up to date${NC}"
    else
        # Compare major versions
        installed_major=$(echo "$installed_ver" | cut -d. -f1)
        latest_major=$(echo "$latest_ver" | cut -d. -f1)
        if [ "$installed_major" != "$latest_major" ]; then
            status="${RED}MAJOR UPDATE${NC}"
            NEEDS_UPDATE+=("$pkg|$installed_ver|$latest_ver|major")
        else
            status="${YELLOW}Needs update${NC}"
            NEEDS_UPDATE+=("$pkg|$installed_ver|$latest_ver|minor")
        fi
    fi

    printf "%-30s %-12s %-12s %b\n" "$pkg" "$installed_ver" "$latest_ver" "$status"
done <<< "$INSTALLED"

echo ""

# ── Summary ───────────────────────────────────────────────────────
if [ ${#NEEDS_UPDATE[@]} -eq 0 ]; then
    echo -e "${GREEN}All packages are up to date.${NC}"
else
    echo -e "${YELLOW}${#NEEDS_UPDATE[@]} package(s) need attention:${NC}"
    for item in "${NEEDS_UPDATE[@]}"; do
        IFS='|' read -r pkg from to kind <<< "$item"
        case "$kind" in
            major) echo -e "  ${RED}MAJOR: $pkg $from -> $to (check for breaking changes!)${NC}" ;;
            minor) echo -e "  ${YELLOW}UPDATE: $pkg $from -> $to${NC}" ;;
            new)   echo -e "  ${CYAN}NEW: $pkg $to (not installed)${NC}" ;;
        esac
    done
fi

# ── Update mode: show Dockerfile changes needed ──────────────────
if [ "$UPDATE_MODE" = "--update" ] && [ ${#NEEDS_UPDATE[@]} -gt 0 ]; then
    echo ""
    echo -e "${CYAN}=== Suggested Dockerfile changes ===${NC}"
    echo "Edit docker/r/Dockerfile and update these version pins:"
    echo ""
    for item in "${NEEDS_UPDATE[@]}"; do
        IFS='|' read -r pkg from to kind <<< "$item"
        if [ "$kind" = "major" ]; then
            echo -e "  ${RED}# WARNING: $pkg $from -> $to is a MAJOR version bump"
            echo -e "  # Check https://github.com/OHDSI/$pkg/blob/main/NEWS.md for breaking changes${NC}"
        fi
        echo "  $pkg: $from -> $to"
    done
    echo ""
    echo "After updating, rebuild with:"
    echo "  docker compose build r-runtime --no-cache"
    echo "  docker compose up -d r-runtime"
fi

echo ""
echo -e "${CYAN}Last checked: $(date '+%Y-%m-%d %H:%M %Z')${NC}"
echo "OHDSI announcements: https://forums.ohdsi.org/t/hades-development-announcements/12293"
