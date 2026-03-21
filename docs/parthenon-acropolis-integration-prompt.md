# Agent Prompt: Integrate Acropolis as Parthenon's Default Installer

## Context

You are working on the **Parthenon** project (`/home/smudoshi/Github/Parthenon`). Parthenon is a unified OHDSI outcomes research platform. It currently has its own `install.py` with a 9-phase interactive installer.

**Acropolis** (`/home/smudoshi/Github/Acropolis-v2`, branch `feature/unified-installer`) is the infrastructure orchestration layer that sits in front of Parthenon. It provides:
- **Traefik** reverse proxy with auto-TLS and subdomain routing for all services
- **Portainer** and **pgAdmin** (Community tier)
- **n8n, Superset, DataHub, Authentik** (Enterprise tier, license-gated)
- Unified service discovery, health monitoring, and day-2 operations

Acropolis has a 9-phase Python TUI installer that can orchestrate a fresh Parthenon deployment. It collects Parthenon admin credentials during its Phase 5 (config), writes a JSON defaults file, and passes it to Parthenon's installer via the `--defaults-file` flag we just added.

**Your task:** Make Acropolis the recommended/default installation path for Parthenon. When a user wants to deploy Parthenon with production infrastructure (TLS, reverse proxy, monitoring dashboards, SSO), they should run Acropolis's installer, which handles everything.

---

## What Already Exists

### Parthenon Side (already committed to `main`)

1. **`install.py`** — We just added `--defaults-file` support:
   ```python
   def main() -> None:
       args = _parse_args()  # --defaults-file flag
       _ensure_deps()
       import json
       from installer.cli import run
       defaults = None
       if args.defaults_file:
           defaults = json.loads(Path(args.defaults_file).read_text())
       run(pre_seed=defaults)
   ```

2. **`installer/cli.py`** — `run()` accepts `pre_seed` dict:
   ```python
   def run(*, non_interactive: bool = False, pre_seed: dict[str, Any] | None = None) -> None:
       # Merges pre_seed into config defaults for questionary prompts
       if pre_seed and not cfg:
           cfg = dict(pre_seed)
   ```

   The `pre_seed` dict can include: `admin_email`, `admin_name`, `admin_password`, `app_url`, `timezone` — these pre-populate the interactive prompts so the user sees Acropolis-supplied values as defaults (still editable).

### Acropolis Side (on `feature/unified-installer` branch)

1. **`installer/topology.py`** — Phase 2 has 4 topology modes:
   - `fresh_install` — Clones Parthenon, defers install to after config collection
   - `local` — Detects existing Parthenon via Docker network inspection
   - `remote` — Accepts URL to a Parthenon on another host
   - `standalone` — Acropolis without Parthenon

2. **`installer/config.py`** — Phase 5 collects Parthenon admin email/name/password when topology is `fresh_install`. Writes `.parthenon-defaults.json` (chmod 0600) consumed by `--defaults-file`.

3. **`installer/discovery.py`** — Curated registry of 24 Parthenon services:
   - 15 routable (nginx, darkstar, python-ai, morpheus-ingest, solr, jupyterhub, finngen-runner, reverb, grafana, prometheus, study-agent, hecate, whiterabbit, fhir-to-cdm, orthanc)
   - 9 internal/non-routable (php, postgres, redis, horizon, chromadb, loki, alloy, cadvisor, node-exporter)

4. **`installer/routing.py`** — Generates Traefik dynamic configs with subdomain routing (`{service}.{domain}`) for all discovered Parthenon services. Supports TLS modes: `letsencrypt`, `selfsigned`, `none`.

5. **`installer/cli.py`** — After Phase 5 config, if topology is `fresh_install`, it:
   - Writes `.parthenon-defaults.json` with admin creds + app_url + timezone
   - Launches `python3 install.py --defaults-file /path/to/.parthenon-defaults.json` in Parthenon directory
   - Cleans up defaults file after install
   - Detects the Parthenon Docker network post-install

---

## What You Need to Do

### 1. Update Parthenon's README / Getting Started

Update Parthenon's README to present two installation paths:

**Quick Start (standalone):**
```bash
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon
python3 install.py
```

**Recommended (with Acropolis infrastructure):**
```bash
git clone https://github.com/sudoshi/Acropolis.git
cd Acropolis
python3 install.py
# → Select "Yes, install fresh" when asked about Parthenon
# → Acropolis clones and installs Parthenon automatically
```

