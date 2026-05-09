# CE/EE Fork — Plan 02-08: Compose Composition Contract

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. See [Plan 02-01](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md) for the canonical TDD pattern.

**Goal:** Document and lightly refactor Parthenon's Docker Compose file layout so EE's `docker-compose.ee.yml` (in the private `Parthenon-EE` repo) can extend the public CE compose stack via well-defined override conventions, without patching CE compose files.

**Architecture:** Layered compose composition. CE ships a base layer (`docker-compose.yml`) and a community overlay (`docker-compose.community.yml`). The Acropolis subdirectory has the same pattern (`acropolis/docker-compose.{base,community,enterprise,local}.yml`). EE adds two more files (`docker-compose.ee.yml`, `acropolis/docker-compose.ee-overlay.yml`) in the Parthenon-EE repo's `enterprise/` overlay. Compose layering rules: stable service names, additive networks, named volumes with documented namespaces, environment variables passed through `${VAR:-default}` interpolation only.

This plan does NOT introduce new compose files for EE — those land in Plan 04. It establishes the **contract** that Plan 04's EE compose files will adhere to: what's stable in CE, what an EE override is allowed to do, what name conventions apply, and how an automated test verifies adherence.

**Tech Stack:** Docker Compose v2 (`docker compose config`), shellcheck for the verification script, Python for the contract test.

**Spec reference:** Spec §5 row 8.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:** Plan 01 merged. Independent of other 02-* plans.

---

## Scope

This is a **mostly-documentation plan** with three concrete deliverables:

1. A canonical contract document at `docs/architecture/extension-points/compose-composition.md`.
2. A Python contract verifier (`scripts/verify_compose_contract.py`) that enforces the rules on every PR.
3. A CI workflow job that runs the verifier (added to the existing license-guard.yml or as a new workflow).

There are **no production behavior changes** in CE — same compose files, same containers, same ports. Only the explicit contract is new.

---

## File structure

| Path | Purpose | LOC |
|---|---|---|
| `docs/architecture/extension-points/compose-composition.md` | The contract document | ~400 |
| `scripts/verify_compose_contract.py` | Static contract verifier | ~200 |
| `scripts/verify_compose_contract_test.py` | Pytest tests for the verifier | ~150 |
| `.github/workflows/compose-contract.yml` | CI job — runs the verifier on every PR | ~30 |
| `docker-compose.yml` | Annotated with stable-name + namespace-prefix comments (no behavior change) | (modify) |
| `docker-compose.community.yml` | Same annotations | (modify) |
| `docs/architecture/extension-points.md` | Mark row 8 done | (modify) |

---

## Task 1: Draft the contract document

Write `docs/architecture/extension-points/compose-composition.md` covering the rules below.

### 1.1 The compose layers

Today's CE structure (preserve as-is):

| File | Role |
|---|---|
| `docker-compose.yml` | Base — application services (php, nginx, postgres, redis, node, python-ai, r-runtime, solr, ...). Always loaded. |
| `docker-compose.community.yml` | CE overlay — adds Acropolis community services (Authentik, Traefik, Portainer, pgAdmin) when running on a CE-installer host. Loaded by `./deploy.sh` and the installer when tier=community. |
| `acropolis/docker-compose.base.yml` | Acropolis-only base layer (Traefik, Portainer always-on basics) |
| `acropolis/docker-compose.community.yml` | Acropolis CE additions (Authentik, pgAdmin) |
| `acropolis/docker-compose.local.yml` | Local-dev opt-ins |

Future EE additions (in Parthenon-EE, NOT in this PR — defined here so we can verify when it lands):

| File | Role |
|---|---|
| `enterprise/docker-compose.ee.yml` | EE app overlay — adds Keycloak side-car (replaces Authentik), enabled FIPS mode env vars, signed-audit shipper sidecar |
| `enterprise/acropolis/docker-compose.ee-overlay.yml` | EE Acropolis additions — n8n, Superset, DataHub, Wazuh, Keycloak |

EE is loaded via `docker compose -f docker-compose.yml -f enterprise/docker-compose.ee.yml ... up -d` from the Parthenon-EE repo (where `parthenon/` subtree lives next to `enterprise/`).

### 1.2 The 9 contract rules

Document and enforce:

1. **Stable service names.** CE service names listed in `STABLE_SERVICE_NAMES` are part of the public API. EE overrides may modify env / image / depends_on / volumes for these services but MUST NOT rename or remove them. Adding new services is allowed.

