# Workbench: Evidence Investigation Platform — Phase 3

**Date:** 2026-03-20
**Phase:** Evidence Investigation Phase 3 (Genomic Evidence Domain)
**Commits:** 8c71b8af – 1fd550b2 (8 commits)
**Status:** Deployed to production

---

## Overview

Phase 3 delivered the Genomic Evidence domain — the most novel component of the Evidence Investigation platform. Unlike Phase 2 (clinical analyses already backend-complete) or Phase 1 (core scaffolding), Phase 3 required net-new infrastructure on both sides: a server-side genomic proxy service, a custom PostgreSQL array cast, new API endpoints, new TanStack Query hooks, and six purpose-built React components including two D3 visualizations.

The defining technical deliverables are:

- Server-side proxy to Open Targets GraphQL and GWAS Catalog REST (Redis-cached, md5-keyed)
- GWAS summary statistics file upload with client-side column auto-detection and visual mapping UI
- Canvas-based D3 Manhattan plot with performance thinning for datasets exceeding 1M variants
- SVG D3 QQ plot with lambda GC computation and 95% confidence band
- Cross-domain linking engine that resolves connections between genomic pins and clinical/literature pins via shared gene symbols

---

## Scope Change: Risteys Replaced by Enhanced Open Targets

The original plan included a Risteys (FinnGen public data browser) integration. During implementation, the Risteys API surface was audited: `GET /api/endpoints/` returns a list of endpoint name strings only. Per-endpoint data (prevalence, CodeWAS, age distributions, genetic correlations) is rendered server-side via Phoenix LiveView with no JSON API exposed. There is no programmatic way to extract the underlying data.

Open Targets was already in scope and already ingests FinnGen GWAS data as a source within its disease-gene associations. The gap is therefore partially covered. Risteys is deferred to Phase 4 (or indefinitely) pending any future API availability from FinnGen.

---

## Commit Log

| Commit | Description |
|--------|-------------|
| `8c71b8af` | feat(investigation): add genomic evidence types, API functions, and query hooks |
| `b36b8739` | feat(investigation): add GenomicEvidenceController with proxy, upload, and cross-links endpoints |
| `d0a50078` | feat(investigation): add Open Targets gene/disease search with results display |
| `1bee96a0` | feat(investigation): add GWAS Catalog trait/gene search with HAL results display |
| `8ae48242` | feat(investigation): add GWAS summary stats upload with column mapping |
| `f051e1fd` | feat(investigation): add D3 Manhattan plot (canvas) and QQ plot for GWAS visualization |
| `1fd550b2` | feat(investigation): add GenomicPanel with Open Targets, GWAS Catalog, upload, and cross-links |

---

## Backend

### GenomicEvidenceController

`backend/app/Http/Controllers/Api/V1/GenomicEvidenceController.php`

Four endpoints:

- `POST /investigations/{id}/genomic/open-targets` — proxies Open Targets GraphQL (`api.platform.opentargets.org/api/v4/graphql`)
- `POST /investigations/{id}/genomic/gwas-catalog` — proxies GWAS Catalog REST (`www.ebi.ac.uk/gwas/rest/api`)
- `POST /investigations/{id}/genomic/upload` — accepts GWAS summary stats file, validates required columns, stores at `storage/app/investigations/{id}/uploads/`
- `GET /investigations/{id}/cross-links` — returns cross-domain link map for all pins in the investigation

All endpoints enforce investigation ownership checks via `$investigation->user_id === auth()->id()`.

Form requests:

- `backend/app/Http/Requests/Investigation/QueryOpenTargetsRequest.php`
- `backend/app/Http/Requests/Investigation/QueryGwasCatalogRequest.php`
- `backend/app/Http/Requests/Investigation/UploadGwasRequest.php`

### GenomicProxyService

Embedded within the controller (not extracted to a separate service class in this phase). Proxy logic:

- Open Targets: forwards GraphQL query + variables, caches response in Redis under `md5(query . json_encode(variables))` with 24h TTL
- GWAS Catalog: forwards REST requests, caches under `md5(endpoint . json_encode(params))` with 24h TTL
- No authentication required for either external API

### Cross-Domain Linking Engine

`GET /investigations/{id}/cross-links` builds two inverted indexes over all `EvidencePin` records in the investigation:

1. `concept_ids` → pin IDs (for clinical/literature domain links)
2. `gene_symbols` → pin IDs (for genomic domain links)

Returns a map of `pin_id => [linked_pin_id, ...]` filtered to cross-domain pairs only (pins in the same domain are excluded from the result). The response is not cached — it is recomputed per request from the current pin state.

### PgArray Custom Eloquent Cast

