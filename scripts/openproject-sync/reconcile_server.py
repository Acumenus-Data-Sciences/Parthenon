"""reconcile_server.py — Lightweight HTTP server for OP↔GitHub reconciliation.

Called by the n8n cron workflow (op-sync-reconcile.json) via:
  POST http://host.docker.internal:9878/reconcile

Endpoints:
  POST /reconcile            — run reconciliation, return JSON stats
  GET  /health               — health check from sync.health view
  GET  /webhook/sync-health  — same health check (n8n-friendly alias)
"""
from __future__ import annotations

import json
import logging
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from lib.gh_client import GitHubClient
from lib.mapper import (
    OP_STATUS_CLOSED,
    OP_STATUS_IN_PROGRESS,
    OP_STATUS_NEW,
    gsd_status_to_gh_state,
    op_status_name_to_gsd_status,
)
from lib.op_client import OpConfig, OpenProjectClient
from lib.sync_db import SyncDb

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PORT: int = int(os.environ.get("RECONCILE_PORT", "9878"))

_OP_BASE_URL = "https://projects.acumenus.net"
_OP_PROJECT_ID = 4
_OP_API_KEY: str = os.environ.get("OP_API_KEY", "")

_SYNC_DB_DSN: str = os.environ.get(
    "SYNC_DB_DSN",
    "dbname=parthenon user=claude_dev host=localhost",
)

# ---------------------------------------------------------------------------
# Reconciliation logic
# ---------------------------------------------------------------------------


def run_reconciliation() -> dict[str, int]:
    """Reconcile OP work-package states with GitHub issue states.

    OP is the source of truth. For every tracked entity that has both an
    op_work_package_id and a github_issue_number:
      1. Look up the OP work-package status name → map to GSD status.
      2. Derive the expected GitHub state ("open" | "closed").
      3. Compare with the actual GitHub issue state.
      4. If they disagree, update GitHub to match OP and log the conflict.

    Returns a stats dict: synced, conflicts, errors, skipped.
    """
    db = SyncDb(_SYNC_DB_DSN)
    op_client = OpenProjectClient(OpConfig(base_url=_OP_BASE_URL, api_key=_OP_API_KEY))
    gh_client = GitHubClient()

    stats: dict[str, int] = {"synced": 0, "conflicts": 0, "errors": 0, "skipped": 0}

    try:
        entities = db.find_all()
        log.info("reconcile: %d entities tracked in sync.entity_map", len(entities))

        # Build lookup maps to avoid per-entity API round-trips
        op_wps = op_client.list_work_packages(project_id=_OP_PROJECT_ID)
        wp_by_id: dict[int, dict[str, Any]] = {
            wp["id"]: wp for wp in op_wps if "id" in wp
        }
        log.info("reconcile: fetched %d OP work packages", len(wp_by_id))

        gh_issues = gh_client.list_issues(state="all")
        gh_by_number: dict[int, dict[str, Any]] = {
            issue["number"]: issue
            for issue in gh_issues
            if "number" in issue and "pull_request" not in issue
        }
        log.info("reconcile: fetched %d GitHub issues", len(gh_by_number))

        for entity in entities:
            wp_id = entity.op_work_package_id
            gh_num = entity.github_issue_number

            # Skip entities that are not fully linked
            if wp_id is None or gh_num is None:
                stats["skipped"] += 1
                continue

            try:
                wp = wp_by_id.get(wp_id)
                if wp is None:
                    log.warning(
                        "reconcile: OP work package %d not found — skipping entity %s",
                        wp_id,
                        entity.gsd_path,
                    )
                    stats["skipped"] += 1
                    continue

                gh_issue = gh_by_number.get(gh_num)
                if gh_issue is None:
                    log.warning(
                        "reconcile: GitHub issue #%d not found — skipping entity %s",
                        gh_num,
                        entity.gsd_path,
                    )
                    stats["skipped"] += 1
                    continue

                # Derive expected GitHub state from OP status name
                op_status_name: str = (
                    wp.get("_links", {})
                    .get("status", {})
                    .get("title", "")
                )
                gsd_status = op_status_name_to_gsd_status(op_status_name)
                expected_gh_state = gsd_status_to_gh_state(gsd_status)

                actual_gh_state: str = gh_issue.get("state", "open")

                if expected_gh_state == actual_gh_state:
                    stats["synced"] += 1
                    continue

                # Conflict: OP wins — update GitHub
                log.info(
                    "reconcile: conflict on entity %s (wp=%d gh=#%d): "
                    "OP status=%r → expected gh=%r, actual gh=%r — updating GitHub",
                    entity.gsd_path,
                    wp_id,
                    gh_num,
                    op_status_name,
                    expected_gh_state,
                    actual_gh_state,
                )
                gh_client.update_issue(gh_num, {"state": expected_gh_state})

                db.log_action(
                    workflow="reconcile",
                    direction="op->gh",
                    entity_map_id=entity.id,
                    action="conflict_resolved",
                    details={
                        "op_wp_id": wp_id,
                        "gh_issue": gh_num,
                        "op_status": op_status_name,
                        "gsd_status": gsd_status,
                        "old_gh_state": actual_gh_state,
                        "new_gh_state": expected_gh_state,
                    },
                )
                stats["conflicts"] += 1

            except Exception as exc:  # noqa: BLE001
                log.error(
                    "reconcile: error on entity %s: %s",
                    entity.gsd_path,
                    exc,
                    exc_info=True,
                )
                db.log_action(
                    workflow="reconcile",
                    direction="op->gh",
                    entity_map_id=entity.id,
                    action="error",
                    details={"error": str(exc)},
                )
                stats["errors"] += 1

    finally:
        db.close()

    log.info("reconcile: done — %s", stats)
    return stats


