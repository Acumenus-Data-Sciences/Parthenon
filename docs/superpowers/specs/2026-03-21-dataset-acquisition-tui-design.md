# Dataset Acquisition TUI — Design Specification

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Standalone Python TUI for acquiring and loading public OHDSI datasets into a fresh Parthenon installation

---

## Problem

After installing Parthenon, the Docker postgres has all table structures (170+ migrations) but no data. End users need a guided way to discover, select, download, and load publicly available datasets. The existing `installer/demo_data.py` handles genomics/imaging tiers but doesn't cover vocabulary, CDM datasets, GIS, or phenotypes, and its rigid tier system doesn't allow a la carte selection.

## Solution

A standalone Python TUI (`datasets/` module) that presents a categorized catalog of public datasets, lets users pick individual datasets or start from recommended bundles, handles downloads with progress/resume, and delegates loading to existing artisan commands. Runs post-install or from the installer.

---

## Module Structure

```
datasets/
  __init__.py           # Package marker
  __main__.py           # Entry point: python3 -m datasets
  registry.py           # Dataset catalog — all dataset definitions
  tui.py                # Rich/questionary TUI (browse, bundles, a la carte)
  loader.py             # Orchestrator: resolves dependencies, runs loaders in order
  downloads.py          # Download infrastructure (progress bars, HTTP resume, decompress)
  loaders/              # Per-category loader modules
    __init__.py
    vocabulary.py       # Athena vocabulary (guides download, runs artisan)
    eunomia.py          # GiBleed demo CDM
    synpuf.py           # CMS SynPUF synthetic Medicare
    synthea.py          # SyntheA synthetic patient generation
    genomics.py         # GIAB VCF + ClinVar
    imaging.py          # DICOM datasets
    gis.py              # Census TIGER/Line boundaries
    phenotypes.py       # OHDSI Phenotype Library sync
```

Entry points:
- **Standalone:** `python3 -m datasets` or `./parthenon-data` (convenience script)
- **From installer:** Phase 5 calls `datasets.loader.run_from_installer(cfg)`
- **CLI flags:** `python3 install.py --datasets` re-launches TUI post-install

---

## Dataset Registry

Each dataset is a `@dataclass`:

```python
@dataclass
class Dataset:
    key: str                    # Unique ID: "vocabulary", "eunomia", "giab-hg001"
    name: str                   # Display name
    category: str               # Group key for TUI sections
    description: str            # One-liner
    size_estimate: str          # "~4 GB download, ~16 GB loaded" (display only)
    size_download_mb: int       # Numeric download size in MB (for disk tally)
    size_loaded_mb: int         # Numeric loaded size in MB (for disk tally)
    time_estimate: str          # "~30 min"
    source_url: str             # Attribution/info URL (display only)
    requires_registration: bool # True for Athena
    dependencies: list[str]     # Dataset keys that must load first
    loader: str                 # Module path: "datasets.loaders.vocabulary"
    auto_downloadable: bool     # False if manual download required
    checksum: str | None        # SHA-256 of download file (None for multi-file/manual)
    phase: int = 1              # Implementation phase (2 = deferred, shown as "Coming soon")
```

### Dataset Catalog

| Category | Key | Name | Size | Auto? | Dependencies |
|----------|-----|------|------|-------|-------------|
| Vocabulary | `vocabulary` | OMOP Vocabulary (Athena) | ~4 GB / 16 GB loaded | No (registration) | — |
| CDM | `eunomia` | Eunomia GiBleed (2,694 patients) | ~38 MB | Yes | — |
| CDM | `synpuf-1k` | CMS SynPUF 1K sample | ~200 MB loaded | Yes | vocabulary |
| CDM | `synpuf-full` | CMS SynPUF (2.3M patients) | ~10 GB loaded | Yes | vocabulary |
| CDM | `synthea-1k` | SyntheA 1K synthetic patients | ~500 MB | Yes | vocabulary |
| Genomics | `clinvar` | ClinVar variant database | ~500 MB | Yes | — |
| Genomics | `giab-hg001` | GIAB HG001 (NA12878) | ~3.5 GB | Yes | — |
| Genomics | `giab-hg002` | GIAB HG002 (Ashkenazim son) | ~3.5 GB | Yes | — |
| Genomics | `giab-hg003` | GIAB HG003 (Ashkenazim father) | ~3.5 GB | Yes | — |
| Genomics | `giab-hg004` | GIAB HG004 (Ashkenazim mother) | ~3.5 GB | Yes | — |
| Genomics | `giab-hg005` | GIAB HG005 (Chinese son) | ~3.5 GB | Yes | — |
| Genomics | `giab-hg006` | GIAB HG006 (Chinese father) | ~3.5 GB | Yes | — |
| Genomics | `giab-hg007` | GIAB HG007 (Chinese mother) | ~3.5 GB | Yes | — |
| Imaging | `dicom-malocclusion` | Class-3 Malocclusion CBCT | ~21 MB | Yes | — |
| Imaging | `dicom-covid19` | Harvard COVID-19 CT (1,000 studies) | ~242 GB | No (manual) | — |
| GIS | `gis-boundaries` | US Census TIGER/Line boundaries | ~100 MB | Yes | — |
| Phenotypes | `phenotype-library` | OHDSI Phenotype Library (1,100 defs) | ~5 MB | Yes | — |

