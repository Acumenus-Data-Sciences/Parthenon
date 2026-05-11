# ADR 0011 — SDTM → OMOP Bridge Design

**Status:** Accepted (2026-05-05)
**Deciders:** Phase 2 spec Q7 (vocabularies), Q9 (domain priority), Q10 (LZZT distribution).
**Implements:** Phase 2 Plan 6.

## Context

CDISC-formatted clinical-trial data (XPT files from sponsors, CROs, or
in-house SDTM-compliant trials) is the dominant exchange format for
regulated drug development. Phase 2 adds a Parthenon template that
ingests SDTM v3.4 into OMOP CDM v5.4.

Two scoping questions: which domains to ship in v1, and how to handle
the LZZT pilot test fixture.

## Decision

**v1 domains (Q9):** DM, AE, CM, VS, LB. These cover ~80% of
safety-trial data — demographics, adverse events, concomitant meds,
vitals, and labs. Disposition (DS), Exposure (EX), Tumor Results (TR),
Tumor Identification (TU), Trial Summary (TM), Medical History (MH),
Physical Exams (PE), and Substance Use (SU) are out of scope and
tracked as Phase 3 follow-ups.

**Pipeline (12 stages):** all `sql_node` and `sdtm_domain` nodes.

| Stage | Purpose |
|---|---|
| 1 | Bootstrap `sdtm_source` schema + 5 `fmt_<domain>` raw tables |
| 2 | Bootstrap per-source CDM schema (default `sdtm_lzzt`) |
| 3-7 | Read DM/AE/CM/VS/LB XPT files via `SdtmDomainNode` (pyreadstat) |
| 8 | DM → PERSON + LOCATION (SEX 8507/8532; RACE → SNOMED) |
| 9 | AE → CONDITION_OCCURRENCE (MedDRA Preferred Term → SNOMED via concept_relationship) |
| 10 | CM → DRUG_EXPOSURE (CMTRT → RxNorm Ingredient) |
| 11 | VS → MEASUREMENT (VSTESTCD/VSTEST → LOINC; UCUM units) |
| 12 | LB → MEASUREMENT (LBTEST → LOINC; range_low/high from LBORNRLO/HI) |
| 13 | SUMMARIZE row counts |

**Vocabulary requirements (Q7):** SNOMED + LOINC + RxNorm + **MedDRA**.
MedDRA is a hard requirement — without it, the AE mapper routes every
code to `app.unmapped_concepts_queue`.

**Type concept ID:** AE rows use type_concept_id 32856 ("Diagnostic
Report") to flag them as clinical-trial AEs distinct from EHR-encounter
diagnoses.

**LZZT fixture distribution (Q10):** Not bundled in the repo. The
top-level `Makefile` has a `fetch-fixtures` target that downloads the
CDISC public Pilot Project archive and unzips XPT files into
`templates/tests/fixtures/lzzt/`. CI caches via the standard runner
cache; offline fallback documented in the fixture README.

## Consequences

- Customers running CDISC-formatted clinical-trial data can now feed
  the Parthenon stack directly. The MedDRA requirement may force some
  customers to acquire a license; the unmapped queue surface gives them
  a path forward without it.
- `sdtm_domain` registers as a new node type (id 12 in
  `template.v1.json` enum).
- `pyreadstat==1.2.7` becomes a runtime dep — adds ~5 MB to the
  templates image; no runtime perf impact (XPT reads are O(rows)).
- Per-source CDM target (`cdm_schema` parameter; default `sdtm_lzzt`)
  lets customers run multiple trials side-by-side.
- Define-XML reader is a v2 stretch — pyxsd validation against a
  study's metadata definitions before mapping. Captured as Phase 3
  follow-up; not blocking v1.

## Alternatives considered

- **Per-domain templates** (one per DM/AE/CM/VS/LB) — declined; multiplies
  manifest count without benefit. The 12-stage manifest with shared
  schema bootstrap is cleaner.
- **Bundle LZZT in the repo** — declined per Q10. License review burden
  + ~50 MB bloat for every clone. Fetch-on-demand keeps the repo small.
- **Map AE through ICD-10 instead of MedDRA→SNOMED** — declined.
  Clinical trials are MedDRA-coded by regulation; an ICD-10 round-trip
  loses specificity (Preferred Terms have finer granularity than
  ICD-10-CM).
- **Ship Define-XML support in v1** — declined; the XPT path is the
  primary value, and Define-XML adds substantial pyxsd dependency
  complexity without commensurate v1 benefit.

## Open follow-ups

- Define-XML reader for runtime metadata validation (Phase 3 stretch).
- Domain coverage expansion: TR + TU for oncology trials; DS + EX for
  exposure-tracking trials; MH for cohort comparison.
- LZZT-to-MedDRA seed pack — a small mapping seed that lets customers
  without a MedDRA license still ingest the LZZT pilot for testing.