# ---------------------------------------------------------------------------
# Health check helper
# ---------------------------------------------------------------------------


def get_health() -> dict[str, Any]:
    """Query sync.health and return a JSON-ready dict."""
    db = SyncDb(_SYNC_DB_DSN)
    try:
        raw = db.get_health()
    finally:
        db.close()

    last_rec = raw.get("last_reconciliation")
    return {
        "last_reconciliation": (
            last_rec.isoformat().replace("+00:00", "Z")
            if last_rec is not None
            else None
        ),
        "entities_tracked": int(raw.get("entities_tracked", 0)),
        "conflicts_last_24h": int(raw.get("conflicts_last_24h", 0)),
        "errors_last_24h": int(raw.get("errors_last_24h", 0)),
        "status": "healthy",
    }


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------


class ReconcileHandler(BaseHTTPRequestHandler):
    """Minimal HTTP request handler for the reconciliation server."""

    def log_message(self, fmt: str, *args: Any) -> None:  # type: ignore[override]
        log.info("http: " + fmt, *args)

    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self) -> None:
        if self.path == "/reconcile":
            try:
                stats = run_reconciliation()
                self._send_json(200, stats)
            except Exception as exc:  # noqa: BLE001
                log.error("POST /reconcile unhandled error: %s", exc, exc_info=True)
                self._send_json(500, {"error": str(exc)})
        else:
            self._send_json(404, {"error": "Not found"})

    def do_GET(self) -> None:
        if self.path in ("/health", "/webhook/sync-health"):
            try:
                health = get_health()
                self._send_json(200, health)
            except Exception as exc:  # noqa: BLE001
                log.error("GET %s unhandled error: %s", self.path, exc, exc_info=True)
                self._send_json(500, {"error": str(exc)})
        else:
            self._send_json(404, {"error": "Not found"})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    server = HTTPServer(("0.0.0.0", PORT), ReconcileHandler)
    log.info("Reconciliation server starting on port %d", PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Reconciliation server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
