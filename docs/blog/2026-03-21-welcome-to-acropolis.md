---
slug: welcome-to-acropolis
title: "Welcome to Acropolis: One Command from Clone to Production"
authors: [mudoshi, claude]
tags: [infrastructure, acropolis, traefik, docker, devops, architecture, installer, deployment, portainer, enterprise]
date: 2026-03-21
---

Eighteen Docker services. Three environment files. A reverse proxy with auto-TLS. Database admin GUI. Container management dashboard. Enterprise SSO. And if you want the full stack? One command:

```bash
python3 install.py --with-infrastructure
```

This is the story of how we built Acropolis — the infrastructure layer that turns Parthenon from a research application into a production platform — and what we learned when we decided to ship it inside the same repository.

<!-- truncate -->

## Why Infrastructure Belongs in the Application

For two months, Parthenon ran in production with a manual deployment story. Apache sat in front, configured by hand. No auto-TLS — I renewed certificates manually. No container management UI — if a researcher reported a problem, I SSHed in and ran `docker compose ps`. No centralized log view — I `grep`'d through container logs one at a time.

This works when you're the only operator. It stops working the moment someone else needs to deploy it.

The OHDSI community has a deployment problem that mirrors ours. Atlas requires a WebAPI backend (Java), an R runtime, a CDM database, and a web server. Each has its own configuration. Most institutions spend weeks getting Atlas running, and many never get past the installation phase. We built Parthenon to collapse that complexity. But we'd only collapsed the *application* complexity — the infrastructure was still manual.

So we built Acropolis.

## What Acropolis Provides

Acropolis is not a separate application. It's a production infrastructure layer that wraps Parthenon with everything an operator needs:

| Layer | Service | What It Does |
|-------|---------|-------------|
| **Reverse Proxy** | Traefik v3.3 | Auto-TLS via Let's Encrypt, subdomain routing for every service, HTTP→HTTPS redirect |
| **Container Management** | Portainer CE | Web GUI for Docker — restart containers, view logs, manage volumes |
| **Database Admin** | pgAdmin 4 | Pre-configured with Parthenon's PostgreSQL connection |
| **Workflow Automation** | n8n | ETL pipelines, quality check automation, alerting (Enterprise) |
| **BI Dashboards** | Apache Superset 4.1 | SQL analytics and visualization over OMOP CDM data (Enterprise) |
| **Data Catalog** | DataHub v0.15 | Track data lineage from raw sources through OMOP to analysis outputs (Enterprise) |
| **SSO** | Authentik 2025.2 | SAML/OIDC identity provider for all services (Enterprise) |

Two editions: **Community** (Traefik + Portainer + pgAdmin, free under Apache 2.0) and **Enterprise** (adds n8n, Superset, DataHub, Authentik — license-gated).

After installation, every service gets a subdomain:

```
https://parthenon.acumenus.net     — The research platform
https://portainer.acumenus.net     — Container management
https://pgadmin.acumenus.net       — Database administration
https://grafana.acumenus.net       — Monitoring dashboards
https://ai.acumenus.net            — AI service (MedGemma)
https://jupyter.acumenus.net       — JupyterHub notebooks
https://solr.acumenus.net          — Search administration
https://darkstar.acumenus.net      — R analytics runtime
https://n8n.acumenus.net           — Workflow automation (Enterprise)
https://superset.acumenus.net      — BI dashboards (Enterprise)
```

All with automatic TLS certificates. No nginx config files. No manual cert rotation.

## The Two-Repo Problem

Acropolis started as a separate repository. The logic was clean: Parthenon is the application, Acropolis is the infrastructure. Separate concerns, separate repos, separate release cycles.

In practice, this created a coordination nightmare.

The Acropolis installer needed to know Parthenon's container names. Parthenon's compose file defined them. If we renamed a service — say, `r-runtime` became `darkstar` — the Acropolis service registry broke silently. Traefik routed to a container that no longer existed.

The Acropolis installer also needed to run Parthenon's installer. We solved this with a subprocess call:

```python
# The old way: Acropolis shelling out to Parthenon
subprocess.run([
    "python3", str(parthenon_path / "install.py"),
    "--defaults-file", str(defaults_file),
])
```

This meant Acropolis had to clone or locate the Parthenon repo, manage path resolution across the two repos, pass credentials through a temporary JSON file, and then detect what Parthenon's installer had done after the fact. Four topology modes — `fresh_install`, `local`, `remote`, `standalone` — each with different code paths.

