# MBU Patient Data Restoration & Permanent Seeder

**Date:** 2026-03-23
**Module:** Genomics / Imaging
**Patient:** Dr. M.B. Udoshi (person_id=1005788)

---

## Problem

Patient 1005788's Precision Medicine and Imaging data disappeared from the Patient Profile for the **third time**. Both the Foundation Medicine genomic variants and DICOM imaging studies were missing from the database (`app.genomic_variants` and `app.imaging_studies` had 0 records for this patient).

The root cause is that this data was originally inserted via ad-hoc database operations with no repeatable seeder — so any database reset, migration, or accidental truncation wiped it permanently.

## What Was Restored

### 1. Foundation Medicine Genomic Variants (TRF091836.pdf)

Created a `genomic_uploads` record for the FoundationOne report, then inserted 4 variants:

| Gene | Alteration | Significance | ClinVar ID | Therapeutic Implications |
|------|-----------|--------------|------------|--------------------------|
| KRAS | G12D | Pathogenic | 12583 | Resistance: Cetuximab, Panitumumab; Potential: Trametinib |
| TP53 | R282W | Pathogenic | 12356 | — |
| APC | S1281* | Pathogenic | 180988 | — |
| SETD2 | rearrangement exon 12 | Likely pathogenic | — | — |

Source: FoundationOne report (FMI Case TRF091836), dated 2015-05-23.
Specimen: Colon adenocarcinoma, collected 2012-03-06 (sigmoid colectomy at UPenn).

### 2. DICOM Imaging Studies

Imported 5,013 DICOM files from `docs/MBU/DICOM/` into:
- **15 imaging studies** (CT, CR, MR, PET) spanning 2013-2015
- **117 series**
- **5,013 instances**

Required temporarily adding `./docs/MBU:/var/www/html/docs/MBU:ro` to the PHP container's volume mounts in docker-compose.yml (reverted after import).

## Permanent Fix: `mbu:seed-genomics` Artisan Command

Created `backend/app/Console/Commands/SeedMbuPatient.php` to prevent a fourth occurrence.

```bash
# Restore genomic variants (idempotent — skips if data exists)
php artisan mbu:seed-genomics

# Force re-seed (deletes and re-inserts)
php artisan mbu:seed-genomics --force
```

The command:
- Creates/finds the `genomic_uploads` record for TRF091836.pdf
- Inserts all 4 Foundation Medicine variants with full metadata (ClinVar IDs, COSMIC IDs, therapeutic implications)
- Checks and reports on imaging study status
- Is idempotent by default (won't duplicate data)

For DICOM re-import, the existing command works but requires a volume mount:
```bash
# Add to docker-compose.yml php volumes: ./docs/MBU:/var/www/html/docs/MBU:ro
docker compose up -d php
php artisan imaging:import-samples --dir=docs/MBU/DICOM --source=47 --person-id=1005788
# Revert docker-compose.yml and restart
```

## Files Changed

| File | Change |
|------|--------|
| `backend/app/Console/Commands/SeedMbuPatient.php` | New — permanent seeder for MBU patient genomic data |

## Recovery Checklist (for future incidents)

1. `php artisan mbu:seed-genomics` — restores Foundation Medicine variants
2. Mount `docs/MBU` into PHP container, run `imaging:import-samples` — restores DICOM studies
3. Verify in Patient Profile: Precision Medicine tab shows 4 variants, Imaging tab shows 15 studies

---

## Update: 2026-03-28 — Orthanc RAID0 Migration & SourceContext Fix

### Context

After migrating Orthanc storage from the external USB spinning drive to the internal NVMe RAID0 array (`/mnt/md0/orthanc-data-pg`), the imaging studies lost their `orthanc_study_id` links due to reindexing. Additionally, a deeper bug was discovered: the patient profile's Imaging and Precision Medicine tabs returned 500 errors because `SourceContext` didn't include the vocabulary schema in CDM/results connection search paths.

### What Was Done

#### 1. DICOM Re-upload to Orthanc

Uploaded all 10,026 files from `/home/smudoshi/Documents/DICOM/` (the canonical source of Dad's DICOMs) to Orthanc via REST API:
- **2,700 new instances** imported (previously missing from the RAID0 migration)
- **2,313 duplicates** (already in Orthanc) — correctly deduplicated
- **5,013 macOS `._` resource fork files** skipped (HTTP 400, harmless)

The 2 PET/CT studies from 2013-05-15 (`WB PETCT LUNG/COLON`) that were missing after the RAID0 migration were recovered.

#### 2. Orthanc Study ID Re-linking

All 15 `imaging_studies` records updated with current Orthanc UUIDs and accurate series/instance counts:

| Studies | Series | Instances | Modalities |
|---------|--------|-----------|------------|
| 15 | 110 | 5,013 | CT, PT, CR, MR, CT/PT |

#### 3. SourceContext Bug Fix (Critical)

**File:** `backend/app/Context/SourceContext.php`

**Problem:** `ctx_cdm` and `ctx_results` database connections only included their own schema in the PostgreSQL `search_path`. Any query joining CDM/results tables with vocabulary tables (e.g., `person` JOIN `concept`) failed with `relation "concept" does not exist` because `concept` lives in the `vocab` schema, not `omop`.

This affected **all** patient profiles and any CDM query with concept joins — not just Dad's record.

**Fix:** Added the vocabulary schema as an extra search path entry for CDM and results connections:

```php
// Before: search_path = "omop",public
$this->registerConnection('ctx_cdm', $baseConfig, $this->cdmSchema);

// After: search_path = "omop","vocab",public
$this->registerConnection('ctx_cdm', $baseConfig, $this->cdmSchema, $this->vocabSchema);
```

Applied to both `registerLocalConnections()` (local sources) and `registerDynamicConnections()` (remote sources).

### Verification

All three patient profile API endpoints confirmed working:
- `GET /api/v1/sources/47/profiles/1005788` — demographics, conditions, drugs, procedures, visits
- `GET /api/v1/imaging/patients/1005788/timeline` — 15 studies, 5 drug exposures
- `GET /api/v1/radiogenomics/patients/1005788` — 7 variants (4 Foundation Medicine + 3 derived), 15 imaging studies

### Files Changed

| File | Change |
|------|--------|
| `backend/app/Context/SourceContext.php` | Include vocab schema in CDM/results connection search paths |

### Canonical DICOM Source

Dad's DICOMs live at `/home/smudoshi/Documents/DICOM/` (10,026 files, flat numbered directory). This is the authoritative source for re-upload if Orthanc is ever rebuilt.