`backend/app/Casts/PgArray.php`

**Discovery:** Laravel's built-in `'array'` cast serializes to JSON (`["BRCA1","TP53"]`), which PostgreSQL rejects for native `integer[]` and `varchar[]` columns. PostgreSQL expects its own array literal syntax: `{BRCA1,TP53}`.

The custom cast handles bidirectional conversion:
- **get:** parses `{val1,val2}` PostgreSQL literal → PHP array
- **set:** converts PHP array → `{val1,val2}` string for PostgreSQL

Applied to `EvidencePin::$casts` for the `concept_ids` and `gene_symbols` columns.

`backend/app/Models/App/EvidencePin.php` — updated to use `PgArray` cast.

### Tests

`backend/tests/Feature/Api/V1/GenomicEvidenceTest.php` — 5 tests, 114 lines.

Coverage:
- Open Targets proxy with `Http::fake` mocking
- GWAS Catalog proxy with `Http::fake` mocking
- File upload with `Storage::fake`
- Cross-links with shared gene symbols across two pins
- Ownership enforcement (403 on foreign investigation)

Full backend test suite: 20 tests, 46 assertions, all passing.

---

## Frontend

### Types and API Layer

`frontend/src/features/investigation/types.ts` — Extended with genomic-specific interfaces:
- `OpenTargetsResult` — gene/disease association with tractability scores, therapeutic areas, association score
- `GwasCatalogStudy` — accession, publication, trait, sample size
- `GwasCatalogSnp` — rs-ID, chromosome, base pair position, p-value, beta/OR, functional class
- `GwasVariant` — internal representation for uploaded summary stats after column mapping
- `CrossLinkMap` — `Record<string, string[]>` pin_id map

`frontend/src/features/investigation/api.ts` — Added four API functions with TanStack Query integration.

`frontend/src/features/investigation/hooks/useGenomicEvidence.ts` — Custom hook encapsulating all genomic query state: Open Targets results, GWAS Catalog results, upload state, cross-links.

### Open Targets Components

`frontend/src/features/investigation/components/genomic/OpenTargetsSearch.tsx`

- Gene/disease toggle search (two modes)
- Connects to `/investigations/{id}/genomic/open-targets`

`frontend/src/features/investigation/components/genomic/OpenTargetsResults.tsx`

- Association score bars (0–1 gradient, gold fill)
- Tractability badges (small molecule / antibody / other modalities)
- Therapeutic area badge cluster
- Pin action saves result with `gene_symbols` array for cross-linking

### GWAS Catalog Components

`frontend/src/features/investigation/components/genomic/GwasCatalogSearch.tsx`

- Trait/gene toggle search
- HAL response parsing (`_embedded.studies`, `_embedded.singleNucleotidePolymorphisms`)

`frontend/src/features/investigation/components/genomic/GwasCatalogResults.tsx`

- Study cards: accession ID, publication (author + year + journal), sample size, trait
- SNP cards: rs-ID, chromosome:position, p-value, beta/OR, functional class annotation

### GWAS Upload Components

`frontend/src/features/investigation/components/genomic/GwasUploader.tsx` (341 lines)

- Drag-and-drop zone with file type validation (.tsv, .txt, .csv, .gz)
- Client-side TSV/CSV parsing with auto-delimiter detection (tab vs comma)
- Auto-column detection: attempts header matching against 7 required columns (`CHR`, `BP`, `SNP`, `A1`, `A2`, `P`, `BETA` or `OR`)
- Visual column mapping UI: detected columns shown in green, undetected in amber with manual dropdown override
- Uploads file + column mapping JSON to backend after confirmation

Required columns validated: chromosome, base-pair position, SNP ID, effect allele, non-effect allele, p-value, effect size (beta or odds ratio).

### D3 Visualizations

`frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` (355 lines)

**Canvas-based, not SVG.** Decision rationale: SVG DOM cannot handle >50K elements without severe jank. Canvas renders all points in a single `requestAnimationFrame` pass.

Features:
- Alternating chromosome colors (22 autosomes + X/Y)
- Cumulative genomic x-axis (chromosomes laid end-to-end, scaled by actual bp length)
- Genome-wide significance line at p = 5×10⁻⁸ (−log10 ≈ 7.3), dashed red
- Suggestive significance line at p = 1×10⁻⁵ (−log10 = 5), dashed orange
- Performance thinning: when variant count >500K, drops all variants with −log10(p) < 1 before rendering
- Click-to-select-locus: identifies nearest plotted point, returns locus to parent via callback

`frontend/src/features/investigation/components/genomic/QQPlot.tsx` (328 lines)