### Recommended Bundles

| Bundle | Datasets | Total Size |
|--------|----------|------------|
| Quick Start | eunomia, phenotype-library | ~50 MB |
| Research Ready | eunomia, vocabulary*, synpuf-1k, clinvar, giab-hg001, gis-boundaries, phenotype-library | ~12 GB |
| Genomics Focus | eunomia, clinvar, giab-hg001, giab-hg002, phenotype-library | ~8 GB |
| Full Platform | All auto-downloadable datasets | ~50 GB |

*vocabulary requires manual Athena download — TUI flags this and guides the user*

---

## TUI Flow

### Screen 1 — System Status

Checks Docker, PHP container, PostgreSQL connectivity, free disk space. Detects already-loaded datasets by querying the database through the PHP container. Shows what's present and what's missing.

### Screen 2 — Selection Mode

Two options:
- **Start with a recommended bundle** — picks one of 4 bundles, pre-checks datasets, then goes to Screen 3
- **Pick individual datasets** — goes to Screen 3 with nothing checked

### Screen 3 — Dataset Picker (checkbox list)

Grouped by category. Each row shows:
- Checkbox state (selected/unselected)
- Dataset name and size estimate
- Status badges: `already loaded`, `manual download`, `(required by X)`

Key behaviors:
- Already-loaded datasets are greyed out with checkmark
- Selecting a dataset auto-checks its dependencies with a note
- Manual-download datasets show warning badge
- Running disk space tally at the bottom

### Screen 4 — Confirmation + Execution

Shows ordered list of datasets to install. On confirmation:
1. Resolves dependency order (topological sort)
2. Executes each loader sequentially with progress output
3. Manual-download datasets pause for user input (file path prompt)
4. Non-fatal failures skip to next dataset
5. Summary table at end: what loaded, what failed, retry commands

---

## Loader Interface

Each loader module exposes:

```python
def is_loaded() -> bool:
    """Check if dataset is already present."""

def load(*, console: Console, downloads_dir: Path) -> bool:
    """Download and import. Returns True on success."""
```

**Database target:** All loaders target the Docker PostgreSQL instance (the one started by `docker compose up`). This is the database a fresh end-user installation uses. The host PG 17 on `pgsql.acumenus.net` is the development database and is never targeted by this tool.

Detection is done by shelling into the PHP container (`docker compose exec php php artisan tinker --execute="..."`) or via `docker compose exec postgres psql`. The TUI never connects to the database directly — it always goes through Docker containers.

### `is_loaded()` Detection Strategy

| Dataset | Detection Method |
|---------|-----------------|
| vocabulary | `SELECT COUNT(*) FROM omop.concept` > 0 |
| eunomia | `SELECT COUNT(*) FROM eunomia.person` > 0 |
| synpuf-* | `SELECT COUNT(*) FROM omop.person` > 2694 (more than Eunomia) |
| synthea-* | Same as synpuf — check `omop.person` count threshold |
| clinvar | `SELECT COUNT(*) FROM app.clinvar_variants` > 0 |
| giab-hg001..hg007 | Check `app.genomic_uploads` for matching sample name |
| dicom-malocclusion | Check `app.imaging_studies` count > 0 |
| dicom-covid19 | Check `app.imaging_studies` count > 100 |
| gis-boundaries | `SELECT COUNT(*) FROM gis.geographic_location` > 0 |
| phenotype-library | `SELECT COUNT(*) FROM app.cohort_definitions WHERE source = 'phenotype-library'` > 0 |

