# Installer Update — Parthenon v1.0.3

**Date:** 2026-03-28
**Release Target:** 2026-03-31 (Monday)
**Scope:** Both installers (Parthenon + Acropolis), changelog, release notes, config updates

---

## 1. Service Registry & Discovery Updates

### `acropolis/installer/discovery.py`

**Removed from curated registry:**
- `parthenon-whiterabbit` (replaced by blackrabbit)

**Added/Updated:**

| Container | Port | Subdomain | Default | Notes |
|---|---|---|---|---|
| `parthenon-blackrabbit` | 8090 | `blackrabbit` | if_running | Replaces whiterabbit |
| `parthenon-arachne-datanode` | 8880 | `arachne` | if_running | Opt-in profile service |
| `parthenon-qdrant` | 6333 | `qdrant` | internal | REST API now exposed |
| `parthenon-hecate` | 8088 | `hecate` | if_running | Port changed from 8080 |

LiveKit is external (LiveKit Cloud) — no registry entry. Credentials collected during config phase.

### Graceful WhiteRabbit → BlackRabbit Migration

When discovery finds `parthenon-whiterabbit` running but no `parthenon-blackrabbit`:

1. Display: "WhiteRabbit has been replaced by BlackRabbit in v1.0.3 (adds SQL Server, Synapse, and Oracle support)"
2. Prompt: "Would you like to migrate now? This will stop WhiteRabbit and start BlackRabbit. [Y/n]"
3. If yes: `docker compose stop whiterabbit && docker compose up -d blackrabbit`
4. Re-run discovery to pick up the new container

---

## 2. Parthenon Installer — New Environment Variables

### Interactive Prompts (Security-Sensitive)

**LiveKit Configuration** — prompted when user enables Commons module:

```
═══ LiveKit (Voice/Video Calls) ═══
LiveKit URL [ws://localhost:7880]:
LiveKit API Key:
LiveKit API Secret:
```

- Validation: URL must start with `ws://` or `wss://`
- API Key/Secret: non-empty, no default (forces explicit entry)
- Skip entirely if user declines Commons calls

**Orthanc Credentials** — prompted when Orthanc is detected/enabled:

```
═══ Orthanc DICOM Server ═══
Orthanc Username [parthenon]:
Orthanc Password: (auto-generated 24-char if left blank)
```

### Silent Defaults (Written to `.env` Without Prompting)

| Variable | Default | Notes |
|---|---|---|
| `HECATE_PORT` | `8088` | New port after redesign |
| `BLACKRABBIT_SCAN_TIMEOUT_SECONDS` | `1200` | 20 min scan timeout |
| `ARACHNE_CENTRAL_URL` | empty | Only relevant if profile enabled |
| `DATANODE_PORT` | `8880` | Arachne datanode |
| `HOST_UID` | auto-detect via `id -u` | No more hardcoded 1000 |
| `HOST_GID` | auto-detect via `id -g` | No more hardcoded 1000 |
| `DB_PORT` | `5432` | PostgreSQL port |
| `ORTHANC_AUTH_HEADER` | empty | Computed from credentials at runtime |

### Upgrade Behavior

When `--upgrade` detects an existing `.env`:
- New variables are appended with defaults, not overwritten
- Security-sensitive vars that are missing get prompted
- Existing values are preserved

---

## 3. Module-Grouped Interactive UX

### Service Groups

After base config (domain, TLS, timezone), present services organized by function:

```
╔══════════════════════════════════════════════╗
║        Parthenon v1.0.3 — Modules           ║
╠══════════════════════════════════════════════╣
║                                              ║
║  ▸ Research       Cohorts, Analyses, Studies ║
║    └ Arachne      Federated execution        ║
║    └ Darkstar     R runtime (HADES)          ║
║                                              ║
║  ▸ Commons        Workspace & collaboration  ║
║    └ LiveKit      Voice/video calls          ║
║                                              ║
║  ▸ AI & Knowledge                            ║
║    └ Hecate       Concept search & KG        ║
║    └ Phoebe       Concept recommendations    ║
║    └ Abby         AI assistant               ║
║                                              ║
║  ▸ Data Pipeline                             ║
║    └ BlackRabbit  Source profiling            ║
║    └ Aqueduct     ETL mapping                ║
║    └ Orthanc      DICOM imaging              ║
║                                              ║
║  ▸ Infrastructure                            ║
║    └ Solr         Search engine              ║
║    └ Qdrant       Vector database            ║
║    └ Redis        Cache & queues             ║
║                                              ║
╚══════════════════════════════════════════════╝

Enable modules: [all selected by default]
  ☑ Research    ☑ Commons    ☑ AI & Knowledge
  ☑ Data Pipeline    ☑ Infrastructure
```

