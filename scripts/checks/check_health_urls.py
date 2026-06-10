#!/usr/bin/env python3
"""Health-endpoint reference guard — permanent + evolving.

Prevents the "wrong health path" class of bug from recurring (a consumer probing
a backend health URL that does not exist, e.g. the `/api/v1/health` 404 that hung
the installer's readiness loop while the real route was `/api/health`).

How it stays correct as the codebase evolves: it does NOT hard-code the canonical
path. It DERIVES the set of real backend health routes from the actual route
table (`backend/routes/api.php` — the single source of truth), then scans
live-consumer surfaces for references to the main-app health path family
`/api[/vN]/health` and fails if any reference points at a path the backend does
not actually serve.

Consequences that make this self-maintaining:
  * Add or rename a HealthController route in api.php  -> allowed set updates,
    no edit here required.
  * Remove the `/v1/health` compat alias              -> every straggler that
    still references it is flagged, forcing consumers onto the canonical path.
  * A new typo (`/api/v2/health`, `/api/healthz`, ...) in installer/infra/etc.
    -> flagged immediately.

Out of scope by design: documentation under docs/ (it records historical state),
bare `/health` sidecar endpoints, and unrelated `/api/health` belonging to other
services (Grafana) — the latter happens to coincide with a canonical path and is
harmless.

Usage:  python3 scripts/checks/check_health_urls.py
Exit:   0 = OK, 1 = bad references found, 2 = could not derive canonical set.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# routes/api.php is mounted under the "/api" prefix by RouteServiceProvider,
# NOT "/api/v1" — which is the entire reason this class of bug exists.
API_PREFIX = "/api"
ROUTE_FILE = REPO / "backend" / "routes" / "api.php"

# The main-app health path family. Matches /api/health, /api/v1/health, ...
# Deliberately NOT /api/v1/etl/fhir/health (health is not immediately after the
# version segment) and NOT bare /health (sidecars / other services).
HEALTH_REF = re.compile(r"/api(?:/v\d+)?/health\b")

# A HealthController route line, e.g. Route::get('/v1/health', [HealthController::class, 'index']).
# The negative lookbehind excludes SystemHealthController::class.
_ROUTE_DECL = re.compile(r"(?<![A-Za-z])HealthController::class")
_ROUTE_PATH = re.compile(r"""['"](/[A-Za-z0-9_/-]*health[A-Za-z0-9_/-]*)['"]""")

# Surfaces that probe/redirect to the backend health endpoint. Globs are relative
# to the repo root. docs/ is intentionally absent (historical references allowed).
CONSUMER_GLOBS = [
    "installer/**/*.py",
    "installer/**/*.html",
    "deploy.sh",
    "scripts/**/*.sh",
    "scripts/**/*.py",
    "backend/app/**/*.php",
    "backend/routes/*.php",
    "frontend/src/**/*.ts",
    "frontend/src/**/*.tsx",
    "docker-compose*.yml",
    "docker/**/*.yml",
    "docker/**/*.conf",
    "acropolis/**/*.yml",
    "acropolis/**/*.yaml",
    "monitoring/**/*.alloy",
    "monitoring/**/*.yml",
    "monitoring/**/*.yaml",
]

# Files that legitimately enumerate the canonical set itself.
SELF_EXCLUDE = {
    "scripts/checks/check_health_urls.py",
    "backend/routes/api.php",
    "backend/tests/Feature/Api/V1/HealthCheckTest.php",
}


def canonical_health_paths() -> set[str]:
    """Derive the real backend health routes from api.php (source of truth)."""
    paths: set[str] = set()
    for line in ROUTE_FILE.read_text(encoding="utf-8").splitlines():
        if not _ROUTE_DECL.search(line):
            continue
        m = _ROUTE_PATH.search(line)
        if m:
            paths.add(API_PREFIX + m.group(1))
    return paths


def find_violations(canonical: set[str]) -> list[tuple[str, int, str]]:
    violations: list[tuple[str, int, str]] = []
    seen: set[str] = set()
    for pattern in CONSUMER_GLOBS:
        for path in REPO.glob(pattern):
            if not path.is_file():
                continue
            rel = path.relative_to(REPO).as_posix()
            if rel in SELF_EXCLUDE or rel in seen:
                continue
            seen.add(rel)
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for lineno, line in enumerate(text.splitlines(), 1):
                for ref in HEALTH_REF.findall(line):
                    if ref not in canonical:
                        violations.append((rel, lineno, line.strip()[:160]))
    return violations


def main() -> int:
    canonical = canonical_health_paths()
    if not canonical:
        print(
            "ERROR: no HealthController routes found in backend/routes/api.php.\n"
            "       The route file changed shape — update this guard's parser.",
            file=sys.stderr,
        )
        return 2

    violations = find_violations(canonical)
    canon = ", ".join(sorted(canonical))

    if violations:
        print("Health-endpoint reference guard FAILED.")
        print(f"Real backend health routes (from api.php): {canon}")
        print("These live-consumer references point at a health path the backend does NOT serve:")
        for rel, lineno, snippet in violations:
            print(f"  {rel}:{lineno}: {snippet}")
        print(
            "\nFix: point the reference at a real route, or add the route to "
            "backend/routes/api.php (and a HealthCheckTest assertion)."
        )
        return 1

    print(f"OK: all live-consumer health references resolve to real routes ({canon}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
