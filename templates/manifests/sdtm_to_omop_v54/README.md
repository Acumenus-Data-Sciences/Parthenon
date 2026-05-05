# sdtm_to_omop_v54

CDISC SDTM v3.4 → OMOP CDM v5.4 bridge. v1 covers 5 domains (DM/AE/CM/VS/LB)
per Phase 2 spec decision Q9 — sufficient for ~80% of safety-trial data.

## When to use

You have CDISC-formatted clinical-trial data (XPT files from sponsors,
CROs, or your own SDTM-compliant trials) and want them in OMOP CDM v5.4
for cohort building, cross-trial federation, or RWE comparison.

## Pipeline

12-stage pipeline, all `sql_node` and `sdtm_domain` nodes:

1. Bootstrap `sdtm_source` schema + 5 `fmt_<domain>` raw tables.
2. Bootstrap per-source CDM schema (default `sdtm_lzzt`).
3-7. Read DM/AE/CM/VS/LB XPT files via `SdtmDomainNode` → `fmt_<domain>` tables.
8. DM → PERSON + LOCATION (SEX → 8507/8532, RACE → SNOMED).
9. AE → CONDITION_OCCURRENCE (MedDRA → SNOMED via concept_relationship).
10. CM → DRUG_EXPOSURE (CMTRT → RxNorm).
11. VS → MEASUREMENT (VSTESTCD → LOINC; UCUM units).
12. LB → MEASUREMENT (LBTEST → LOINC; range_low/high from LBORNRLO/HI).
13. SUMMARIZE row counts.

## Vocabulary requirements

`metadata.requires.vocabularies`: SNOMED, LOINC, RxNorm, **MedDRA**.

MedDRA is a hard requirement — if a customer doesn't license MedDRA,
the AE mapper routes every code to `app.unmapped_concepts_queue`. The
mapping-review UI surfaces those for human resolution.

## v1 domain coverage (Q9)

- **DM** Demographics → PERSON + LOCATION
- **AE** Adverse Events → CONDITION_OCCURRENCE
- **CM** Concomitant Medications → DRUG_EXPOSURE
- **VS** Vital Signs → MEASUREMENT
- **LB** Laboratory Results → MEASUREMENT

Out of v1 (Phase 3 follow-up): TR (Tumor Results), TU (Tumor Identification),
TM (Trial Summary), DS (Disposition), EX (Exposure), MH (Medical History),
PE (Physical Exams), SU (Substance Use).

## Test fixture (LZZT)

The CDISC Pilot Project ("LZZT") dataset is the canonical test corpus.
Per Q10 it's not bundled in the repo — fetch on demand:

```bash
make fetch-fixtures
```

That populates `templates/tests/fixtures/lzzt/{dm,ae,cm,vs,lb}.xpt`.
The E2E test (`tests/e2e/test_sdtm_to_omop_v54.py`) skips when the
fixtures are absent.

## Operations

```bash
# Customer mounts XPT directory at /data/trial-x.
curl -X POST http://parthenon-templates:8001/runs \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": "sdtm_to_omop_v54",
    "parameters": {
      "xpt_root": "/data/trial-x",
      "cdm_schema": "sdtm_trial_x"
    }
  }'
```

## See also

- ADR 0011 — SDTM → OMOP bridge design.
- Phase 2 spec decisions Q7 (vocabularies), Q9 (domain priority), Q10 (LZZT distribution).
