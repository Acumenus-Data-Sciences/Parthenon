#!/usr/bin/env bash
# health-watchdog.sh — Monitor Docker container health, restart unhealthy, alert on failure
#
# Docker's restart policy only handles container exits, NOT unhealthy states.
# This watchdog catches containers stuck in "unhealthy" and restarts them.
#
# Usage:
#   ./scripts/health-watchdog.sh           # single check
#   */5 * * * * /path/to/scripts/health-watchdog.sh   # cron (every 5 min)
#
# Logs to /tmp/parthenon-watchdog.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG="/tmp/parthenon-watchdog.log"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

# Critical services that MUST be healthy for the platform to function
CRITICAL_SERVICES=(php nginx postgres redis horizon solr)

# Important services — restart if unhealthy but don't block
IMPORTANT_SERVICES=(python-ai darkstar node reverb chromadb orthanc study-agent)

# Monitoring stack — nice to have
MONITORING_SERVICES=(prometheus grafana loki alloy cadvisor node-exporter)

ALL_SERVICES=("${CRITICAL_SERVICES[@]}" "${IMPORTANT_SERVICES[@]}" "${MONITORING_SERVICES[@]}")

cd "$PROJECT_DIR"

UNHEALTHY=()
RESTARTED=()
DOWN=()
FAILED_RESTART=()

for svc in "${ALL_SERVICES[@]}"; do
  # Get container state and health
  STATE=$(docker compose ps --format '{{.State}}' "$svc" 2>/dev/null || echo "missing")
  HEALTH=$(docker compose ps --format '{{.Health}}' "$svc" 2>/dev/null || echo "unknown")

  if [ "$STATE" = "missing" ] || [ "$STATE" = "exited" ] || [ -z "$STATE" ]; then
    DOWN+=("$svc")
    echo "[$TIMESTAMP] DOWN: $svc (state=$STATE)" >> "$LOG"

    # Try to start it
    if docker compose up -d "$svc" >> "$LOG" 2>&1; then
      RESTARTED+=("$svc")
      echo "[$TIMESTAMP] STARTED: $svc" >> "$LOG"
    else
      FAILED_RESTART+=("$svc")
      echo "[$TIMESTAMP] FAILED TO START: $svc" >> "$LOG"
    fi

  elif [ "$HEALTH" = "unhealthy" ]; then
    UNHEALTHY+=("$svc")
    echo "[$TIMESTAMP] UNHEALTHY: $svc — restarting" >> "$LOG"

    if docker compose restart "$svc" >> "$LOG" 2>&1; then
      RESTARTED+=("$svc")
      echo "[$TIMESTAMP] RESTARTED: $svc" >> "$LOG"
    else
      FAILED_RESTART+=("$svc")
      echo "[$TIMESTAMP] FAILED TO RESTART: $svc" >> "$LOG"
    fi
  fi
done

# Summary
TOTAL_ISSUES=$(( ${#UNHEALTHY[@]} + ${#DOWN[@]} ))

if [ "$TOTAL_ISSUES" -eq 0 ]; then
  # Only log healthy checks every hour to avoid noise
  MINUTE=$(date +%M)
  if [ "$MINUTE" -lt 5 ]; then
    echo "[$TIMESTAMP] ALL HEALTHY: ${#ALL_SERVICES[@]} services OK" >> "$LOG"
  fi
  exit 0
fi

# Build alert message
ALERT="[$TIMESTAMP] WATCHDOG ALERT: $TOTAL_ISSUES issue(s) detected"
[ ${#UNHEALTHY[@]} -gt 0 ] && ALERT="$ALERT | Unhealthy: ${UNHEALTHY[*]}"
[ ${#DOWN[@]} -gt 0 ] && ALERT="$ALERT | Down: ${DOWN[*]}"
[ ${#RESTARTED[@]} -gt 0 ] && ALERT="$ALERT | Restarted: ${RESTARTED[*]}"
[ ${#FAILED_RESTART[@]} -gt 0 ] && ALERT="$ALERT | FAILED: ${FAILED_RESTART[*]}"

echo "$ALERT" >> "$LOG"

# Check if any CRITICAL service failed to restart — this is a P0
for svc in "${FAILED_RESTART[@]}"; do
  for crit in "${CRITICAL_SERVICES[@]}"; do
    if [ "$svc" = "$crit" ]; then
      echo "[$TIMESTAMP] P0 CRITICAL: $svc is down and could not be restarted!" >> "$LOG"
      # Could add email/Slack/PagerDuty alert here
    fi
  done
done

# Verify health after restart (wait for healthcheck interval)
if [ ${#RESTARTED[@]} -gt 0 ]; then
  sleep 30
  STILL_BAD=()
  for svc in "${RESTARTED[@]}"; do
    HEALTH=$(docker compose ps --format '{{.Health}}' "$svc" 2>/dev/null || echo "unknown")
    STATE=$(docker compose ps --format '{{.State}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$HEALTH" = "unhealthy" ] || [ "$STATE" != "running" ]; then
      STILL_BAD+=("$svc")
    fi
  done

  if [ ${#STILL_BAD[@]} -gt 0 ]; then
    echo "[$TIMESTAMP] POST-RESTART: Still unhealthy after restart: ${STILL_BAD[*]}" >> "$LOG"
  else
    echo "[$TIMESTAMP] POST-RESTART: All restarted services recovered successfully" >> "$LOG"
  fi
fi

# Prune log to last 5000 lines
if [ -f "$LOG" ]; then
  LINES=$(wc -l < "$LOG")
  if [ "$LINES" -gt 5000 ]; then
    tail -3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
fi
