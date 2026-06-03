#!/usr/bin/env bash
#
# alfresco-transform-monitor.sh — self-heal watchdog for the Alfresco
# transform engine (alfresco-transform-core-aio).
#
# WHY: The container's Docker healthcheck does a real docx->pdf transform, so a
# dead JODConverter/LibreOffice OfficeManager surfaces as Health.Status=unhealthy
# (the stock /ready probe stays green even when soffice has died). LibreOffice
# can crash on startup after a restart if it loses the race for native memory,
# leaving every Office-doc PDF preview returning HTTP 500 in Share. This watchdog
# detects that state and restarts the (stateless) container to recover it.
#
# SENSOR  : container Health.Status == unhealthy  (set by the in-container probe)
# FALLBACK: "OfficeManager is currently stopped" in recent logs (independent of
#           the healthcheck, in case the probe itself is misconfigured)
# ACTUATOR: docker restart, gated by a cooldown + an hourly cap so it can never
#           storm-restart. Restarting this container is non-destructive: it holds
#           no data (renditions are cached in the repo, source content untouched).
#
# MODE:
#   heal   (default) — restart on trigger, within safeguards
#   detect           — log/alert only, never restart
# Override per-run with ALFRESCO_MONITOR_MODE=detect.
#
# Install as a systemd timer (every 5 min):
#   sudo cp scripts/systemd/alfresco-transform-monitor.{service,timer} /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now alfresco-transform-monitor.timer
# Inspect:  journalctl -u alfresco-transform-monitor.service -n 50
#           tail -f /var/log/alfresco-transform-monitor.log
#
set -euo pipefail

CONTAINER="${ALFRESCO_TRANSFORM_CONTAINER:-alfresco-transform-core-aio}"
COMPOSE_DIR="${ALFRESCO_COMPOSE_DIR:-/home/smudoshi/Github/Parthenon/alfresco}"
COOLDOWN_SECS="${ALFRESCO_MONITOR_COOLDOWN:-900}"      # >= start_period; no re-heal within this window
MAX_PER_HOUR="${ALFRESCO_MONITOR_MAX_PER_HOUR:-3}"     # storm guard
MODE="${ALFRESCO_MONITOR_MODE:-heal}"
STATE_DIR="${ALFRESCO_MONITOR_STATE_DIR:-/var/lib/alfresco-transform-monitor}"
LOG_FILE="${ALFRESCO_MONITOR_LOG:-/var/log/alfresco-transform-monitor.log}"

HEALS_LOG="$STATE_DIR/heals.log"   # one epoch-second per restart
mkdir -p "$STATE_DIR"

now() { date +%s; }

log() {
  local msg="[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*"
  echo "$msg"
  # best-effort file log; never fail the run if /var/log is not writable
  echo "$msg" >>"$LOG_FILE" 2>/dev/null || true
}

# epoch of the most recent restart, or 0
last_heal_epoch() { tail -n1 "$HEALS_LOG" 2>/dev/null || echo 0; }

# number of restarts in the trailing hour
heals_last_hour() {
  local cutoff=$(( $(now) - 3600 ))
  [ -f "$HEALS_LOG" ] || { echo 0; return; }
  awk -v c="$cutoff" '$1 >= c' "$HEALS_LOG" | wc -l | tr -d ' '
}

health_status() {
  # prints: healthy | unhealthy | starting | none | missing
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
    "$CONTAINER" 2>/dev/null || echo missing
}

container_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)" = "true" ]
}

stopped_in_logs() {
  # 1 if the OfficeManager-stopped signature appeared in the last 12 minutes
  local n
  n=$(docker logs --since 12m "$CONTAINER" 2>&1 | grep -c 'OfficeManager is currently stopped' || true)
  [ "${n:-0}" -gt 0 ]
}

heal() {
  local reason="$1"
  local since_last=$(( $(now) - $(last_heal_epoch) ))
  if [ "$since_last" -lt "$COOLDOWN_SECS" ]; then
    log "TRIGGER ($reason) but in cooldown (${since_last}s < ${COOLDOWN_SECS}s); skipping restart."
    return 0
  fi
  local count; count=$(heals_last_hour)
  if [ "$count" -ge "$MAX_PER_HOUR" ]; then
    log "TRIGGER ($reason) but hourly cap reached (${count}/${MAX_PER_HOUR}); NOT restarting. Manual investigation needed."
    return 0
  fi
  log "TRIGGER ($reason): restarting $CONTAINER (heal ${count}+1/${MAX_PER_HOUR} this hour)..."
  if docker restart "$CONTAINER" >/dev/null 2>&1; then
    now >>"$HEALS_LOG"
    log "RESTART OK. soffice will warm up; healthcheck re-evaluates after start_period."
  else
    log "RESTART FAILED for $CONTAINER. Manual investigation needed."
  fi
}

main() {
  if ! container_running; then
    log "WARN: $CONTAINER is not running ($(health_status)). Restart policy should recover it; not intervening."
    exit 0
  fi

  local hs; hs=$(health_status)

  # Don't act while the container is still inside its start_period.
  if [ "$hs" = "starting" ]; then
    log "OK: status=starting (warming up); no action."
    exit 0
  fi

  local trigger=""
  if [ "$hs" = "unhealthy" ]; then
    trigger="healthcheck=unhealthy"
  elif stopped_in_logs; then
    trigger="log-signature=OfficeManager-stopped"
  fi

  if [ -z "$trigger" ]; then
    log "OK: status=${hs}; LibreOffice transforms healthy."
    exit 0
  fi

  if [ "$MODE" = "detect" ]; then
    log "ALERT ($trigger): transform engine degraded. MODE=detect — not restarting."
    exit 0
  fi
  heal "$trigger"
}

main "$@"