When we tested this on a VM, three bugs surfaced in the first run:

1. **Port detection used `bind()` instead of `connect_ex()`** — `bind()` requires elevated privileges on ports below 1024. Acropolis couldn't check if ports 80 and 443 were free on a fresh Ubuntu 24.04 install.

2. **Docker Compose prefixed the network name** — Parthenon's compose file declared a network called `parthenon`, but Docker Compose automatically prepended the project name, creating `parthenon_parthenon`. Acropolis checked for `parthenon` and didn't find it.

3. **Internal services flagged as "unknown"** — PHP, PostgreSQL, Redis, Horizon, and other non-routable containers showed up in Docker network inspection but weren't in the curated service registry. The installer prompted the user to configure Traefik routes for `parthenon-php` — a backend container that should never be exposed.

All three were fixable. But they were symptoms of a deeper issue: **two repos that had to agree on implementation details but couldn't enforce that agreement at build time.**

The final straw was a port mismatch we discovered during the consolidation. The Acropolis service registry listed nginx at port 8082:

```python
CuratedService("nginx", "parthenon-nginx", 8082, "parthenon", "always")
```

But 8082 is the *host-mapped* port. Inside the Docker network — where Traefik connects — nginx listens on port 80. The static Traefik config file (`traefik/dynamic/parthenon.yml`) had the correct port, because it was written by hand. But the auto-generator in `routing.py` read from the registry and would produce:

```yaml
# Wrong — 8082 is the host port, not the container port
services:
  parthenon-parthenon:
    loadBalancer:
      servers:
        - url: "http://parthenon-nginx:8082"
```

The same mismatch existed for three other services: `python-ai` (8002 vs 8000), `morpheus-ingest` (8004 vs 8000), and `jupyterhub` (8888 vs 8000). All had host-mapped ports in the registry where container-internal ports belonged.

This class of bug is invisible in manual testing — the static config works fine. It only surfaces when the auto-generator runs during a fresh installation. And it would have been impossible if both the container definitions and the service registry lived in the same repository.

## The Consolidation

We moved everything into `Parthenon/acropolis/`:

```
acropolis/
├── installer/              14 Python modules (~2,000 lines)
│   ├── cli.py              Phase orchestrator
│   ├── topology.py         Parthenon detection (simplified to local-only)
│   ├── editions.py         Community / Enterprise selection
│   ├── discovery.py        24-service curated registry
│   ├── config.py           Domain, TLS, credentials collection
│   ├── network.py          Docker network bridging
│   ├── deploy.py           Docker compose orchestration + health polling
│   ├── routing.py          Traefik dynamic config generation
│   ├── generator.py        Day-2 CLI script generator
│   ├── verify.py           Post-install smoke tests
│   ├── preflight.py        System validation
│   ├── state.py            Resume-on-failure state machine
│   └── utils.py            Docker, network, and password utilities
├── docker-compose.base.yml       Traefik + acropolis_network
├── docker-compose.community.yml  Portainer + pgAdmin
├── docker-compose.enterprise.yml n8n + Superset + DataHub + Authentik
├── traefik/                      Static + dynamic route configs
├── config/                       pgAdmin servers, Superset config
├── k8s/                          Helm charts + Kustomize overlays
└── tests/                        6 unit test files + smoke test
```

The key architectural changes:

### Direct Import Instead of Subprocess

The Acropolis installer now imports Parthenon's installer as a Python module:

```python
# The new way: direct import in the same repo
from installer.cli import run as run_parthenon_installer
run_parthenon_installer(pre_seed={
    "admin_email": config.parthenon_admin_email,
    "admin_name": config.parthenon_admin_name,
    "admin_password": config.parthenon_admin_password,
    "app_url": f"https://parthenon.{config.domain}",
    "timezone": config.timezone,
})
```

No temporary credentials file. No path resolution. No subprocess exit code interpretation. If the Parthenon installer raises an exception, the Acropolis installer catches it in the same process.

### Topology Simplified to Local-Only

The four topology modes collapsed into one. In a monorepo, Parthenon is always the parent directory:

```python
ACROPOLIS_ROOT = Path(__file__).resolve().parent.parent  # acropolis/
PARTHENON_ROOT = ACROPOLIS_ROOT.parent                    # Parthenon/
```

The `fresh_install` mode (clone Parthenon from GitHub) is gone. The `remote` mode (connect to Parthenon on another host) is gone. The `standalone` mode (Acropolis without Parthenon) is gone. The installer detects whether Parthenon's containers are already running and installs them if not.

