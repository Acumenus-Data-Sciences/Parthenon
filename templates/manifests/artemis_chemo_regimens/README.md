# artemis_chemo_regimens

Identifies chemotherapy regimens from OMOP `drug_exposure` rows. Built
on a Python regimen matcher backed by a versioned ARTEMIS pattern
library shipped at `templates/runtime/oncology/artemis/<version>/patterns.json`.

## v0.1 scope

5 regimens covering the most common chemotherapy patterns:

| Regimen | Indication | Drugs |
|---|---|---|
| FOLFIRINOX | Pancreatic cancer | fluorouracil, leucovorin, irinotecan, oxaliplatin |
| FOLFOX | Colorectal cancer | fluorouracil, leucovorin, oxaliplatin |
| R-CHOP | Diffuse large B-cell lymphoma | rituximab, cyclophosphamide, doxorubicin, vincristine, prednisone |
| AC-T | Breast cancer | doxorubicin, cyclophosphamide, paclitaxel |
| Carboplatin+Paclitaxel | Non-small-cell lung cancer | carboplatin, paclitaxel |

The full ARTEMIS R-package install (build-time extraction of all ~600
HemOnc-curated regimens) is deferred to Phase 3 (ADR 0014).

## Pipeline

1. Bootstrap `${cdm_schema}.episode` + `episode_event` tables (CDM v5.4 oncology extension).
2. `RegimenMatcherNode` reads `${cdm_schema}.drug_exposure`, matches against the
   pattern library with drug-set + temporal-window matching (75% coverage
   within ±7 days by default), and writes a `regimens.json` artifact with
   episode + episode_event row dicts ready for downstream load.

## Matching algorithm

For each (person_id, anchor_date) pair, the matcher scans forward up to
`window_days` and counts how many of the regimen's required drugs appear.
If `count / required >= min_coverage`, a `RegimenMatch` is emitted with
the anchor date as `episode_start_date`. Tunable via parameters:

- `window_days` (default 7) — temporal window in days
- `min_coverage` (default 0.75) — fraction of pattern drugs required

## Vocabulary requirements

`RxNorm` (drug concept_ids) and `ATC` (chemo class hierarchy) — both in
the Phase 0 Athena vocabulary load.

## HIGHSEC notes

`episode_source_value` carries the canonical regimen name (`"FOLFIRINOX"`)
— never raw clinical-note text. PHI exposure is bounded to the
`drug_exposure_start_date` + `drug_concept_id` fields, both already in
the OMOP CDM at the customer's chosen access tier.

## Operations

```bash
# Run against a per-source CDM schema (default: mimic_iv).
curl -X POST http://parthenon-templates:8001/runs \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": "artemis_chemo_regimens",
    "parameters": {
      "cdm_schema": "mimic_iv",
      "window_days": 7,
      "min_coverage": 0.75
    }
  }'
```

## See also

- ADR 0014 — ARTEMIS regimen extraction strategy + Phase 3 follow-up.
- Phase 2 spec decision Q8 (R-package distribution).
- Plan 4 (`load_mimic_iv_omop`) populates `mimic_iv.drug_exposure`.