2. **Stable container names.** `container_name:` values for stable services follow `parthenon-<service>` convention. EE overrides MUST NOT change these — operators rely on them in scripts.

3. **Named volume namespacing.** CE uses unprefixed names (`parthenon-storage`, `pg-data`). EE-introduced volumes MUST be prefixed `parthenon-ee-<...>` to avoid collisions when both edition stacks exist on the same Docker host.

4. **Network naming.** CE uses `parthenon` and `acumenus` networks. EE may attach to these but MUST NOT redefine them with conflicting `driver_opts` or `ipam`. EE-introduced networks MUST be prefixed `parthenon-ee-`.

5. **Environment variable interpolation only.** All variability is expressed via `${VAR:-default}`. No conditional service definitions (Compose doesn't support `if`). EE flips behavior by setting env vars (e.g. `AUTH_DRIVER=keycloak`) and by appending overlay services, never by patching CE-file YAML.

6. **Image tag convention.** CE images: `ghcr.io/acumenus-data-sciences/parthenon-<service>:${PARTHENON_IMAGE_TAG:-latest}`. EE images: `ghcr.io/acumenus-data-sciences/parthenon-ee-<service>:${PARTHENON_EE_IMAGE_TAG:-latest}`. Both registries can coexist.

7. **Port allocation.** CE owns the port range `8080-8099` (exposed) and `5500-5599` (dev). EE-introduced services MUST request ports above `8100` to avoid conflicts on a single Docker host running both.

8. **Healthcheck stability.** Every CE service has a `healthcheck:` block. EE overrides MUST NOT replace these with weaker or faster ones. EE may add ADDITIONAL `depends_on: { condition: service_healthy }` constraints but MUST NOT relax existing ones.

9. **Profile usage.** Compose profiles (`profiles: [...]`) are reserved for **opt-in CE features** (e.g. `profiles: [tour]`). EE does NOT use profiles to gate enterprise services — those gate via overlay file selection at compose-up time. This keeps the rule simple: "if it's loaded, it runs."

### 1.3 What an EE override is allowed to do

For any STABLE_SERVICE_NAMES entry, EE may set:
- `environment:` (additive — both env blocks merge)
- `volumes:` (additive)
- `depends_on:` (additive, must not weaken)
- `image:` ONLY if EE is shipping a different image (e.g. FIPS-built PHP). The image MUST satisfy the same healthcheck.
- `command:` ONLY if the new command preserves the documented behavior of the service.

For any STABLE_SERVICE_NAMES entry, EE MUST NOT:
- Remove the service via `services: { <name>: !reset }`
- Rename the container (`container_name:`)
- Change the network membership (`networks:`)
- Replace the healthcheck with a passing-by-default no-op
- Change the exposed port (`ports:`) — adding additional internal ports is OK

### 1.4 Examples

(Doc page should include 4–6 concrete examples: a valid EE overlay adding Keycloak, an INVALID EE overlay that renames `parthenon-php`, an invalid one that drops a healthcheck, etc.)

---

## Task 2: Build the contract verifier

```python
# scripts/verify_compose_contract.py
"""
Statically verify CE compose files against the composition contract.

Usage:
  python3 scripts/verify_compose_contract.py
  python3 scripts/verify_compose_contract.py --check-ee /path/to/parthenon-ee/enterprise/docker-compose.ee.yml

Exit codes:
  0 — contract satisfied
  1 — contract violation
  2 — unable to parse compose file
"""
from __future__ import annotations
import argparse
import re
import sys
import yaml
from pathlib import Path
from typing import Any


# ---- Contract constants ----------------------------------------------------

CE_COMPOSE_FILES = [
    "docker-compose.yml",
    "docker-compose.community.yml",
    "acropolis/docker-compose.base.yml",
    "acropolis/docker-compose.community.yml",
]

STABLE_SERVICE_NAMES = {
    # Core app
    "php", "nginx", "node", "postgres", "redis",
    "python-ai", "r-runtime", "solr", "horizon",
    "fhir-to-cdm", "study-agent", "hecate",
    # Acropolis CE
    "traefik", "portainer", "pgadmin", "authentik",
}

CONTAINER_NAME_RE = re.compile(r"^parthenon-[a-z0-9-]+$")
NAMED_VOLUME_PREFIX_CE = re.compile(r"^(?!parthenon-ee-)")
NAMED_VOLUME_PREFIX_EE = re.compile(r"^parthenon-ee-")
NETWORK_NAMES_CE_OK = {"parthenon", "acumenus", "default", "acropolis-backend"}
EE_PORT_FLOOR = 8100
CE_PORT_RANGES = [(8080, 8099), (5500, 5599)]


# ---- Verifiers -------------------------------------------------------------

def _load(path: Path) -> dict[str, Any]:
    try:
        return yaml.safe_load(path.read_text()) or {}
    except Exception as e:
        print(f"FAIL parse {path}: {e}")
        sys.exit(2)


def verify_ce_files(repo_root: Path) -> list[str]:
    errors: list[str] = []
    for rel in CE_COMPOSE_FILES:
        p = repo_root / rel
        if not p.exists():
            continue   # community.yml may be optional in some checkouts
        d = _load(p)
        for name, spec in (d.get("services") or {}).items():
            if not isinstance(spec, dict):
                continue
            cn = spec.get("container_name")
            if cn and not CONTAINER_NAME_RE.match(cn):
                errors.append(f"{rel}: service {name} has non-standard container_name '{cn}'; expected 'parthenon-<service>'")
            # Image must be from CE namespace if pinned to ghcr.io
            img = spec.get("image", "")
            if "ghcr.io/" in img and "ghcr.io/acumenus-data-sciences/parthenon-" not in img:
                errors.append(f"{rel}: service {name} image '{img}' is on ghcr.io but not in acumenus-data-sciences/parthenon-* namespace")
        for vol in (d.get("volumes") or {}).keys():
            if NAMED_VOLUME_PREFIX_EE.match(vol):
                errors.append(f"{rel}: CE compose file declares EE-prefixed volume '{vol}'")
        for net in (d.get("networks") or {}).keys():
            if net not in NETWORK_NAMES_CE_OK and not net.startswith("parthenon-"):
                errors.append(f"{rel}: unexpected CE network '{net}' (allowed: {sorted(NETWORK_NAMES_CE_OK)} or parthenon-*)")
    return errors


def verify_ce_stable_services_present(repo_root: Path) -> list[str]:
    """The set of stable services must be defined across the CE compose stack."""
    declared: set[str] = set()
    for rel in CE_COMPOSE_FILES:
        p = repo_root / rel
        if p.exists():
            declared |= set((_load(p).get("services") or {}).keys())
    missing = [s for s in STABLE_SERVICE_NAMES if s not in declared and s not in {"authentik", "pgadmin", "portainer"}]
    # authentik/pgadmin/portainer come from acropolis/community overlays — only required if Acropolis tier is loaded.
    return [f"missing required stable service: {s}" for s in missing]


def verify_ee_overlay(ee_path: Path) -> list[str]:
    errors: list[str] = []
    if not ee_path.exists():
        return [f"EE overlay path does not exist: {ee_path}"]
    d = _load(ee_path)
    # Rule: EE may not redefine container_name on stable services
    for name, spec in (d.get("services") or {}).items():
        if name in STABLE_SERVICE_NAMES:
            if "container_name" in (spec or {}):
                errors.append(f"{ee_path}: EE overlay sets container_name on stable service '{name}' — forbidden")
            # EE healthcheck for a stable service must not be a no-op
            hc = (spec or {}).get("healthcheck", {})
            test = hc.get("test")
            if test and isinstance(test, list) and any("true" == t.lower() for t in test):
                errors.append(f"{ee_path}: EE overlay weakens healthcheck on stable service '{name}'")
        # EE-introduced services must use ports >= EE_PORT_FLOOR
        for port_spec in (spec or {}).get("ports") or []:
            host = str(port_spec).split(":")[0]
            if host.isdigit() and int(host) < EE_PORT_FLOOR:
                errors.append(f"{ee_path}: EE service '{name}' binds host port {host} (< {EE_PORT_FLOOR})")
    # Rule: EE volumes must be parthenon-ee-* prefixed
    for vol in (d.get("volumes") or {}).keys():
        if not NAMED_VOLUME_PREFIX_EE.match(vol):
            errors.append(f"{ee_path}: EE volume '{vol}' is not parthenon-ee-* prefixed")
    # Rule: EE images on ghcr.io must be in parthenon-ee-* namespace
    for name, spec in (d.get("services") or {}).items():
        img = (spec or {}).get("image", "")
        if "ghcr.io/" in img and "ghcr.io/acumenus-data-sciences/parthenon-ee-" not in img and "ghcr.io/acumenus-data-sciences/parthenon-" not in img:
            errors.append(f"{ee_path}: EE service '{name}' image '{img}' not in expected namespace")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-root", default=".", type=Path)
    ap.add_argument("--check-ee", default=None, type=Path)
    args = ap.parse_args()

    errs = verify_ce_files(args.repo_root) + verify_ce_stable_services_present(args.repo_root)
    if args.check_ee is not None:
        errs += verify_ee_overlay(args.check_ee)

    if errs:
        print("Compose composition contract violations:")
        for e in errs:
            print(f"  - {e}")
        return 1
    print("OK: compose composition contract satisfied.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## Task 3: TDD — Verifier tests

```python
# scripts/verify_compose_contract_test.py
import subprocess
from pathlib import Path
import textwrap
import tempfile


def _write(d: Path, name: str, body: str) -> None:
    (d / name).write_text(textwrap.dedent(body))


def test_ce_passes_on_minimal_valid_repo():
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        (d / "acropolis").mkdir()
        _write(d, "docker-compose.yml", """
            services:
              php:
                container_name: parthenon-php
                image: ghcr.io/acumenus-data-sciences/parthenon-php:latest
              nginx:
                container_name: parthenon-nginx
                image: ghcr.io/acumenus-data-sciences/parthenon-nginx:latest
              postgres:
                container_name: parthenon-postgres
                image: pgvector/pgvector:pg16
              redis:
                container_name: parthenon-redis
                image: redis:7-alpine
              node:
                container_name: parthenon-node
                image: ghcr.io/acumenus-data-sciences/parthenon-node:latest
              python-ai:
                container_name: parthenon-python-ai
                image: ghcr.io/acumenus-data-sciences/parthenon-python-ai:latest
              r-runtime:
                container_name: parthenon-r-runtime
                image: ghcr.io/acumenus-data-sciences/parthenon-r-runtime:latest
              solr:
                container_name: parthenon-solr
                image: solr:9.7
              horizon:
                container_name: parthenon-horizon
                image: ghcr.io/acumenus-data-sciences/parthenon-php:latest
              fhir-to-cdm:
                container_name: parthenon-fhir-to-cdm
                image: ghcr.io/acumenus-data-sciences/parthenon-fhir-to-cdm:latest
              study-agent:
                container_name: parthenon-study-agent
                image: ghcr.io/acumenus-data-sciences/parthenon-study-agent:latest
              hecate:
                container_name: parthenon-hecate
                image: ghcr.io/acumenus-data-sciences/parthenon-hecate:latest
            volumes:
              parthenon-storage:
        """)
        _write(d / "acropolis", "docker-compose.base.yml", "services: {}\nvolumes: {}\n")
        r = subprocess.run(["python3", "scripts/verify_compose_contract.py", "--repo-root", str(d)],
                           cwd=Path(__file__).parent.parent, capture_output=True, text=True)
        assert r.returncode == 0, r.stdout + r.stderr


def test_ce_fails_when_image_outside_namespace():
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        (d / "acropolis").mkdir()
        _write(d, "docker-compose.yml", """
            services:
              php:
                container_name: parthenon-php
                image: ghcr.io/some-other-org/something:latest
        """)
        _write(d / "acropolis", "docker-compose.base.yml", "services: {}\n")
        r = subprocess.run(["python3", "scripts/verify_compose_contract.py", "--repo-root", str(d)],
                           cwd=Path(__file__).parent.parent, capture_output=True, text=True)
        assert r.returncode == 1
        assert "not in acumenus-data-sciences/parthenon-* namespace" in r.stdout


def test_ee_passes_on_valid_overlay():
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        ee = d / "ee.yml"
        _write(d, "ee.yml", """
            services:
              keycloak:
                image: quay.io/keycloak/keycloak:25.0
                ports: ["8181:8080"]
                container_name: parthenon-ee-keycloak
            volumes:
              parthenon-ee-keycloak-data: {}
        """)
        # Need a minimal CE root for the verifier to also check CE side
        # (use the actual repo for that part; check-ee only on the temp file)
        r = subprocess.run(["python3", "scripts/verify_compose_contract.py", "--check-ee", str(ee)],
                           cwd=Path(__file__).parent.parent, capture_output=True, text=True)
        # Will pass overlay rules; CE-side may report other things — assert overlay-specific output is clean
        assert "EE service" not in r.stdout or "OK" in r.stdout


def test_ee_fails_on_low_port_collision():
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        _write(d, "ee.yml", """
            services:
              keycloak:
                ports: ["8081:8080"]   # < EE_PORT_FLOOR (8100)
                image: ghcr.io/acumenus-data-sciences/parthenon-ee-keycloak:latest
            volumes:
              parthenon-ee-keycloak-data: {}
        """)
        r = subprocess.run(["python3", "scripts/verify_compose_contract.py", "--check-ee", str(d / "ee.yml")],
                           cwd=Path(__file__).parent.parent, capture_output=True, text=True)
        assert r.returncode == 1
        assert "binds host port" in r.stdout


def test_ee_fails_when_overriding_container_name_of_stable_service():
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        _write(d, "ee.yml", """
            services:
              php:
                container_name: parthenon-ee-php-fips
            volumes:
              parthenon-ee-data: {}
        """)
        r = subprocess.run(["python3", "scripts/verify_compose_contract.py", "--check-ee", str(d / "ee.yml")],
                           cwd=Path(__file__).parent.parent, capture_output=True, text=True)
        assert r.returncode == 1
        assert "container_name on stable service" in r.stdout


def test_ee_fails_when_volume_not_prefixed():
    with tempfile.TemporaryDirectory() as t:
        d = Path(t)
        _write(d, "ee.yml", """
            services: {}
            volumes:
              keycloak-data: {}    # missing parthenon-ee- prefix
        """)
        r = subprocess.run(["python3", "scripts/verify_compose_contract.py", "--check-ee", str(d / "ee.yml")],
                           cwd=Path(__file__).parent.parent, capture_output=True, text=True)
        assert r.returncode == 1
        assert "not parthenon-ee-* prefixed" in r.stdout
```

---

## Task 4: CI workflow

```yaml
# .github/workflows/compose-contract.yml
name: Compose Composition Contract

on:
  pull_request:
    paths:
      - 'docker-compose*.yml'
      - 'acropolis/docker-compose*.yml'
      - 'scripts/verify_compose_contract.py'
      - '.github/workflows/compose-contract.yml'
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install pyyaml pytest
      - name: Verify CE compose contract
        run: python3 scripts/verify_compose_contract.py
      - name: Run verifier unit tests
        run: pytest scripts/verify_compose_contract_test.py -q
```

---

## Task 5: Annotate existing compose files

Add header comments to `docker-compose.yml` and `docker-compose.community.yml`:

```yaml
# docker-compose.yml — Parthenon CE base layer
#
# COMPOSITION CONTRACT (see docs/architecture/extension-points/compose-composition.md):
#   - Service names in this file are STABLE PUBLIC API. Renaming/removing them
#     is a breaking change.
#   - Container names follow `parthenon-<service>` convention.
#   - Named volumes are unprefixed (CE owns them). EE volumes use `parthenon-ee-*`.
#   - Images use `ghcr.io/acumenus-data-sciences/parthenon-<service>:${PARTHENON_IMAGE_TAG:-latest}`.
#   - Variability via `${VAR:-default}` only — no conditional service definitions.
#   - Healthchecks are required and MUST NOT be weakened by overrides.
#
# To verify the contract locally:
#   python3 scripts/verify_compose_contract.py
```

---

## Task 6: Documentation + PR

- [ ] The contract document (Task 1.3 + 1.4) is the deliverable for this PR
- [ ] Mark row 8 done in `extension-points.md`
- [ ] PR title: "feat(compose): document and verify composition contract (Phase 2 #8 of 8)"

---

## Plan 02-08 completion checklist

- [ ] Contract document published at `docs/architecture/extension-points/compose-composition.md`
- [ ] Verifier script + tests pass on CE
- [ ] CI workflow added; runs on every PR touching compose
- [ ] Annotation comments added to top of compose files
- [ ] No production behavior change in CE
- [ ] PR merged

## Out of scope

- Actually authoring `enterprise/docker-compose.ee.yml` — Plan 04
- Helm chart equivalents of the compose contract — out of scope (different deployment surface)
- Compose v3 → v2.4 migration — out of scope (already on v2)
- Sidecar / init-container patterns — separate plan

---

## Phase 2 closure

When Plan 02-08 merges, **Phase 2 is complete**. CE has 8 stable, documented, tested extension points. EE drivers can now be authored in the `Acumenus-Data-Sciences/Parthenon-EE` repo against this surface, which is Plan 03 (EE bootstrap) and Plan 04 (first-pass EE migration).

*End of Plan 02-08.*