**Behavior:**
- All modules selected by default — deselecting skips that group's prompts and disables those services in docker-compose profiles
- Only modules with security-sensitive config (Commons/LiveKit, Data Pipeline/Orthanc) trigger follow-up prompts
- Research, AI & Knowledge, Infrastructure use sensible defaults unless user drills in

### Acropolis Extension

Same pattern, with Acropolis services appended:

```
  ▸ Acropolis Community
    └ Traefik       Reverse proxy & TLS
    └ Portainer     Container management
    └ pgAdmin       Database admin

  ▸ Acropolis Enterprise
    └ n8n           Workflow automation
    └ Superset      Analytics & BI
    └ DataHub       Data catalog
    └ Authentik     SSO / Identity
```

---

## 4. `--upgrade` Flag & Version Detection

### Version File

The installer writes `.parthenon-version` at the project root:

```json
{
  "version": "1.0.3",
  "installed_at": "2026-03-30T14:00:00Z",
  "edition": "community",
  "modules": ["research", "commons", "ai_knowledge", "data_pipeline", "infrastructure"]
}
```

### `--upgrade` Flow

```bash
python3 install.py --upgrade
```

**Phase 1: Detect Current Installation**
- Read `.parthenon-version` — if missing, fall back to heuristics (check `.env`, running containers)
- Compare installed version against 1.0.3

**Phase 2: Show What Changed**

```
╔════════════════════════════════════════════════╗
║     Upgrading Parthenon: v1.0.2 → v1.0.3     ║
╠════════════════════════════════════════════════╣
║                                                ║
║  New Features:                                 ║
║    ✦ BlackRabbit — SQL Server, Synapse,       ║
║      Oracle profiling (replaces WhiteRabbit)   ║
║    ✦ LiveKit — Voice/video calls in Commons   ║
║    ✦ Arachne — Federated study execution      ║
║    ✦ Phoebe — Concept recommendations         ║
║    ✦ Aqueduct — Canvas UX overhaul            ║
║    ✦ Scribe API docs + Docusaurus reference   ║
║                                                ║
║  Upgraded:                                     ║
║    ↑ Hecate — EmbeddingGemma-300M + Qdrant    ║
║      1.17                                      ║
║    ↑ R Runtime — CohortMethod 6.0.1,          ║
║      PLP 6.6.0, DeepPLP                       ║
║    ↑ Nginx — Security headers, template       ║
║      config                                    ║
║                                                ║
║  Migrations:                                   ║
║    ⚠ WhiteRabbit → BlackRabbit (automatic)    ║
║                                                ║
║  New Config Required:                          ║
║    ? LiveKit credentials (if enabling Commons  ║
║      calls)                                    ║
║    ? Orthanc credentials (if not already set)  ║
║                                                ║
╚════════════════════════════════════════════════╝

Proceed with upgrade? [Y/n]
```

**Phase 3: Execute**

1. Backup current `.env` to `.env.backup.{old_version}`
2. Append new env vars with defaults
3. Prompt for security-sensitive vars that are missing
4. Run whiterabbit → blackrabbit migration if applicable
5. `docker compose pull` (updated images)
6. `docker compose up -d` (restart with new config)
7. Run Laravel migrations (`php artisan migrate`)
8. Rebuild frontend (`npx vite build`)
9. Health check all services
10. Update `.parthenon-version`

**For Acropolis:** `python3 install.py --with-infrastructure --upgrade` does the same, plus updates Traefik routes and Acropolis service discovery.

---

## 5. Routing, Verification & Generator Updates

### `acropolis/installer/routing.py` — Traefik Routes

- BlackRabbit route replaces WhiteRabbit (`blackrabbit.${DOMAIN}`, port 8090)
- Hecate route updated to port 8088 (was 8080)
- Arachne DataNode route added (`arachne.${DOMAIN}`, port 8880) — only if discovered
- Qdrant stays internal (no external route)

