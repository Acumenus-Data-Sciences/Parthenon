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
