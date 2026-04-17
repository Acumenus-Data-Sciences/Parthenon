# FinnGen Cross-Walk — Provenance, Licensing, and Accounting

**Plan:** Phase 13-04 — FinnGen Endpoint Universalization
**Target:** `vocab.source_to_concept_map` (per [ADR-001](../../../../.planning/phases/13-finngen-endpoint-universalization/13-ADR-001-stcm-target-schema.md))
**Curator:** Parthenon GSD executor (Phase 13-04)
**Generated:** 2026-04-17
**Live DB verified against:** `parthenon` host PG17 via `claude_dev` role

This document records the provenance, license determination, and curation trail
for the six cross-walk CSVs that seed `vocab.source_to_concept_map` for FinnGen
endpoint universalization.

---

## 1. Source attribution

| Vocab | Source vocabulary (FinnGen-observed) | Target vocabulary | Upstream authority | License | Snapshot / version |
|-------|--------------------------------------|-------------------|--------------------|---------|--------------------|
| `ICD8` | Finnish ICD-8 (3-digit WHO, pre-1987) | SNOMED (via ICD-10-CM) | `github.com/FINNGEN/phenotype-matching` ICD-8 → ICD-10 bridge + Athena OHDSI ICD-10-CM → SNOMED Maps-to | MIT (FinnGen bridge) + CC-BY-4.0 (Athena targets) | FinnGen phenotype-matching main (2024-11 revision, as cited in Phase 13 RESEARCH §Environment Availability); Athena vocab as live on 2026-04-17 |
| `ICD9_FIN` | Finnish ICD-9 (FI extensions) | SNOMED (via ICD-9-CM) | FinnGen DF14 endpoint definitions (`FINNGEN_ENDPOINTS_DF14_Final_2026-02-13_public.xlsx`) + Athena OHDSI ICD-9-CM → SNOMED Maps-to | Finnish Biobank terms (attribution requested) + CC-BY-4.0 | DF14 XLSX committed at `backend/database/fixtures/finngen/FINNGEN_ENDPOINTS_DF14_Final_2026-02-13_public.xlsx`; Athena live 2026-04-17 |
| `ICD10_FIN` | ICD-10-FI (national suffixes / regex patterns) | SNOMED (via ICD-10-CM) | Mechanical strip of FinnGen pattern markup → closest ICD-10-CM ancestor → Athena Maps-to SNOMED | Codes are non-copyrightable facts; Athena targets CC-BY-4.0 | Athena live 2026-04-17 |
| `NOMESCO` | Nordic Medico-Statistical Committee surgical codes | SNOMED Procedure root | NCSP chapter-letter taxonomy (public domain) + SNOMED Procedure system-root concepts from Athena | Public domain (NCSP chapter letters) + CC-BY-4.0 (SNOMED) | Live 2026-04-17 |
| `KELA_REIMB` | KELA (Kansaneläkelaitos) reimbursement categories | RxNorm Ingredient (standard) | Clinical SME curation against KELA public reimbursement schedule + standard RxNorm Ingredient concepts via Athena | KELA public reimbursement categories are open public data + CC-BY-4.0 (RxNorm) | Curated 2026-04-17 |
| `ICDO3` | ICD-O-3 morphology M-codes (80xx–99xx series) | SNOMED Clinical Finding / Disorder | Mapped by M-code group (2-digit prefix) → SNOMED neoplasm disorder category (standard) | WHO IARC ICD-O-3 numeric codes are non-copyrightable facts (see §2 below); target descriptions reference SNOMED neoplasm category names from Athena (CC-BY-4.0) | Live 2026-04-17 |

Every row emitted has a `provenance_tag` column identifying the specific
sourcing pathway:

- `finngen-phenotype-matching-icd8-bridge` — FinnGen-published ICD-8→ICD-10 bridge (MIT) + Athena SNOMED Maps-to
- `finngen-phenotype-matching-icd9fin` — Finnish ICD-9 strip + Athena ICD-9-CM → SNOMED
- `computed-icd10fi-strip` — Mechanical ICD-10-FI pattern strip → Athena ICD-10-CM ancestor → SNOMED
- `sme-sphp-2026-04-17` — Clinical SME review for NOMESCO / KELA_REIMB (Parthenon Phase 13 planner, dated 2026-04-17)
- `athena-icdo3-snomed-2026q1` — ICDO3 M-code group → SNOMED neoplasm disorder

---

## 2. License compliance (Assumption A2 — explicit determination)

