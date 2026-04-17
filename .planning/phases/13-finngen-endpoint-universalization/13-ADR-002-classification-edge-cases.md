# ADR-002: CoverageProfile classification edge-case rules

**Status:** Accepted (2026-04-18)
**Phase:** 13 — FinnGen Endpoint Universalization
**Decides:** RESEARCH.md §Open Questions 2, 3, 4
**Locks:** D-05, D-07

## Context

CoverageProfile classification (UNIVERSAL / PARTIAL / FINLAND_ONLY) is computed from per-vocab resolver output. Three edge cases need binding rules before the classifier is implemented:

1. **Tandem kela_reimb + kela_reimb_icd endpoints** — endpoints that AND a Finnish reimbursement code with an ICD-10 anchor.
2. **Truncated resolver output** — resolver may cap at MAX_RESOLVED=500 standard concepts per vocab.
3. **ICDO3 cross-walk source** — ICDO3 is not in `vocab.vocabulary`; cross-walk rows are authored from Athena bulk downloads.

## Decision

### Rule 1 — Tandem KELA_REIMB

If an endpoint defines BOTH `kela_reimb` (or `kela_reimb_icd`) tokens AND `hd_icd_10` / `cod_icd_10` / `outpat_icd` tokens that resolve via ICD10CM, the endpoint classifies as **PARTIAL**, not FINLAND_ONLY. Rationale: the ICD-10 anchor identifies a clinically meaningful population on any OMOP CDM; loss of KELA specificity is documented in `description`.

### Rule 2 — Truncated counts as resolved

A resolver group whose `truncated` bit is true and `standard` array is exactly 500 entries STILL counts as "resolved" for classification purposes. The cap is a display protection, not a resolution failure. The classifier inspects `standard !== []`, not the count.

### Rule 3 — ICDO3 via Athena STCM rows

ICDO3 source codes resolve via authored cross-walk rows in `vocab.source_to_concept_map` with `source_vocabulary_id = 'ICDO3'`. The string literal 'ICDO3' is allowed in `source_to_concept_map.source_vocabulary_id` even though no `vocab.vocabulary` row exists for it (the column is free-form TEXT). No `vocab.vocabulary` insert.

### Invariant (D-07)

After re-import, this SQL MUST return 0:

```sql
SELECT COUNT(*)
FROM app.cohort_definitions
WHERE expression_json->>'coverage_bucket' = 'UNMAPPED'
  AND coverage_profile = 'universal';
```

The classifier emits a warning if it would generate this combination; the importer aborts the row and records it in the report.

## Consequences

- Classifier becomes a pure function with binary "did this group resolve" inputs (no count thresholds).
- Tandem-KELA endpoints stay generatable on PANCREAS / SynPUF / Acumenus.
- Wave 5 invariant test is deterministic.

## References

- RESEARCH.md §Open Questions 2, 3, 4
- CONTEXT.md D-05, D-06, D-07
- VALIDATION.md §Wave 0 Requirements
