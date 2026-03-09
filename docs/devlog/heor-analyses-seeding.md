# HEOR Analyses Seeding & Claims/Notes Generation

**Date:** 2026-03-09
**Branch:** `feature/analysis-viz-improvements`

## What Was Built

### 1. HEOR Analysis Seeder (`HeorSeeder.php`)

Created 5 fully-executed HEOR analyses covering all analysis types:

| # | Analysis | Type | Perspective | Horizon | ICER ($/QALY) |
|---|----------|------|-------------|---------|---------------|
| 1 | SGLT2i vs SoC for T2DM+CKD | CEA | Payer | 10yr | $15,063 |
| 2 | GLP-1 RA Budget Impact for T2DM | Budget Impact | Payer | 5yr | $39,200 |
| 3 | HF Readmission Prevention ROI | ROI | Provider | 5yr | ROI 375% |
| 4 | Antihypertensive Therapy CUA | CUA | Societal | Lifetime | $9,333 |
| 5 | CAD Secondary Prevention CBA | CBA | Payer | 10yr | $1,143 |

**Data created:**
- 13 scenarios (5 base cases, 5 interventions, 3 sensitivity)
- 47 cost parameters with realistic values, bounds, distributions, and literature references
- 3 value-based contracts (Dapagliflozin outcomes-based, Semaglutide HbA1c guarantee, Semaglutide weight loss warranty)
- All analyses auto-executed via `HeorEconomicsService::runAnalysis()`

### 2. Claims & Notes Generation (Full 1M Patient Run)

Ran `scripts/generate_claims_and_notes_omop.py` for the full OMOP CDM:

| Table | Rows | Disk Size |
|-------|------|-----------|
| `omop.claims` | 26.3M | 10 GB |
| `omop.claims_transactions` | 458.4M | 178 GB |
| `omop.note` | 52.6M | 99 GB |
| **Total** | **537.3M rows** | **287 GB** |

### 3. Evidence Synthesis Fixes (prior session)

- Fixed `EvidenceSynthesisDesigner.tsx` null guards (design_json, name)
- Fixed Laravel route model binding (`evidence-synthesis` singularization)
- Fixed polymorphic `analysis_type` column (full class name required)

## Key Decisions

- **HEOR is synchronous PHP** — no R runtime needed, `HeorEconomicsService` handles all economics math
- **Parameter values sourced from published literature** — DAPA-CKD, SPRINT, SUSTAIN-6, Cochrane reviews
- **Controller scopes by `created_by`** — seeder must use the correct admin user (`admin@acumenus.net`)
- **Claims FK fix** — flush claims batch before transactions batch to prevent FK violations

## Bugs Found & Fixed

1. **Claims FK violation** — transactions batch flushed before parent claims batch committed. Fixed by committing claims immediately after each batch flush.
2. **Python output buffering** — `nohup python3` buffers stdout. Fixed with `-u` flag.
3. **Named cursor invalidation** — PostgreSQL named cursors die after `conn.commit()`. Fixed with separate read connection.
4. **Allergy subquery performance** — per-batch correlated `ILIKE '%allergy%'` subquery against concept table. Precomputed allergy concept IDs once.
5. **HEOR ownership mismatch** — seeder created with `admin@parthenon.local` but UI filters by logged-in user `admin@acumenus.net`.

## Files Changed

- `backend/database/seeders/HeorSeeder.php` — NEW: 5 HEOR analyses with scenarios, parameters, contracts
- `backend/database/seeders/DatabaseSeeder.php` — Added HeorSeeder call
- `scripts/generate_claims_and_notes_omop.py` — FK flush fix, allergy optimization, timing logs
- `frontend/src/features/evidence-synthesis/components/EvidenceSynthesisDesigner.tsx` — null guards
- `backend/routes/api.php` — evidence-synthesis route parameter fix
