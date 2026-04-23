# REAL-PE Replication in Parthenon

**Status:** Draft scaffold — concept_ids not yet hydrated, feasibility not yet run.
**Source study:** Monteleone P, Ahern R, Banerjee S, et al. *Modern Treatment of Pulmonary Embolism (USCDT vs MT): Results From a Real-World, Big Data Analysis (REAL-PE).* J Soc Cardiovasc Angiogr Interv. 2024;3:101192. [DOI](https://doi.org/10.1016/j.jscai.2023.101192)
**Owner:** Sanjay Udoshi (Acumenus)
**Target corpus:** Acumenus CDM (schema `omop`), fallback pool with SynPUF / MIMIC-IV if case volume is insufficient.

## Why replicate this

REAL-PE is a Truveta comparative safety analysis of two advanced PE therapies — ultrasound-assisted catheter-directed thrombolysis (USCDT, EKOS) vs mechanical thrombectomy (MT, FlowTriever). Its methodological distinction is deriving ISTH and BARC 3b major-bleed endpoints from *direct laboratory values and transfusion documentation*, not just diagnosis codes. Replicating this in Parthenon exercises:

- Cohort definition with procedural + diagnostic temporal constraints.
- Custom outcome derivation that joins `MEASUREMENT` (Hgb) and `PROCEDURE_OCCURRENCE` (transfusion) — a pattern standard Circe cohort expressions cannot express.
- PS-matched comparative safety analysis via HADES `CohortMethod` on the R-runtime.
- Results-explorer rendering of a Central-Illustration-style bleeding panel.

Successful replication against Acumenus CDM is a credible demonstration that Parthenon can reproduce a published real-world-evidence study on demand — a story worth telling in Series A diligence.

## Replication architecture

```
 ┌──────────────────────────────────────────────────────────────────┐
 │ Step A — Feasibility (sql/01_feasibility_counts.sql)             │
 │ Run against omop.* to decide: native, pooled, or demo-only path. │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ Step B — Concept hydration (sql/00_hydrate_concept_ids.sql)      │
 │ Resolve CPT/LOINC concept_ids for your vocab release; patch the  │
 │ four cohort JSONs before seeding.                                │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ Step C — Cohort generation (cohorts/*.json)                      │
 │ Seed four cohorts via the cohorts module or artisan fixtures.    │
 │   01 USCDT target                                                 │
 │   02 MT comparator                                                │
 │   03 ISTH bleed (dx code arm only — see SQL for full outcome)     │
 │   04 Intracranial hemorrhage outcome                              │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ Step D — Outcome derivation (sql/02_isth_barc_outcomes.sql)      │
 │ Custom SqlRender template that joins MEASUREMENT + PROCEDURE +   │
 │ cohort tables to build ISTH and BARC 3b flags, plus 2x2 counts.  │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ Step E — PS-matched comparative analysis (HADES CohortMethod)    │
 │ Run via the r-runtime plumber API. Covariates from the REAL-PE   │
 │ Table 1 set (age >=60, sex, cancer hx, prior bleed, prior        │
 │ hemorrhagic stroke, anticoagulant use). Report matched ORs and   │
 │ Schoenfeld residuals. Add negative-control outcomes for          │
 │ empirical calibration (improvement over Truveta).                │
 └──────────────────────────────────────────────────────────────────┘
```

## Files in this folder

| File | Purpose |
|------|---------|
| `sql/00_hydrate_concept_ids.sql` | Resolves CPT/LOINC concept_ids from local vocab before cohort seed |
| `sql/01_feasibility_counts.sql` | Figure-1-style funnel counts and hemoglobin/transfusion coverage |
| `sql/02_isth_barc_outcomes.sql` | Custom outcome derivation joining Hgb measurements, transfusions, and bleed dx |
| `cohorts/01-uscdt-target.json` | USCDT target cohort (CPT 37211-37214, inpatient, PE within 30d) |
| `cohorts/02-mt-comparator.json` | MT comparator cohort (CPT 37187, inpatient, PE within 30d) |
| `cohorts/03-isth-major-bleed-dx-component.json` | Diagnosis-code arm of the ISTH definition |
| `cohorts/04-intracranial-hemorrhage.json` | Secondary ICH outcome cohort |

## Faithfulness to the Truveta methodology

| REAL-PE design element | Parthenon equivalent | Notes |
|---|---|---|
| Truveta UDI + medical annotators | CPT 37187 / 37211-37214 with `includeDescendants` on `PROCEDURE_OCCURRENCE` | CPT does **not** uniquely distinguish EKOS from FlowTriever. If Acumenus ETL preserves UDI in `DEVICE_EXPOSURE.device_source_value`, augment ConceptSet 0 in each target/comparator before seeding. Otherwise, acknowledge that cohorts represent procedure *class* not specific device. |
| PE dx within 30d before or 1d after index | InclusionRule with StartWindow `[-30d, +1d]` relative to procedure | Exact match to Truveta inclusion. |
| Inpatient encounter | `PrimaryCriteria.ProcedureOccurrence.VisitType = [9201]` | Truveta also admitted patients whose ER/procedural dept coded as outpatient but admitted within 24h. This refinement is deferred to post-MVP — adds ~4% of their cohort. |
| Adverse events within 7d of index | SQL windows of `[index, index+7d]` throughout `02_isth_barc_outcomes.sql` | Exact match. |
| ISTH major bleed = dx OR (transfusion + Hgb drop >=2) | Custom SQL in `02_isth_barc_outcomes.sql` | **Not expressible in standard Circe.** The dx arm is a conventional cohort; the lab+transfusion arm is the extension. |
| BARC 3b = Hgb drop >=5 | Same SQL template | Exact match. Uses `MAX(Hgb in -30..0d) - MIN(Hgb in 0..7d)`. |
| CPT 36430 transfusion | Hydrated transfusion concept_ids + descendants of concept 4048742 | Our capture is slightly broader to include packed-cell RBC and platelet codes, which is likely what Truveta's annotators matched. |
| Chi-square test for 2x2 | Native Postgres aggregation + chi-square in R or analyses module | Mirrors their use of R `chisq.test`. |
| Multivariable logistic regression | HADES `CohortMethod` PS-matched analysis via R-runtime | Parthenon improvement: negative-control calibration and forest plot instead of raw OR table. |

## Known deviations from Truveta

1. **Device specificity.** Without UDI, our cohorts represent *procedure class*, not specific devices. If the replication is used externally, frame it as "USCDT-class (CPT 37211-37214) vs MT-class (CPT 37187)" rather than "EKOS vs FlowTriever."
2. **LOS end-date imputation.** Truveta excluded 687 patients with missing visit end date. Parthenon's default is to exclude as well; the query is parameterized if you want to impute.
3. **Severity stratification by ESC risk.** Truveta explicitly deferred this; we do the same for now. Adding RV/LV ratio extraction from CT reports is a separate imaging-module workstream.

## Next steps (in order)

1. **Run feasibility SQL.** If step-3 eligible counts are <30 per arm in Acumenus, pool with SynPUF or pivot to MIMIC-IV for a methods demo.
2. **Hydrate concept_ids.** Replace the `"CONCEPT_ID": 0` placeholders in the four cohort JSONs with the values returned by `00_hydrate_concept_ids.sql`.
3. **Seed cohorts.** Copy hydrated JSONs to `backend/database/fixtures/designs/cohort_definitions/` or load via the cohorts API.
4. **Generate cohorts.** Run generation against the Acumenus source; confirm counts align with feasibility.
5. **Execute outcome SQL.** Run `02_isth_barc_outcomes.sql` with the target/comparator/bleed-dx cohort IDs bound.
6. **Build a PS-matched analysis** in the analyses module using the covariate set from the Table 1 column.
7. **Render results.** Build a Central Illustration panel in the results-explorer — 6 bleeding metrics × 2 cohorts × 2 eras.
8. **Publish as a reproducible Study** via the studies module, versioned with study artifacts.

## Open questions

- Does the Acumenus ETL preserve UDI in `DEVICE_EXPOSURE.device_source_value`? If yes, the cohorts can be sharpened to true EKOS vs FlowTriever.
- Which Hgb LOINC does Acumenus use as its standard — 718-7, 30350-3, or both? The feasibility query reports all four; the outcome SQL accepts an array so it can handle either.
- Should we add negative-control outcomes (e.g., ingrown toenail, insect bite) for empirical calibration? This would be an explicit methodological advance over the original.
