# Phase 2 Plan 6 — SDTM Bridge Execution Devlog

**Branch:** `feature/phase-2-plan-6-impl-sdtm`
**Plan:** `docs/superpowers/plans/2026-05-05-parthenon-ingestion-templates-phase-2-plan-6-sdtm.md`
**Started:** 2026-05-05

## Task progress

- [x] Task 1: pyreadstat==1.2.7 pinned in pyproject.toml
- [x] Task 2: Makefile fetch-fixtures target (LZZT, Q10)
- [x] Task 3: SdtmDomain enum + XptReadError / SdtmDomainError
- [x] Task 4: SdtmDomainNode (pyreadstat XPT reader)
- [x] Task 5: sdtm_source schema + 5 fmt_<domain> tables
- [x] Task 6: SdtmDomainNode loads XPT into fmt_<domain> via to_sql
- [x] Task 7: DM → PERSON + LOCATION mapper
- [x] Task 8: AE → CONDITION_OCCURRENCE (MedDRA → SNOMED)
- [x] Task 9: CM → DRUG_EXPOSURE (CMTRT → RxNorm)
- [x] Task 10: VS → MEASUREMENT (VSTESTCD → LOINC)
- [x] Task 11: LB → MEASUREMENT (LBTEST → LOINC; range_low/high)
- [x] Task 12: sdtm_to_omop_v54 manifest + LZZT-anchored E2E
- [ ] Task 13: Define-XML reader (OPTIONAL stretch — deferred to Phase 3)
- [x] Task 14: ADR 0011 — SDTM → OMOP bridge design

## Notes

- **Define-XML stretch deferred** — adds substantial pyxsd dep complexity for
  marginal v1 benefit. Captured as Phase 3 follow-up in ADR 0011.
- **MedDRA hard requirement** — AE mapping requires MedDRA in vocab.concept.
  Without it, every AETERM goes to app.unmapped_concepts_queue. ADR 0011
  documents this; README warns customers; future LZZT-to-MedDRA seed pack
  is a tracked follow-up.
- **LZZT fetch** — tested locally via `make fetch-fixtures` against a real
  CDISC public URL. Offline fallback documented in fixture README.
- **Manifest validator** — added "sdtm_domain" to NODE_TYPES in manifest.py
  + template.v1.json schema enum.