### Stable Network Name

We added `name: parthenon` to the Docker network definition:

```yaml
networks:
  parthenon:
    name: parthenon    # Prevents Docker from prefixing as "parthenon_parthenon"
    driver: bridge
```

This one line eliminated the network detection logic that had to check three candidate names.

## The Service Registry: 24 Containers, Mapped

Acropolis maintains a curated registry of every Parthenon container. This registry drives two things: Traefik route generation and post-install health checks.

```python
CURATED_SERVICES = [
    # Routable — exposed through Traefik with subdomains
    CuratedService("nginx",           "parthenon-nginx",           80,    "parthenon",    "always"),
    CuratedService("darkstar",        "parthenon-darkstar",        8787,  "darkstar",     "always"),
    CuratedService("python-ai",       "parthenon-ai",              8000,  "ai",           "always"),
    CuratedService("morpheus-ingest", "parthenon-morpheus-ingest", 8000,  "morpheus",     "always"),
    CuratedService("solr",            "parthenon-solr",            8983,  "solr",         "if_running"),
    CuratedService("jupyterhub",      "parthenon-jupyterhub",      8000,  "jupyter",      "if_running"),
    CuratedService("grafana",         "parthenon-grafana",         3000,  "grafana",      "if_running"),
    CuratedService("study-agent",     "parthenon-study-agent",     8765,  "study-agent",  "if_running"),
    CuratedService("hecate",          "parthenon-hecate",          8080,  "hecate",       "if_running"),
    # ... plus 15 more (reverb, prometheus, whiterabbit, fhir-to-cdm, orthanc, etc.)

    # Internal — recognized but never routed
    CuratedService("php",       "parthenon-php",       9000, "", "internal"),
    CuratedService("postgres",  "parthenon-postgres",  5432, "", "internal"),
    CuratedService("redis",     "parthenon-redis",     6379, "", "internal"),
    CuratedService("horizon",   "parthenon-horizon",   0,    "", "internal"),
    CuratedService("chromadb",  "parthenon-chromadb",  8000, "", "internal"),
    # ... plus 4 more monitoring containers
]
```

Every port in this registry is the **container-internal** port — the one Traefik connects to over the Docker network. Not the host-mapped port. This distinction cost us four bugs before we learned it.

The registry also drives auto-discovery. When the installer scans the Docker network, it matches running containers against this list. Known containers get their predefined subdomain. Unknown containers prompt the user: "Expose `parthenon-custom-service` through Traefik?"

## The Network Bridge

Parthenon and Acropolis services run on separate Docker networks. This is intentional — Parthenon's internal services (PHP, PostgreSQL, Redis) should not be accessible from the Acropolis network, and vice versa.

The bridge works through selective attachment. During Phase 6 (Network Setup), the installer connects only the *routable* Parthenon containers to `acropolis_network`:

```
┌─────────────────────────────────────────────────────────┐
│                    acropolis_network                      │
│                                                          │
│  traefik ──→ parthenon-nginx:80                          │
│          ──→ parthenon-darkstar:8787                     │
│          ──→ parthenon-ai:8000                           │
│          ──→ parthenon-grafana:3000                      │
│          ──→ parthenon-solr:8983                         │
│                                                          │
│  portainer ──→ /var/run/docker.sock                      │
│  pgadmin   ──→ host.docker.internal:5432                 │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    parthenon (internal)                   │
│                                                          │
│  nginx ↔ php ↔ postgres ↔ redis ↔ horizon               │
│  python-ai ↔ chromadb ↔ study-agent                     │
│  darkstar ↔ solr ↔ hecate ↔ qdrant                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Containers like `parthenon-nginx` exist on both networks simultaneously. They can reach internal services via the `parthenon` network and receive external traffic from Traefik via `acropolis_network`.

This is rolled back automatically if the installation fails. The rollback disconnects each container from `acropolis_network` and removes the network if it was created during installation.

## The Unified Installer

The final product is a single entry point with two modes:

```bash
# Application only — local development, no infrastructure overhead
python3 install.py