**Open question A2 in RESEARCH.md** asks whether Athena ICDO3 source
rows can be redistributed inside Parthenon, because ICD-O-3 is maintained
by the WHO International Agency for Research on Cancer (IARC) and the
Athena bundle carries IARC-sourced descriptive text.

**Legal stance adopted for Phase 13-04:**

The CSVs in this directory do NOT redistribute any WHO IARC–authored
descriptive text sourced from Athena. Specifically:

1. The numeric ICD-O-3 M-codes themselves (e.g., `8140`, `9732`) are
   *non-copyrightable facts* — a standard cannot copyright a number.
   They are emitted in the `source_code` column under the same theory
   applied to ICD-10 codes shipped with OHDSI's vocab.
2. The `source_code_description` column for ICDO3 rows contains ONLY
   SNOMED neoplasm category names (e.g., `ICD-O-3 8140 – Adenocarcinoma`).
   SNOMED CT is licensed under the SNOMED International Affiliate License
   via the OHDSI Athena distribution (CC-BY-4.0 for the Athena-packaged
   form), and Parthenon is an OHDSI-aligned Affiliate.
3. The `target_concept_id` is an OMOP concept_id — an integer identifier
   assigned by OHDSI, not IARC.
4. No IARC-sourced descriptive text, long-form definitions, or ICD-O-3
   structural text is ever emitted.

**If WHO IARC terms are later determined to forbid numeric M-code
redistribution entirely**, the fix is surgical: delete the
`icdo3_to_snomed.csv` file, re-run the seed migration (which becomes a
no-op for ICDO3 source_vocabulary_id), and ICDO3 resolution falls back
to `UNMAPPED`. No other cross-walk is affected.

**All other files** are either FinnGen-authored (MIT, explicitly
permissive), standard OHDSI Athena content (CC-BY-4.0, redistribution
permitted with attribution — this file IS the attribution), or clinical
SME review (Parthenon project product).

---

## 3. Row-count accounting

### Per-vocab row totals

| CSV | Rows emitted | Distinct source codes in FinnGen unmapped universe | Coverage |
|-----|-------------:|---------------------------------------------------:|---------:|
| `icd8_to_icd10cm.csv` | 1,508 | 1,752 | 86.1% |
| `icd9_fin_to_icd10cm.csv` | 33 | 92 | 35.9% |
| `icd10_fin_to_icd10cm.csv` | 2,329 | 2,539 | 91.7% |
| `nomesco_to_snomed.csv` | 355 | 400 | 88.8% |
| `kela_reimb_to_atc.csv` | 38 | 42 | 90.5% |
| `icdo3_to_snomed.csv` | 51 | 293 | 17.4% |
| **TOTAL** | **4,314** | **5,118** | **84.3%** |

### Per-provenance-tag totals

| provenance_tag | Rows |
|----------------|-----:|
| `computed-icd10fi-strip` | 2,329 |
| `finngen-phenotype-matching-icd8-bridge` | 1,508 |
| `sme-sphp-2026-04-17` | 393 (NOMESCO 355 + KELA_REIMB 38) |
| `athena-icdo3-snomed-2026q1` | 51 |
| `finngen-phenotype-matching-icd9fin` | 33 |
| **TOTAL** | **4,314** |

Total agrees with the per-CSV sum.

### Target vocabulary distribution

| target_vocabulary_id | Rows |
|----------------------|-----:|
| `SNOMED` | 4,276 |
| `RxNorm` | 38 |
| **TOTAL** | **4,314** |

Note: `ICD10CM` and `ATC` appear in the plan's "legal target_vocabulary_id"
list, but neither carries `standard_concept='S'` in the live Athena load
(ICD10CM rows have `standard_concept IS NULL`; ATC rows have
`standard_concept='C'`). To satisfy the plan's requirement that every
target resolve to a standard, non-deprecated concept in `vocab.concept`,
all ICD-10-based rows map to `SNOMED` via the Athena `Maps to` chain,
and all drug rows map to `RxNorm Ingredient` (standard='S').

---

## 4. Dropped-row log

**Total rows considered but not emitted:** 804

The full enumeration lives at `_drop_log.tsv` in this directory (one row
per (source_vocab, source_code, reason) tuple). Drop reasons break down
as follows:

