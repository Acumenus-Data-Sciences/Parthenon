---
doc_type: lineage
status: historical
date: 2026-05-10
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# 2026-05-10 — `--check-infra-overlay` mode for the compose composition contract

## TL;DR

The composition contract verifier shipped in PR #322 (`a38f285ce`, "Phase 2 #8 of 8") was written for the future EE-tier code overlay that lives in the private `Parthenon-EE` repo. When pointed at `acropolis/docker-compose.enterprise.yml` — a fundamentally different artifact — it produced **27 spurious violations**: 2 image-namespace, 24 volume-prefix, 1 network-prefix. Root cause was a category error, not a bug in the Acropolis file.

Fix: added `--check-infra-overlay` mode to `scripts/verify_compose_contract.py` that applies a relaxed-but-still-load-bearing subset of the rules to CE-bundled infrastructure overlays. The strict `--check-ee` mode is unchanged. CI now invokes both. Committed as `d81e8bc01`.

## What `acropolis/docker-compose.enterprise.yml` actually is

It's a **CE-bundled infrastructure overlay**: a public-repo compose file any deployer can compose in to bolt on Authentik (SSO), Superset (BI), DataHub (catalog), and Wazuh (SIEM/audit). It uses upstream third-party images by design (`apache/superset:6.0.0`, `ghcr.io/goauthentik/server:2026.2.1`, `wazuh/wazuh-manager:4.14.4`) and conventional volume names that match every upstream deployment guide (`superset_db_data`, `authentik_db_data`, `wazuh_etc`, etc.).

Renaming those volumes to `parthenon-ee-superset-db` would:

1. Break upgrade paths for every existing Acropolis deployment (`docker volume mv` doesn't exist; you'd be migrating data).
2. Confuse anyone Googling "wazuh deployment guide" and trying to map upstream docs onto our stack.
3. Achieve nothing technically — these volumes already live in distinct namespaces because Compose project names prefix them at runtime.

## What the EE overlay contract was actually about

`docs/architecture/extension-points/compose-composition.md` documents the rules for **the future `Parthenon-EE/docker-compose.ee.yml`** — a private-repo overlay that EE-tier customers would layer onto CE. There the EE-prefix rule has real value: it's the visible boundary between code Acumenus owns (CE) and code that's gated by an EE entitlement. Putting EE volumes in `parthenon-ee-*` makes it impossible to accidentally export them as part of a CE backup, and putting EE images in `ghcr.io/acumenus-data-sciences/parthenon-ee-*` makes the registry layer enforce the same boundary the license does.

Those concerns don't apply to upstream Authentik or Wazuh. Those are unmodified third-party containers running their own data; the EE/CE boundary is *not* the line between Parthenon and Authentik.

## The fix

Three things had to happen, none of them retreats:

1. **Keep `--check-ee` strict.** When the Phase 04 EE migration starts producing real `Parthenon-EE/docker-compose.ee.yml` content, the prefix rules still need to be enforced. Don't loosen the rules globally just because one file doesn't fit them.
2. **Add a new mode for the file that doesn't fit.** `--check-infra-overlay` permits upstream images, conventional volume/network names, and upstream port conventions, but **still enforces** the load-bearing rules: `parthenon-*`/`acropolis-*` container-name shape (operator scripts and dashboards depend on these prefixes for service discovery) and stable-service protection (an infra overlay must not silently replace `php` with a different image or weaken its healthcheck).
3. **Wire the new mode into CI.** Add an explicit `--check-infra-overlay` invocation against `acropolis/docker-compose.enterprise.yml` in `.github/workflows/compose-contract.yml` so a future regression is caught directly, not just via a test fixture.

### Rules per mode

| Rule | `--check-ee` | `--check-infra-overlay` |
| --- | --- | --- |
| Container-name shape (`parthenon-*` / `acropolis-*`) | Enforced | Enforced |
| Stable-service protection (no renaming, no weakened healthchecks) | Enforced | Enforced |
| Volume name prefix (`parthenon-ee-*`) | Required | Relaxed |
| Network name prefix (`parthenon-ee-*`) | Required | Relaxed |
| Image namespace (`ghcr.io/acumenus-data-sciences/parthenon-ee-*`) | Required | Relaxed |
| Port floor (`>= 8100`) | Required | Relaxed |

## Files touched

- `scripts/verify_compose_contract.py` — new `verify_infra_overlay()` function (~50 lines) + `--check-infra-overlay` CLI flag
- `scripts/verify_compose_contract_test.py` — 4 new unit tests:
  - `test_infra_overlay_passes_with_upstream_images_and_conventional_volumes` — happy path
  - `test_infra_overlay_still_flags_bad_container_name` — container-name shape still enforced
  - `test_infra_overlay_still_flags_weakened_healthcheck_on_stable_service` — stable-service protection still enforced
  - `test_infra_overlay_accepts_acropolis_enterprise_in_repo` — actual repo file passes (smoke)
- `.github/workflows/compose-contract.yml` — added an explicit infra-overlay step
- `docs/architecture/extension-points/compose-composition.md` — added a section comparing the two overlay modes

Test count went from 13 → 17, all green.

## Verification chain

```
$ python3 scripts/verify_compose_contract.py
OK: compose composition contract satisfied.

$ python3 scripts/verify_compose_contract.py --ce-only \
    --check-infra-overlay acropolis/docker-compose.enterprise.yml
OK: compose composition contract satisfied.

$ python3 scripts/verify_compose_contract.py --ce-only \
    --check-ee acropolis/docker-compose.enterprise.yml
Compose composition contract violations:
  - …authentik-server image not in expected namespace
  - …superset_db_data is not parthenon-ee-* prefixed
  - … (25 more)
[exit 1]    ← strict mode still flags it; rigor preserved

$ pytest scripts/verify_compose_contract_test.py -q
17 passed in 0.57s
```

The third invocation is the load-bearing one: it confirms `--check-ee` still flags the same violations it did before. We didn't loosen the rules — we added a separate mode for a different file class.

## Why this surfaced now

The composition contract landed two days ago (PR #322, 2026-05-09). Today's CE→EE sync from Plan 03 was the first time anyone ran the verifier against an actual file outside the small fixture set in the test suite. The mismatch wasn't a bug — it was a thing the contract author hadn't yet been pointed at.

## Followups

None for code. Two notes for the next person touching this:

1. When **Plan 04 (first-pass EE migration)** starts producing `Parthenon-EE/docker-compose.ee.yml`, run `--check-ee` (not infra-overlay) against it. The strict rules apply there.
2. If we ever ship another infra overlay (e.g. an `acropolis/docker-compose.observability.yml` for Loki/Grafana stacking), use `--check-infra-overlay` and add the file to the CI workflow's verification step.

## Related work

- PR #322 (`a38f285ce`) — original composition contract
- `docs/lineage/plans/open/2026-05-09-ce-ee-fork-plan-02-08-compose-composition-contract.md` — Plan 02-08
- `docs/architecture/extension-points/compose-composition.md` — the contract doc itself (now updated)
- This fix: `d81e8bc01` (`feat(compose-contract): add --check-infra-overlay mode for CE-bundled overlays`)