The recommended path gives users Traefik (auto-TLS, subdomain routing), Portainer (container management), pgAdmin (database GUI), and optionally n8n, Superset, DataHub, and Authentik SSO.

### 2. Ensure Parthenon's Docker Network is Discoverable

Acropolis discovers Parthenon by inspecting Docker networks. Make sure Parthenon's `docker-compose.yml` creates a predictable network name.

**Current state:** Parthenon's compose creates a default network. Docker Compose prefixes it with the project name, resulting in `parthenon_parthenon` or `parthenon_default`. Acropolis already checks multiple candidates:
```python
candidates = ("parthenon_parthenon", "parthenon_default", "parthenon")
```

**What to verify:** Check Parthenon's `docker-compose.yml` network declarations. If there's no explicitly named network, consider adding one:
```yaml
networks:
  parthenon:
    name: parthenon
```

This gives Acropolis a stable, predictable network name to discover. The `name:` field overrides the compose project prefix.

### 3. Ensure Container Names Are Stable

Acropolis's service registry matches containers by name (e.g., `parthenon-nginx`, `parthenon-darkstar`). Verify that Parthenon's `docker-compose.yml` uses `container_name:` for all services. The expected names are:

| Service | Expected container_name |
|---------|------------------------|
| nginx | `parthenon-nginx` |
| php | `parthenon-php` |
| postgres | `parthenon-postgres` |
| redis | `parthenon-redis` |
| darkstar (R) | `parthenon-darkstar` |
| python-ai | `parthenon-ai` |
| morpheus-ingest | `parthenon-morpheus-ingest` |
| solr | `parthenon-solr` |
| horizon | `parthenon-horizon` |
| reverb | `parthenon-reverb` |
| jupyterhub | `parthenon-jupyterhub` |
| finngen-runner | `parthenon-finngen-runner` |
| chromadb | `parthenon-chromadb` |
| grafana | `parthenon-grafana` |
| prometheus | `parthenon-prometheus` |
| loki | `parthenon-loki` |
| alloy | `parthenon-alloy` |
| cadvisor | `parthenon-cadvisor` |
| node-exporter | `parthenon-node-exporter` |
| study-agent | `parthenon-study-agent` |
| hecate | `parthenon-hecate` |
| whiterabbit | `parthenon-whiterabbit` |
| fhir-to-cdm | `parthenon-fhir-to-cdm` |
| orthanc | `parthenon-orthanc` |

If any container names differ from this list, either:
- Update the `container_name` in Parthenon's compose file, OR
- Document the actual names so we can update Acropolis's registry

### 4. Ensure Parthenon nginx Accepts Connections from External Networks

When Acropolis connects Parthenon's nginx container to `acropolis_network`, Traefik routes traffic to `http://parthenon-nginx:8082`. Verify that:

- Parthenon's nginx listens on port 8082 inside the container (not just 80)
- nginx doesn't have IP-based access restrictions that would block requests from the `acropolis_network` subnet
- The nginx config serves the app on all interfaces (`0.0.0.0`), not just localhost

### 5. Add Acropolis-Aware Health Endpoint (Optional but Recommended)

Acropolis runs smoke tests against Parthenon services after deployment. Currently it just does HTTP requests and checks for 200/302 responses. Consider adding a lightweight health endpoint that Acropolis can poll:

```
GET /api/health → {"status": "ok", "version": "1.0.2", "services": {...}}
```

This is optional — Acropolis works without it — but it would enable richer health reporting in the post-install verification and the generated `acropolis.sh status` command.

### 6. Update Parthenon's Installer to Emit Machine-Readable Output

When Parthenon's installer runs as a subprocess of Acropolis, Acropolis needs to know:
- Did the install succeed? (currently uses exit code — this works)
- What services are running? (currently auto-discovered via Docker — this works)
- What are the admin credentials? (currently passed IN via `--defaults-file`, echoed back in `.install-credentials` — this works)

**One improvement:** After Parthenon's installer completes, Acropolis reads Parthenon's `.install-credentials` to verify the admin account was created. Currently this file is JSON:
```json
{
  "app_url": "https://parthenon.acumenus.net",
  "admin_email": "admin@acumenus.net",
  "admin_password": "...",
  "db_password": "..."
}
```

