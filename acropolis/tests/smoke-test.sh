#!/usr/bin/env bash
# =============================================================================
# Acropolis — Smoke Test
# =============================================================================
# Verifies all running services are healthy and reachable.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

check() {
    local name="$1"
    local url="$2"
    local expected="${3:-200}"

    if ! docker ps --format '{{.Names}}' | grep -q "acropolis-"; then
        echo -e "  ${YELLOW}SKIP${NC} $name (not running)"
        ((SKIP++))
        return
    fi

    local status
    status=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    if [[ "$status" == "$expected" ]]; then
        echo -e "  ${GREEN}PASS${NC} $name (HTTP $status)"
        ((PASS++))
    else
        echo -e "  ${RED}FAIL${NC} $name (expected $expected, got $status)"
        ((FAIL++))
    fi
}

check_container() {
    local name="$1"
    local container="$2"

    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        if [[ "$health" == "healthy" ]]; then
            echo -e "  ${GREEN}PASS${NC} $name (healthy)"
            ((PASS++))
        elif [[ "$health" == "none" ]]; then
            echo -e "  ${YELLOW}WARN${NC} $name (running, no healthcheck)"
            ((PASS++))
        else
            echo -e "  ${RED}FAIL${NC} $name ($health)"
            ((FAIL++))
        fi
    else
        echo -e "  ${YELLOW}SKIP${NC} $name (not running)"
        ((SKIP++))
    fi
}

echo "═══════════════════════════════════════════════════════════"
echo "  Acropolis Smoke Test"
echo "═══════════════════════════════════════════════════════════"
echo

echo "Infrastructure:"
check_container "Traefik"        "acropolis-traefik"
echo

echo "Community Services:"
check_container "Portainer"      "acropolis-portainer"
check_container "pgAdmin"        "acropolis-pgadmin"
echo

echo "Enterprise Services:"
check_container "n8n"                "acropolis-n8n"
check_container "Superset"           "acropolis-superset"
check_container "Superset Worker"    "acropolis-superset-worker"
check_container "Superset Beat"      "acropolis-superset-beat"
check_container "DataHub Frontend"   "acropolis-datahub-frontend"
check_container "DataHub GMS"        "acropolis-datahub-gms"
check_container "Authentik Server"   "acropolis-authentik-server"
check_container "Authentik Worker"   "acropolis-authentik-worker"
echo

echo "═══════════════════════════════════════════════════════════"
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$SKIP skipped${NC}"
echo "═══════════════════════════════════════════════════════════"

exit $FAIL
