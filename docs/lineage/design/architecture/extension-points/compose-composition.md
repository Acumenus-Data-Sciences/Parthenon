---
doc_type: spec
status: historical
date: 2026-05-09
owner: acumenus
module: extension-points
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - docker-compose.community.yml
  - docker-compose.yml
  - scripts/verify_compose_contract.py
  - scripts/verify_compose_contract_test.py
related_prs: []
---
# Extension Point: Compose Composition Contract

**Verifier:** `scripts/verify_compose_contract.py`
**Verifier tests:** `scripts/verify_compose_contract_test.py`
**CI workflow:** `.github/workflows/compose-contract.yml`
**Stable service list:** `STABLE_SERVICE_NAMES` in the verifier
**Status:** Live since [Phase 2 #8](../../../plans/closed/2026-05-09-ce-ee-fork-plan-02-08-compose-composition-contract.md)

## Purpose

Document and machine-verify how Parthenon's Docker Compose stack is layered so EE's `docker-compose.ee.yml` (in the private `Parthenon-EE` repo) can extend the public CE compose stack via well-defined override conventions, without ever patching CE compose YAML.

This is a **mostly-documentation extension point** — there are no production behavior changes in CE. The deliverables are:

1. The contract rules below.
2. A Python verifier (`scripts/verify_compose_contract.py`) that statically enforces them.
3. A CI workflow that runs the verifier on every PR touching compose files.

## The compose layers

CE structure (preserved as-is):

| File | Role |
|---|---|
| `docker-compose.yml` | Base — application services (php, nginx, postgres, redis, node, python-ai, solr, horizon, hecate, ...). Always loaded. |
| `docker-compose.community.yml` | CE overlay — adds Acropolis community services when running on a CE-installer host. Loaded by `./deploy.sh` when the installer's `tier=community`. |
| `acropolis/docker-compose.base.yml` | Acropolis-only base (Traefik, Portainer always-on basics) |
| `acropolis/docker-compose.community.yml` | Acropolis CE additions (pgAdmin, Authentik, Grafana) |
| `acropolis/docker-compose.local.yml` | Local-dev opt-ins |

Future EE additions (in Parthenon-EE, NOT in this PR — verified once they land):

| File | Role |
|---|---|
| `enterprise/docker-compose.ee.yml` | EE app overlay — Keycloak side-car (replaces Authentik), FIPS-mode env vars, signed-audit shipper sidecar |
| `enterprise/acropolis/docker-compose.ee-overlay.yml` | EE Acropolis additions — n8n, Superset, DataHub, Wazuh, Keycloak |

EE loads via `docker compose -f docker-compose.yml -f enterprise/docker-compose.ee.yml ... up -d` from the Parthenon-EE repo (where `parthenon/` lives next to `enterprise/`).

## The 10 contract rules

The verifier enforces these statically. Document them here so the rationale is visible in code review.

### 1. Stable service names

CE service names listed in `STABLE_SERVICE_NAMES` are part of the public API. EE overrides MAY modify env / image / depends_on / volumes for these services but MUST NOT rename or remove them. Adding new services (CE or EE) is allowed.

```python
STABLE_SERVICE_NAMES = {
    # Core application
    "php", "nginx", "node", "postgres", "redis",
    "python-ai", "solr", "horizon",
    "fhir-to-cdm", "study-agent", "hecate",
    # Acropolis CE
    "traefik", "portainer", "pgadmin",
}
```

### 2. Stable container names

Container names follow `parthenon-<service>` (core) or `acropolis-<service>` (Acropolis overlay). EE overrides MUST NOT change these — operator scripts (`scripts/health-watchdog.sh`, the day-2 `acropolis.sh` helper, Grafana log queries) reference both forms.

A small `LEGACY_CONTAINER_NAMES` allowlist captures the pre-existing baseline (e.g. `python-ai` is named `python-ai` not `parthenon-python-ai` — renaming would break Grafana dashboards, nginx upstream resolution, and operator scripts). New services MUST follow the prefix convention.

### 3. Named volume namespacing

CE uses unprefixed names (`parthenon-storage`, `pg-data`). EE-introduced volumes MUST be prefixed `parthenon-ee-...` to avoid collisions when both edition stacks exist on the same Docker host.

### 4. Network naming

CE uses `parthenon`, `acumenus`, `acropolis`, `acropolis-backend`, `backend`, `jupyter_users` networks. EE may attach to these but MUST NOT redefine them with conflicting `driver_opts` or `ipam`. EE-introduced networks MUST be prefixed `parthenon-ee-`.

### 5. Environment variable interpolation only

All variability is expressed via `${VAR:-default}`. No conditional service definitions (Compose doesn't support `if`). EE flips behavior by setting env vars (e.g. `AUTH_DRIVER=keycloak`, `CRYPTO_PROVIDER=...`) and by appending overlay services — never by patching CE-file YAML.

### 6. Image tag convention

| Layer | Registry namespace |
|---|---|
| CE | `ghcr.io/acumenus-data-sciences/parthenon-<service>:${PARTHENON_IMAGE_TAG:-latest}` |
| EE | `ghcr.io/acumenus-data-sciences/parthenon-ee-<service>:${PARTHENON_EE_IMAGE_TAG:-latest}` |

Both registries can coexist. Anything pushed to ghcr.io under a different organization is a contract violation in a CE compose file.

### 7. Port allocation

CE owns `8080-8099` (exposed) and `5500-5599` (dev). EE-introduced services MUST request host ports `>= 8100` to avoid conflicts when both editions run on the same Docker host.

### 8. Healthcheck stability

Every CE service has a `healthcheck:` block. EE overrides MUST NOT replace these with weaker or faster ones. EE may add ADDITIONAL `depends_on: { condition: service_healthy }` constraints but MUST NOT relax existing ones. The verifier rejects EE healthchecks whose `test` is a no-op (`["CMD-SHELL", "true"]`).

### 9. Profile usage

Compose profiles (`profiles: [...]`) are reserved for **opt-in CE features** (e.g. `profiles: [tour]`). EE does NOT use profiles to gate enterprise services — those gate via overlay file selection at compose-up time. The rule is simple: "if it's loaded, it runs."

### 10. `extra_hosts` is additive (R8)

EE overrides MAY add entries to a stable service's `extra_hosts:` block (e.g. `host.docker.internal:host-gateway` for IdP federation testing on developer hosts, or pinning an internal hostname to a specific IP). EE MUST NOT remove or override CE-added `extra_hosts` entries. When both files declare `extra_hosts:` for the same service, they MUST merge — never replace.

## What an EE override is allowed to do

For any `STABLE_SERVICE_NAMES` entry, EE may set:

- `environment:` — additive merge with CE
- `volumes:` — additive
- `depends_on:` — additive, MUST NOT weaken
- `image:` — only if EE is shipping a different image (e.g. FIPS-built PHP). The image MUST satisfy the same healthcheck.
- `command:` — only if the new command preserves the documented behavior of the service.
- `extra_hosts:` — additive (R8)

For any `STABLE_SERVICE_NAMES` entry, EE MUST NOT:

- Remove the service via `services: { <name>: !reset }`
- Rename the container (`container_name:`)
- Replace the network membership (`networks:`) — adding additional networks is OK
- Replace the healthcheck with a passing-by-default no-op
- Change the exposed host port (`ports:`) — adding additional internal ports is OK

## Examples

### Valid EE overlay (Keycloak side-car)

```yaml
# enterprise/docker-compose.ee.yml
services:
  keycloak:
    container_name: parthenon-ee-keycloak
    image: ghcr.io/acumenus-data-sciences/parthenon-ee-keycloak:latest
    ports:
      - "8181:8080"           # >= EE_PORT_FLOOR (8100)
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health/ready"]
      interval: 30s
    networks:
      - parthenon-ee-keycloak
      - acumenus              # join CE network
    volumes:
      - parthenon-ee-keycloak-data:/opt/keycloak/data

  php:                        # extending a stable service is allowed
    environment:
      AUTH_DRIVER: keycloak
      KEYCLOAK_REALM_URL: http://keycloak:8080/realms/parthenon
    extra_hosts:              # R8: additive merge with CE
      - "keycloak.local:host-gateway"

volumes:
  parthenon-ee-keycloak-data:

networks:
  parthenon-ee-keycloak:
```

### Invalid EE overlay (renames a stable container)

```yaml
# ❌ FAILS rule 2: stable container_name override
services:
  php:
    container_name: parthenon-ee-php-fips
```

### Invalid EE overlay (low port collision)

```yaml
# ❌ FAILS rule 7: host port < 8100
services:
  keycloak:
    ports:
      - "8081:8080"
```

### Invalid EE overlay (weak healthcheck)

```yaml
# ❌ FAILS rule 8: passing-by-default healthcheck
services:
  php:
    healthcheck:
      test: ["CMD-SHELL", "true"]
```

### Invalid EE overlay (unprefixed volume)

```yaml
# ❌ FAILS rule 3: EE volume must be parthenon-ee-* prefixed
volumes:
  keycloak-data:
```

## Running the verifier

Locally:

```bash
# Verify CE only (no EE checkout required)
python3 scripts/verify_compose_contract.py

# Verify an EE overlay file (strict EE rules)
python3 scripts/verify_compose_contract.py --check-ee /path/to/Parthenon-EE/enterprise/docker-compose.ee.yml

# Verify a CE-bundled infrastructure overlay (relaxed rules — see below)
python3 scripts/verify_compose_contract.py --check-infra-overlay acropolis/docker-compose.enterprise.yml

# Run the verifier's own unit tests
pytest scripts/verify_compose_contract_test.py -q
```

### Infrastructure-overlay mode (`--check-infra-overlay`)

`acropolis/docker-compose.enterprise.yml` is a **CE-bundled infrastructure overlay**, not the EE-tier code overlay this contract was originally written for. It composes upstream third-party services (Authentik, Superset, DataHub, Wazuh) using their canonical images and conventional volume/network names. Renaming `superset_db_data` to `parthenon-ee-superset-db` would break upgrade paths and confuse anyone following an Authentik or Wazuh deployment guide.

`--check-infra-overlay` applies a **relaxed** subset of the rules to these files:

| Rule | EE overlay (`--check-ee`) | Infra overlay (`--check-infra-overlay`) |
| --- | --- | --- |
| Container-name shape (`parthenon-*` / `acropolis-*`) | Enforced | Enforced |
| Stable-service protection (no renaming, no weakened healthchecks) | Enforced | Enforced |
| Volume name prefix (`parthenon-ee-*`) | Required | Relaxed (upstream conventions OK) |
| Network name prefix (`parthenon-ee-*`) | Required | Relaxed |
| Image namespace (`ghcr.io/acumenus-data-sciences/parthenon-ee-*`) | Required | Relaxed (upstream images OK) |
| Port floor (`>= 8100`) | Required | Relaxed (upstream conventions OK) |

Treating `acropolis/docker-compose.enterprise.yml` as a strict EE overlay produces ~27 spurious violations. Treat it as an infra overlay instead.

CI (`.github/workflows/compose-contract.yml`):

- Runs on every PR that touches a compose file or the verifier itself.
- Runs on every push to `main`.
- Uses Python 3.12, installs `pyyaml` + `pytest`, runs the default CE walk, the infra-overlay check on `acropolis/docker-compose.enterprise.yml`, and the unit tests.

## Out of scope

- **Authoring** `enterprise/docker-compose.ee.yml` — Plan 04 (EE first-pass migration).
- Cross-edition smoke tests where both stacks run side-by-side on one host — separate plan.
- Compose v2 → v3 migration — orthogonal upgrade.
- Kubernetes Helm chart equivalents — already tracked in the Acropolis enterprise overlay (`acropolis/k8s/`).

## Anti-patterns

- ❌ Don't reach into CE compose files from EE via inline YAML patches. Use overlay files only.
- ❌ Don't use Compose profiles to gate EE services — load them via overlay file selection at `docker compose up` time.
- ❌ Don't bind EE host ports below `8100` — that range is CE territory and would collide.
- ❌ Don't introduce volumes/networks without the `parthenon-ee-` prefix from EE.
- ❌ Don't weaken stability annotations on stable services (renaming, removing, weakening healthchecks). Operator scripts and dashboards depend on them.