Make sure this file is always written, even on partial success, so Acropolis can report accurate credential info. **Do not change the format** — Acropolis already parses this JSON.

### 7. Document the `--defaults-file` Contract

Add a section to Parthenon's installer docs (or a docstring in `installer/config.py`) documenting the `--defaults-file` JSON schema:

```json
{
  "admin_email": "admin@acumenus.net",
  "admin_name": "Administrator",
  "admin_password": "auto-generated-or-user-supplied",
  "app_url": "https://parthenon.acumenus.net",
  "timezone": "America/New_York",
  "experience": "experienced",
  "db_password": "optional-override"
}
```

All fields are optional — they pre-populate questionary prompts but don't bypass them. The user can still edit any value during the interactive flow.

---

## What NOT to Change

- **Do not modify Parthenon's core installer logic.** The `--defaults-file` integration is already done. The installer phases, state persistence, and config collection work as-is.
- **Do not add Acropolis as a dependency.** Parthenon must remain independently installable via `python3 install.py` without Acropolis.
- **Do not change Parthenon's monitoring stack.** Parthenon owns its Prometheus/Grafana/Loki/Alloy/cAdvisor/node-exporter. Acropolis deliberately does NOT duplicate this — it was an explicit architectural decision.
- **Do not change the `.install-credentials` JSON format.** Acropolis reads this file.
- **Do not change container names** without coordinating with the Acropolis registry update.

---

## Key Files to Reference

**Acropolis (read-only, for reference):**
- `/home/smudoshi/Github/Acropolis-v2/docs/superpowers/specs/2026-03-20-unified-installer-design.md` — Full design spec
- `/home/smudoshi/Github/Acropolis-v2/docs/devlog/2026-03-20-unified-installer.md` — Implementation devlog with bug fixes
- `/home/smudoshi/Github/Acropolis-v2/docs/testing/2026-03-21-vm-integration-test-report.md` — VM test results, 3 bugs found/fixed
- `/home/smudoshi/Github/Acropolis-v2/installer/discovery.py` — Curated service registry (source of truth for container names)
- `/home/smudoshi/Github/Acropolis-v2/installer/topology.py` — How Acropolis discovers and connects to Parthenon
- `/home/smudoshi/Github/Acropolis-v2/installer/routing.py` — How Traefik routes are generated per service
- `/home/smudoshi/Github/Acropolis-v2/installer/config.py` — `write_parthenon_defaults()` — what goes in the defaults file

**Parthenon (your workspace):**
- `/home/smudoshi/Github/Parthenon/install.py` — Entry point with `--defaults-file`
- `/home/smudoshi/Github/Parthenon/installer/cli.py` — `run(pre_seed=...)` integration point
- `/home/smudoshi/Github/Parthenon/installer/config.py` — Config collection, `.install-credentials` output
- `/home/smudoshi/Github/Parthenon/docker-compose.yml` — Service definitions, network config, container names

---

## VM Testing

A test VM is available at `192.168.1.48` (Ubuntu 24.04, 4 cores, 16GB RAM). The following scenarios have been tested from the Acropolis side:

| Test | Result |
|------|--------|
| Community tier, standalone Acropolis | PASS |
| Community tier, local Parthenon | PASS |
| Resume-on-failure | PASS |
| Generated acropolis.sh commands | PASS |
| Traefik→Parthenon routing | PASS |

**Known issues already fixed in Acropolis:**
- `is_port_free()` needed `connect_ex` instead of `bind` for privileged ports
- Standalone mode needs the `parthenon` Docker network pre-created (compose declares it external)
- Docker Compose prefixes network names (`parthenon_parthenon` vs `parthenon`) — detection checks multiple candidates
- PEP 668 on Ubuntu 24.04 — Acropolis auto-creates a `.venv/`
- Internal services (php, postgres, redis, etc.) were flagged as "unknown" — now in registry as `internal` type

---

## Summary of Changes Needed (Checklist)

- [ ] Update README with Acropolis as recommended installation path
- [ ] Verify/add explicit network name in `docker-compose.yml` (`name: parthenon`)
- [ ] Verify all container names match the registry table above
- [ ] Verify nginx accepts connections from external Docker networks
- [ ] (Optional) Add `/api/health` endpoint for richer Acropolis health checks
- [ ] Verify `.install-credentials` is always written
- [ ] Document `--defaults-file` JSON schema in installer code