# Full stack — application + infrastructure (Traefik, Portainer, pgAdmin, Enterprise)
python3 install.py --with-infrastructure
```

The `--with-infrastructure` flag runs the Acropolis orchestrator, which in turn calls the Parthenon installer internally. The combined flow:

**Acropolis Phase 1** — Preflight: Docker version, daemon running, ports 80/443 free, disk space.

**Acropolis Phase 2** — Topology: Detect whether Parthenon is already running. If yes, skip Parthenon installation. If no, run it after configuration.

**Acropolis Phase 3** — Edition: Community or Enterprise. Enterprise requires a license key (`ACRO-XXXX-XXXX-XXXX` format).

**Acropolis Phase 4** — Service Discovery: Enumerate running Parthenon containers and match against the 24-service registry.

**Acropolis Phase 5** — Configuration: Domain, TLS mode (Let's Encrypt, self-signed, or none), timezone, per-service credentials (pgAdmin, Portainer, and optionally n8n, Superset, DataHub, Authentik).

**Parthenon Phases 1-9** — If Parthenon isn't running: preflight, configuration (pre-seeded from Acropolis), Docker pull/build/start, Laravel bootstrap (composer, migrate, seed), Eunomia demo data, frontend build, Solr indexing, admin account creation.

**Acropolis Phase 6** — Network: Create `acropolis_network`, connect routable Parthenon containers.

**Acropolis Phase 7** — Deploy: `docker compose up -d` for infrastructure services, health polling with live-updating terminal table.

**Acropolis Phase 8** — Routing: Generate Traefik dynamic configs for every discovered service. WebSocket support for Laravel Reverb. Security headers and compression middleware.

**Acropolis Phase 9** — Verification: Smoke test every service. Generate `acropolis.sh` day-2 operations script. Display URL matrix with credentials.

State persistence through `.install-state.json` means any phase can fail and the installer resumes from the last completed phase. Credentials never touch the state file — they're stored separately in `.install-credentials` with `chmod 0600`.

## Day-2 Operations

After installation, the generated `acropolis.sh` script handles ongoing operations:

```bash
./acropolis.sh up              # Start infrastructure services
./acropolis.sh down            # Stop everything
./acropolis.sh status          # Health overview of all services
./acropolis.sh logs [service]  # Follow logs
./acropolis.sh urls            # Print full URL matrix
./acropolis.sh backup          # Backup all volumes to timestamped archives
./acropolis.sh smoke-test      # Re-run health checks
./acropolis.sh update          # Pull latest images and restart
```

This script is standalone bash with embedded configuration — no Python dependency for day-2 ops. It knows which compose files to use (base, community, enterprise) and which domain to display in URLs.

## What We Learned

**Host ports and container ports are different.** Obvious in hindsight. Docker's `8082:80` mapping means port 8082 on the host, port 80 in the container. Traefik, running inside Docker, connects via the Docker network to port 80. We got this wrong in four services and found it only during consolidation — the static Traefik config had been hand-written with the correct ports, masking the bug in the auto-generator.

**Docker Compose network naming is unpredictable.** A network declared as `parthenon` in a compose file whose project name is also `parthenon` becomes `parthenon_parthenon`. Adding `name: parthenon` to the network definition forces the exact name. One YAML line saved us a detection function that checked three candidate names.

**Monorepos enforce interface contracts.** When the service registry and the container definitions live in the same repository, a rename shows up in `git diff`. When they're in separate repos, it shows up in production. We caught four port mismatches, one network name issue, and would have caught the container rename from `r-runtime` to `darkstar` automatically if we'd been in a monorepo from the start.

**Subprocess calls across repos are fragile.** Path resolution, environment variable inheritance, exit code semantics, credential passing through temporary files — every one of these is a failure mode. A direct Python import eliminates all of them.

**Infrastructure as code means infrastructure in the same repo as the code.** Not in a separate repo that references the code. Not in a wiki page. In the same `git blame` history, the same CI pipeline, the same pull request review.

## What's Next

The Acropolis layer is functional but young. On the roadmap:

- **Authentik SSO integration with Parthenon's Sanctum auth** — OIDC provider in Authentik, client in Laravel, so researchers sign in once for the entire platform.
- **Pre-built Superset dashboards for OMOP CDM** — demographic breakdowns, condition prevalence, drug utilization, and data quality metrics, all pointing at Parthenon's PostgreSQL.
- **n8n workflow templates** — automated Achilles runs on new data loads, DQD quality gates, Slack notifications on analysis completion.
- **Kubernetes Helm chart finalization** — the chart structure exists but values need pinning for production HA deployments.

The `Acropolis-v2` repository is now deprecated. All development continues in the Parthenon monorepo under `acropolis/`.

---

If you're deploying Parthenon and want the full infrastructure stack:

```bash
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon
python3 install.py --with-infrastructure
```

That's it. One repo, one command, one platform.