### Loader → Artisan Command Mapping

| Dataset | Loading Mechanism |
|---------|------------------|
| vocabulary | `parthenon:load-vocabularies --zip=<path>` |
| eunomia | `parthenon:load-eunomia --fresh` |
| synpuf-* | **Phase 2** — new artisan command `parthenon:load-synpuf` (downloads CMS CSV, maps to OMOP) |
| synthea-* | **Phase 2** — new artisan command `parthenon:load-synthea` (generates or imports synthetic CDM) |
| clinvar | `genomics:sync-clinvar` (existing, `--papu-only` for subset) |
| giab-* | Download VCF via `downloads.py`, then `genomics:import-vcf --dir=<path>` |
| dicom-* | Download/extract via `downloads.py`, then `imaging:import-samples --dir=<path>` |
| gis-boundaries | Download TIGER/Line shapefiles, then run `scripts/gis/load_all.py` inside a container with geopandas. Note: GIS loading uses Python scripts directly (not artisan) because the loading requires geopandas/shapely which are not PHP dependencies. The loader will `docker compose exec python-ai python /scripts/gis/load_all.py` or run the script in a one-shot container with the required Python dependencies. |
| phenotype-library | `phenotype:sync` |

### Implementation Phasing

**Phase 1 (this implementation):** All datasets except `synpuf-*` and `synthea-*`. These require non-trivial new artisan commands for ETL and are deferred.

**Phase 2 (future):** Add SynPUF and SyntheA loaders once the artisan commands for CDM ETL are built. The registry entries will exist in Phase 1 but be marked `phase: 2` and shown as "Coming soon" in the TUI.

---

## Integration Points

### Installer Integration

`installer/cli.py` Phase 5 becomes a thin wrapper:

```python
if "datasets" not in completed:
    from datasets.loader import run_from_installer
    run_from_installer(cfg)
    completed.append("datasets")
```

Non-interactive mode reads from defaults file:
```json
{"datasets": ["eunomia", "phenotype-library"]}
```

### Shared Utilities

The `datasets/` module imports Docker/subprocess helpers from `installer/utils.py` (`run_stream`, `exec_php`, `container_health`, `docker_daemon_running`, `free_disk_gb`, `REPO_ROOT`) rather than duplicating them. Both the installer and the standalone TUI share the same utility layer.

### `demo_data.py` Migration

Download infrastructure (`_download_file`, `_decompress_gz`, `_extract_tarball`) moves to `datasets/downloads.py`. GIAB/ClinVar/DICOM dataset definitions and loader logic move to respective loader modules. `demo_data.py` becomes a thin compatibility shim that re-exports the public API:

```python
# installer/demo_data.py — compatibility shim
from datasets.tui import select_tier  # noqa: F401
from datasets.loader import run       # noqa: F401
from datasets.loader import run_standalone  # noqa: F401
```

This preserves backward compatibility for anyone calling `installer.demo_data` functions. The shim gets removed in a future cleanup pass once the installer is fully migrated.

### Non-Interactive Mode

When called from the installer with `--defaults-file`, `run_from_installer(cfg)` reads `cfg["datasets"]` (a list of dataset keys). It:
1. Resolves dependencies for the requested datasets
2. Validates all dependency datasets are either already loaded or in the list
3. Skips the TUI entirely — runs loaders directly in dependency order
4. Logs progress to stdout (no interactive prompts)
5. Returns a dict of `{dataset_key: bool}` results
6. Non-fatal failures are logged but don't abort the installer

### Dependency Graph Validation

The registry validates at import time that the dependency graph has no cycles (topological sort succeeds). If a cycle is detected, the module raises `ValueError` with the cycle path. This prevents future breakage when adding datasets.

### Convenience Script

```bash
#!/usr/bin/env bash
# parthenon-data — Dataset acquisition utility
exec python3 -m datasets "$@"
```

---

## Error Handling

- Every loader is wrapped in try/except — failures are non-fatal
- Failed datasets print a one-liner retry command
- Summary screen shows success/failure status for each dataset
- Downloads support HTTP Range resume — interrupted downloads continue where they left off
- Loaders check `is_loaded()` before running — safe to re-run

---

## Out of Scope

- Custom ETL pipelines (user's own data) — that's the Aqueduct module
- Private/proprietary datasets — only publicly available data
- MIMIC-IV (requires PhysioNet credentialing — not "just download")
- Direct database connections from Python — all DB access goes through Docker containers
