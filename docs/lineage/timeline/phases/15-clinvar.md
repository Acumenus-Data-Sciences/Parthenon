# Phase 15 — ClinVar Integration

**Date:** 2026-03-05
**Status:** Shipped

## What was built

Full integration of NCBI ClinVar VCF data into the Genomics module — covering sync infrastructure, auto-annotation of uploaded variants, and a searchable browser on the Genomics page.

### Backend

**New tables (migration `2026_03_05_250001`):**
- `clinvar_variants` — local cache of ClinVar GRCh38 variants with coordinates, clinical significance, disease name, review status, gene symbol, HGVS, and an `is_pathogenic` boolean flag. Unique index on `(chromosome, position, reference_allele, alternate_allele, genome_build)` for fast coordinate lookups.
- `clinvar_sync_log` — tracks each sync run (source URL, status, inserted/updated counts, timestamps).

**Migration `2026_03_05_250002`:** Adds `clinvar_disease` and `clinvar_review_status` to `genomic_variants` so annotation fills in disease context alongside significance.

**`ClinVarSyncService`** (`app/Services/Genomics/`):
- Downloads `clinvar.vcf.gz` (full, 181 MB) or `clinvar_papu.vcf.gz` (P/LP only, 69 KB) from `https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/` via Laravel HTTP client with `sink` streaming.
- Stream-decompresses with `gzopen()` — never loads the full file into memory.
- Parses ClinVar INFO fields: `CLNSIG` → clinical significance, `CLNDN` → disease name, `CLNREVSTAT` → review status, `GENEINFO` → gene symbol, `CLNHGVS` → HGVS, `RS` → dbSNP RS ID.
- Batch-upserts 1000 rows at a time. **Key gotcha:** the full ClinVar VCF contains multiple rows for the same coordinate (different submitters). Deduplication within each batch is required — pathogenic entries win on conflict.
- All string fields truncated to column limits before insert to handle structural variant HGVS strings.

**`ClinVarAnnotationService`** (`app/Services/Genomics/`):
- Chunks an upload's unannotated variants (null `clinvar_significance`) in batches of 500.
- Builds a batch OR-clause to look up all coordinates against `clinvar_variants` in one query per chunk.
- Updates `clinvar_id`, `clinvar_significance`, `clinvar_disease`, `clinvar_review_status` on matched rows.

**`SyncClinVarCommand`** — `php artisan genomics:sync-clinvar`:
- `--papu-only` flag: fetch the 69 KB P/LP subset (fast, seconds)
- `--build=GRCh38` (default): genome build tag
- Full sync: ~4.4 M variants, takes a few minutes

**New API routes (all `auth:sanctum`):**
- `GET /api/v1/genomics/clinvar/status` — total count, pathogenic count, last sync metadata
- `GET /api/v1/genomics/clinvar/search` — paginated search with `q`, `gene`, `significance`, `pathogenic_only` filters
- `POST /api/v1/genomics/clinvar/sync` — trigger sync from frontend (`papu_only` param)
- `POST /api/v1/genomics/uploads/{upload}/annotate-clinvar` — annotate one upload's variants

### Frontend

**Types:** `ClinVarVariant`, `ClinVarStatus`, `ClinVarSyncLogEntry` added to `genomics/types/index.ts`.

**API:** 4 new functions in `genomicsApi.ts` — `getClinVarStatus`, `searchClinVar`, `syncClinVar`, `annotateClinVar`.

**Hooks:** `useClinVarStatus`, `useClinVarSearch`, `useSyncClinVar`, `useAnnotateClinVar`.

**GenomicsPage** restructured with two tabs:
- **Uploads** tab — existing upload table, with a new ✨ Annotate button per row to cross-reference that upload's variants against ClinVar.
- **ClinVar Reference** tab — sync status card (3 metrics: total variants, pathogenic count, last sync date) + "P/LP Only" and "Full Sync" buttons + searchable/filterable variant table with significance color badges (red = pathogenic, orange = likely pathogenic, teal = benign, amber = VUS) + pagination.

Clicking a top-mutated-gene chip now switches to the ClinVar tab.

## Bugs fixed during implementation

1. **Model table name mismatch** — Laravel's snake_case pluralizer converts `ClinVarSyncLog` → `clin_var_sync_logs` but the table is `clinvar_sync_log`. Fixed by explicitly setting `protected $table` on both models.
2. **String truncation** — ClinVar HGVS for structural variants can exceed 500 chars. Added `substr()` truncation on all string fields before insert.
3. **Batch deduplication** — `ON CONFLICT DO UPDATE` fails if the same batch contains two rows with the same conflict key. Full ClinVar has multiple submitters per coordinate. Fixed by deduplicating within `flushBatch()`, keeping the pathogenic entry when both are present.

## Data seeded

- P/LP seed run first: **2,323 variants**
- Full sync: **4,342,097 variants inserted, 46,000 updated, 0 errors**

## Commands

```bash
# Quick P/LP seed (~69 KB, seconds)
php artisan genomics:sync-clinvar --papu-only

# Full ClinVar (~181 MB, minutes)
php artisan genomics:sync-clinvar

# Schedule weekly in app/Console/Kernel.php:
$schedule->command('genomics:sync-clinvar')->weekly();
```
