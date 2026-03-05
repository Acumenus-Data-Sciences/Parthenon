# Phase 15 — Molecular Diagnostics & Cancer Genomics

**Version target:** 1.1.0
**Devlog started:** March 5, 2026

---

## §15.1 — Genomics Data Layer (Complete)

**What was built:**

### Database Migrations (Docker parthenon DB)
Three app-layer tables:
- `genomic_uploads` — tracks VCF/MAF/FHIR file uploads with status lifecycle (pending → parsing → mapped → review → imported → failed)
- `genomic_variants` — parsed variant staging table with full coordinates (CHROM, POS, REF, ALT), gene annotations (HGVS c./p., SnpEff/VEP consequence), clinical annotation (ClinVar, COSMIC), quality metrics (AF, DP, zygosity), and OMOP mapping fields (measurement_concept_id, mapping_status, omop_measurement_id)
- `genomic_cohort_criteria` — saved genomic filter criteria for the cohort builder (gene_mutation, TMB, MSI, fusion, pathogenicity, treatment_episode types)

### Backend Models
- `GenomicUpload` — BelongsTo Source/User, HasMany GenomicVariant
- `GenomicVariant` — BelongsTo GenomicUpload/Source; full OMOP measurement mapping fields
- `GenomicCohortCriterion` — criteria_definition stored as JSONB for flexible filter specs

### VcfParserService
PHP service parsing:
- **VCF 4.1/4.2** — parses META lines (genome build detection), header, data records
  - INFO field parser (key=value pairs)
  - SnpEff ANN= field parser (gene, HGVS c./p., consequence)
  - VEP CSQ= field parser (gene, HGVS, consequence)
  - FORMAT/sample GT parser (zygosity from alleles, AF from AD or AF field, DP)
  - Auto-detects genome build from ##reference lines
- **MAF/cBioPortal MAF** — column header detection, standard field mapping
- Variant type inference (SNP/INS/DEL/MNP from ref/alt length)
- ClinVar significance normalization (underscore-to-space, pipe-split)
- Per-row error handling with Log::warning; continues on bad records

### GenomicsController
11 API endpoints under `GET|POST|PUT|DELETE /api/v1/genomics/`:
- `stats` — aggregate counts, uploads by status, top 10 mutated genes
- `uploads` (CRUD) — paginated listing, multipart file upload, delete (cascades to variants + storage)
- `variants` — paginated listing with filters (upload_id, source_id, gene, clinvar_significance, mapping_status)
- `criteria` (CRUD) — genomic cohort criteria library

File upload: <10 MB parsed synchronously; larger files would dispatch a queue job (stub for now).

### Frontend Module (`/genomics`)
- **GenomicsPage** — stats cards, top genes chip cloud (clickable filter), uploads table with status badges
- **UploadDetailPage** — variant table with gene/HGVS/ClinVar/OMOP columns; auto-polls during parse
- **UploadDialog** — drag-and-drop zone, format selection (4 types), genome build + sample ID fields, auto-detects format from file extension
- **genomicsApi.ts** — typed API client for all 11 endpoints
- **useGenomics.ts** — TanStack Query hooks with cache invalidation
- **types/index.ts** — TypeScript types for all entities
- **Sidebar** — "Genomics" entry with Dna icon in Research section
- **Router** — lazy-loaded routes at `/genomics` and `/genomics/uploads/:id`

### API Verified
```
GET /api/v1/genomics/stats → {"data":{"total_uploads":0,"total_variants":0,...}}
```

---

## Standards & Best Practices Applied

- **OMOP CDM v5.4 Genomic Extension conventions**: variants map to MEASUREMENT with measurement_concept_id from OMOP Genomic Vocabulary (HGVS/ClinVar/COSMIC concepts); measurement_source_value = "GENE:HGVS_c"
- **GA4GH VRS alignment**: chromosome normalized (chr prefix stripped), HGVS stored as-is for downstream VRS ID generation
- **IBIS-standard VCF parsing**: INFO field key=value format per VCF 4.2 spec; GT allele parsing handles phased (|) and unphased (/) notation
- **Graceful degradation**: parse errors per-row logged and skipped; upload still completes with partial data
- **Code-split lazy routes**: genomics pages load on demand, not in main bundle

---

## Next Steps

- §15.2 — OMOP Measurement writer: map parsed variants to measurement_concept_id via vocabulary search, write to omop.measurement in CDM source DB
- §15.3 — Genomic cohort criteria in the cohort builder UI
- §15.4 — Variant-Outcome Analysis Suite (Kaplan-Meier, treatment-variant matrix, waterfall plots)
- §15.5 — Molecular Tumor Board Dashboard (per-patient evidence panel)