### `acropolis/installer/verify.py` — Smoke Tests

| Service | Health Check | Timeout |
|---|---|---|
| `parthenon-blackrabbit` | Container health | 30s |
| `parthenon-hecate` | `/api/search?q=health&limit=1` | 60s |
| `parthenon-arachne-datanode` | Container health | 60s |
| `parthenon-qdrant` | TCP 6333 | 30s |

Removed: `parthenon-whiterabbit`

### `acropolis/installer/generator.py` — `acropolis.sh`

- `status` command — new services in status table
- `urls` command — blackrabbit, arachne, hecate with updated ports
- `logs` command — recognizes new container names
- `update` command — calls `--upgrade` logic instead of just `pull && up`

### `acropolis/installer/preflight.py` — Port Checks

- Remove 8080 check for hecate, add 8088
- Add 8880 for arachne-datanode (only when arachne profile enabled)
- Add 6333/6334 for qdrant (if exposed)

---

## 6. Changelog & Release Notes

### GitHub Release Notes (`gh release create v1.0.3`)

```markdown
# Parthenon v1.0.3

## Highlights

### BlackRabbit — Next-Gen Source Profiling
Replaces WhiteRabbit with a Python 3.12 FastAPI service adding
SQL Server, Azure Synapse, and Oracle database support. Existing
installations are migrated automatically.

### LiveKit — Voice & Video in Commons
Real-time voice and video calls in Commons workspaces, powered by
LiveKit Cloud with runtime provider switching.

### Arachne — Federated Study Execution
Opt-in Arachne DataNode integration for participating in OHDSI
network studies. Enable with `--profile arachne`.

### Phoebe — Concept Recommendations
AI-powered concept recommendations from OHDSI's concept_recommended
table, integrated into Concept Set Editor and Detail pages.

### Aqueduct Canvas Overhaul
Full-screen canvas mode, persistent viewport, compact toolbar,
universal CDM selector, and click-to-map field detail modals.

## New & Upgraded

- **Hecate** — Switched to EmbeddingGemma-300M via Ollama, Qdrant
  upgraded to v1.17.1 with 8GB memory
- **Darkstar (R Runtime)** — CohortMethod 6.0.1, PLP 6.6.0,
  DeepPatientLevelPrediction, DQD support
- **Scribe API Docs** — Replaced Scramble with Scribe, integrated
  OpenAPI reference into Docusaurus
- **Nginx** — Security headers, template-based config, DICOM proxy
  caching, 5GB upload support

## Installer

- **Module-grouped setup** — Services organized by function
  (Research, Commons, AI & Knowledge, Data Pipeline, Infrastructure)
- **`--upgrade` flag** — In-place upgrades with version detection,
  changelog display, and automatic migrations
- **WhiteRabbit → BlackRabbit migration** — Detected and handled
  automatically during upgrade

## Infrastructure

- Host UID/GID auto-detection for PHP/Scanner containers
- Configurable DB_PORT
- Qdrant ports exposed (6333 REST, 6334 gRPC)
```

### In-App What's New (`backend/resources/changelog.md`)

Same content trimmed to user-facing features only — no infrastructure or installer details. Formatted for the Commons sidebar What's New modal.

---

## Files Modified

| File | Change |
|---|---|
| `acropolis/installer/discovery.py` | Registry updates, blackrabbit migration logic |
| `acropolis/installer/routing.py` | New/updated Traefik routes |
| `acropolis/installer/verify.py` | Updated smoke test targets |
| `acropolis/installer/generator.py` | New services in acropolis.sh |
| `acropolis/installer/preflight.py` | Updated port checks |
| `acropolis/installer/config.py` | Module groups, LiveKit/Orthanc prompts |
| `acropolis/installer/cli.py` | `--upgrade` flag, version detection |
| `acropolis/installer/editions.py` | Module selection UI |
| `installer/cli.py` | `--upgrade` flag, module groups, new env vars |
| `install.py` | `--upgrade` argument parsing |
| `backend/resources/changelog.md` | v1.0.3 What's New content |
| `.parthenon-version` | New file, written at install/upgrade time |
