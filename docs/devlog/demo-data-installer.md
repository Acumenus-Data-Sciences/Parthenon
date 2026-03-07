# Demo Data Installer — Tiered Dataset Downloads

**Date:** 2026-03-06
**Scope:** `installer/demo_data.py`, `installer/cli.py`, `installer/config.py`, `install.py`

## Problem

The Parthenon installer only loaded Eunomia GiBleed (2,694 synthetic patients) as demo data. New users had no way to experience the full platform capabilities — Genomics (27.5M variants), Imaging (491K DICOM instances), or ClinVar (4.4M variants) — without manually downloading and importing datasets themselves. The production site at parthenon.acumenus.net runs with all of these datasets loaded, but there was no path for end users to mirror that setup.

## Architecture Discovery

Before building the solution, we audited the complete production data landscape:

### Production Database Layout (Local PG 17, `ohdsi` DB)
- **Docker PG 16 is completely empty** — not used at all in production
- **Everything runs on local PG 17** via `pgsql.acumenus.net`
- All 94 app tables live in the `app` schema of the local DB
- Laravel `.env` in the PHP container points directly to local PG, bypassing Docker

### Production Data Inventory
| Dataset | Table | Rows | Disk |
|---------|-------|------|------|
| OMOP CDM (Acumenus) | `omop.*` | 1M patients, 711M measurements | Proprietary |
| OMOP Vocabulary | `omop.concept` | 7.2M concepts | Proprietary |
| Achilles Results | `achilles_results.*` | 1.6M rows | Generated |
| Eunomia GiBleed | `eunomia.*` | 2,694 patients | ~50 MB |
| GIAB Genomics | `app.genomic_variants` | 27.5M (7 samples) | 16 GB VCF |
| ClinVar | `app.clinvar_variants` | 4.4M | Downloaded from NCBI |
| Harvard COVID CT | `app.imaging_instances` | 491K (1,000 studies) | 242 GB DICOM |
| Class-3 Malocclusion | `app.imaging_studies` | Small orthodontic set | 23 MB |
| HEOR | `app.heor_analyses` | 0 (schema only) | N/A |

## Solution: Three-Tier Demo Data Installer

### New File: `installer/demo_data.py` (380 lines)

Provides three tiers selectable during install or standalone via `python3 install.py --demo-data`:

| Tier | Disk | Time | Datasets |
|------|------|------|----------|
| **Minimal** | ~1 GB | ~30 min | Eunomia + ClinVar pathogenic-only subset |
| **Standard** | ~25 GB | ~2 hrs | + 2 GIAB VCF (HG001, HG002) + Class-3 DICOM + full ClinVar |
| **Full Mirror** | ~300 GB | ~8-12 hrs | + All 7 GIAB samples + Harvard COVID-19 CT |

### Download Sources
- **GIAB VCF:** NCBI FTP (`ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/`) — 7 samples from NISTv4.2.1 GRCh38
- **ClinVar:** Existing `artisan genomics:sync-clinvar` (downloads from NCBI FTP internally)
- **Class-3 Malocclusion DICOM:** GitHub release (`acumenus/parthenon-demo-data`)
- **Harvard COVID-19 CT:** Manual download only from TCIA (242 GB too large for automated hosting)

### Key Design Decisions
1. **No new Artisan commands** — reuses existing `genomics:import-vcf`, `genomics:sync-clinvar`, `imaging:import-samples`
2. **HTTP Range resume** — partial downloads resume where they left off
3. **GIAB VCFs download compressed** (`.vcf.gz` from NCBI), decompress locally, delete `.gz` to save space
4. **Harvard COVID-19 is manual-only** — shows Rich panel with step-by-step TCIA instructions; if user places files in `dicom_samples/harvard_covid19/` and re-runs, auto-detects and imports
5. **Phase 5b** — runs after Eunomia (Phase 5), before Frontend Build (Phase 6)
6. **State persistence** — tier selection saved in `.install-state.json` for resume-on-failure

### Integration Points
- `installer/config.py` — tier selection added to interactive config wizard
- `installer/cli.py` — Phase 5b added between Eunomia and Frontend; summary banner updated
- `install.py` — `--demo-data` flag for standalone post-install data loading

## Files Changed
- `installer/demo_data.py` — **New** (380 lines)
- `installer/cli.py` — Added Phase 5b + demo data summary line
- `installer/config.py` — Added tier selection during config collection
- `install.py` — Added `--demo-data` standalone entry point

## Gotchas
- GIAB VCF files are 2-2.7 GB each uncompressed; compressed `.vcf.gz` are ~500 MB — always download compressed
- The `genomics:import-vcf` command is idempotent (checks `GenomicUpload` by filename before re-importing)
- `imaging:import-samples` checks by `study_instance_uid` — safe to re-run
- Harvard COVID dataset requires NBIA Data Retriever from TCIA — cannot be `wget`'d directly
- For installer users, all data goes into Docker PG (`parthenon` DB, `app` schema) — not local PG like our production setup