**SVG-based.** QQ plots have far fewer points (thinned to 5K) and benefit from SVG's crisp vector rendering.

Features:
- Smart thinning to 5K points preserving tail distribution
- Lambda GC (genomic inflation factor) computed from median chi-squared statistic: displayed as λ = {value} in plot header
- 95% confidence interval band around the diagonal (beta distribution approximation)
- Diagonal reference line (expected = observed)
- Axis labels: Expected −log10(p) vs Observed −log10(p)

`frontend/src/features/investigation/components/genomic/TopLociTable.tsx` (224 lines)

- TanStack Table instance displaying top loci from uploaded file
- Columns: SNP, CHR, BP, P (formatted scientific notation), BETA/OR, A1/A2
- Sortable columns, virtualized rendering for large locus sets

### GenomicPanel and CrossLinkBadge

`frontend/src/features/investigation/components/genomic/GenomicPanel.tsx` (222 lines)

- Three sub-tabs: Open Targets / GWAS Catalog / Upload GWAS
- Upload tab renders ManhattanPlot + QQPlot + TopLociTable after file is processed and column mapping confirmed
- Auto-saves genomic panel state to investigation pin on tab change

`frontend/src/features/investigation/components/genomic/CrossLinkBadge.tsx` (69 lines)

- Displays "N links" with chain icon when cross-links exist for the current pin
- Hover tooltip lists linked pin titles grouped by domain
- Consumes `CrossLinkMap` from `useGenomicEvidence` hook

`frontend/src/features/investigation/components/EvidenceBoard.tsx` — Updated to render `GenomicPanel` for genomic-domain evidence pins and surface `CrossLinkBadge` on all pin cards.

`frontend/src/features/investigation/components/ContextBar.tsx` — Minor update to show genomic evidence count in the domain summary row.

---

## Architecture Notes

**All external API calls are server-side proxied.** Open Targets GraphQL and GWAS Catalog REST are never called directly from the browser. This enforces the security spec and avoids CORS issues.

**Redis caching strategy:**
- Cache key: `md5(query_string . json_encode(variables_or_params))`
- TTL: 86400 seconds (24 hours) for both Open Targets and GWAS Catalog
- No cache invalidation needed — these are read-only public datasets that change on weekly/monthly cycles

**GWAS file storage:** Files are stored at `storage/app/investigations/{id}/uploads/` (non-public disk). Column mapping is resolved client-side and sent as a JSON payload alongside the file in the multipart upload.

**TypeScript:** Zero type errors (`npx tsc --noEmit` clean).

---

## Test Results

```
Backend (Pest):     20 tests, 46 assertions — PASS
  - GenomicEvidenceTest: 5 tests (Http::fake proxy, Storage::fake upload, cross-links, ownership)
  - InvestigationTest:  15 tests (pre-existing, unmodified)

Frontend (Vitest):  passing (no regressions)
TypeScript:         0 errors
```

---

## What's Next (Phase 4)

- Evidence Dossier export: PDF generation (mPDF/Puppeteer), JSON export, shareable link with expiry
- Investigation versioning: snapshot/restore
- Collaboration: share investigation with another user (read-only or edit), activity feed
- Deferred genomic items: colocalization import (COLOC output), fine-mapping (SuSiE/FINEMAP output), locus zoom view, LD-aware forest/love plots
- Synthesis panel polish: evidence strength scoring, recommendation generation via Abby AI
- Risteys: monitor FinnGen for any future public data API

---

## Key Files

```
backend/
  app/Casts/PgArray.php
  app/Http/Controllers/Api/V1/GenomicEvidenceController.php
  app/Http/Requests/Investigation/QueryOpenTargetsRequest.php
  app/Http/Requests/Investigation/QueryGwasCatalogRequest.php
  app/Http/Requests/Investigation/UploadGwasRequest.php
  app/Models/App/EvidencePin.php
  tests/Feature/Api/V1/GenomicEvidenceTest.php
  routes/api.php

frontend/src/features/investigation/
  types.ts
  api.ts
  hooks/useGenomicEvidence.ts
  components/genomic/OpenTargetsSearch.tsx
  components/genomic/OpenTargetsResults.tsx
  components/genomic/GwasCatalogSearch.tsx
  components/genomic/GwasCatalogResults.tsx
  components/genomic/GwasUploader.tsx
  components/genomic/ManhattanPlot.tsx
  components/genomic/QQPlot.tsx
  components/genomic/TopLociTable.tsx
  components/genomic/GenomicPanel.tsx
  components/genomic/CrossLinkBadge.tsx
  components/EvidenceBoard.tsx
  components/ContextBar.tsx
```