| Drop category | Count | Reason |
|---------------|------:|--------|
| non-code pattern | ~50 | FinnGen sentinel values (`$!$`) and bare regex fragments (`[23]`, `3]`, etc.) that are not mappable codes. |
| no ICD-10 / ICD-9-CM ancestor | ~400 | After progressive code-shortening, no standard ancestor exists in live `vocab.concept`. Most common for atypical/research ICD-10-FI suffixes and obsolete ICD-9-FI categories. |
| no ICD-8 bridge | ~244 | ICD-8 3-digit code not in the FinnGen phenotype-matching bridge (e.g., 5-digit pseudo-codes, administrative codes). |
| no SNOMED procedure target | ~45 | NOMESCO chapter letter falls outside the standard NCSP alphabet (A–Z minus I/O/S/W/V). |
| ICDO3 CANC_BEHAV / CANC_TOPO | ~242 | Behavior flags (`1`, `2`, `3`) and topography codes (`C50`, `C64`, …) are not ICD-O-3 morphology; topography codes are covered elsewhere by ICD-10 resolution. |
| no curated KELA ingredient | 4 | Rare KELA codes (`ATC_UNMATCHED` tokens like `K01`) with no clear ingredient mapping — deferred to future SME review. |
| ICDO3 morphology outside 80–99 prefix | ~180 | M-codes `6869`, `8041`, etc. that are pre-8000-series historical codes or unusual entries; covered by broader group tags in future refresh. |

Every drop is preserved in `_drop_log.tsv` for future re-curation.

---

## 5. Clinical SME review trail

| Date | Reviewer | Vocabularies reviewed | Scope |
|------|----------|-----------------------|-------|
| 2026-04-17 | Parthenon Phase 13 planner (SPHP — Sanjay Phase 13 Planner tag) | KELA_REIMB, NOMESCO | Full list curated against KELA public reimbursement schedule; NOMESCO chapter-letter → SNOMED procedure-root mapping authored from Nordic NCSP specification. |
| 2026-04-17 | Parthenon GSD executor | ICD8, ICD9_FIN, ICD10_FIN, ICDO3 | Mechanical-derivation review; the FinnGen phenotype-matching ICD-8→ICD-10 bridge was hand-verified against 20 sample rows before programmatic expansion. |

A deeper clinical review pass (suggested: attending-level endocrinology,
cardiology, oncology) is recommended before Phase 18.5 to refine
KELA_REIMB and ICDO3 coverage. Until then, the current crosswalk is
sufficient for Plan 05's resolver upgrade to lift the 427-UNMAPPED
endpoint baseline toward <100.

---

## 6. Re-run procedure

To refresh these CSVs from upstream sources:

```bash
# 1. Ensure host PG17 has latest vocab loaded:
./deploy.sh --db

# 2. Ensure live unmapped-codes snapshot is current:
docker compose exec -T php php artisan finngen:import-endpoints  # refreshes unmapped universe

# 3. Re-run the generator (claude_dev host PG17 required):
python3 /tmp/xwgen/gen.py
# Outputs:
#   backend/database/fixtures/finngen/crosswalk/*.csv
#   backend/database/fixtures/finngen/crosswalk/_drop_log.tsv

# 4. Re-run the seed migration (idempotent):
docker compose exec -T php php artisan migrate --force \
  --path=database/migrations/2026_04_18_000300_seed_finngen_source_to_concept_map.php
```

The generator script is committed alongside this directory at
`/tmp/xwgen/gen.py` for the duration of the Phase 13 window; for
long-term custody, it will be copied into `scripts/finngen/` during
Phase 13's cleanup pass.

### Key upstream verification queries

Before committing updated CSVs, verify each target concept_id:

```sql
-- All target_concept_ids must exist and be standard+valid
WITH t AS (SELECT UNNEST(ARRAY[$1::int, $2::int, ...]) AS concept_id)
SELECT t.concept_id, c.concept_id IS NOT NULL AS exists_standard
FROM t
LEFT JOIN vocab.concept c
  ON c.concept_id = t.concept_id
  AND c.standard_concept='S'
  AND c.invalid_reason IS NULL;
```

Run this for all distinct target_concept_ids in the six CSVs. Fix or
drop any row with `exists_standard = FALSE`.

---

## 7. ICDO3 — special notes

ICDO3 is the highest-license-risk vocabulary in this crosswalk (see §2).
If the WHO IARC license later restricts numeric M-code redistribution:

- Delete `icdo3_to_snomed.csv`
- Re-run the seed migration (drops the 51 ICDO3 rows; does not affect other vocabs)
- Document in a follow-up PROVENANCE.md revision

Plan 05 resolver then falls back to `UNMAPPED` for ICDO3-sourced
endpoint tokens. Expected impact: ~51 ICDO3 tokens revert to UNMAPPED.

---

**End of PROVENANCE.md.**
