# AFib Anticoagulation Study Design

**Date:** 2026-03-10
**Branch:** `feature/chromadb-abby-brain`

## What Was Built

Designed and implemented a complete OHDSI observational study investigating thromboembolic and hemorrhagic risk in atrial fibrillation patients on warfarin dual antithrombotic therapy (warfarin + aspirin/clopidogrel) versus warfarin monotherapy.

All entities created via the Parthenon API — no file changes required.

### Data Exploration

Queried the Acumenus `omop` schema to assess data availability:

| Metric | Count |
|--------|-------|
| AFib patients (SNOMED 313217 + subtypes) | 9,603 |
| Warfarin drug eras | 12,495 |
| Warfarin + antiplatelet overlap | 1,502 |
| Warfarin monotherapy | 8,101 |
| INR measurements | 80,296 patients |
| MI in AFib patients | 614 |
| Acute PE in AFib patients | 96 |
| Bleeding events in AFib patients | 41 |
| CHA2DS2-VASc: Hypertension | 380,336 |
| CHA2DS2-VASc: IHD | 187,381 |
| CHA2DS2-VASc: Heart failure | 1,284 |
| Median follow-up | ~66 years (Synthea long records) |

**Key finding:** No NOACs (apixaban, rivaroxaban, dabigatran, edoxaban) exist in this Synthea dataset. Pivoted study design from warfarin vs NOACs to dual antithrombotic therapy vs monotherapy — an equally clinically relevant question.

### Concept Sets Created (7)

| ID | Name | Items | Purpose |
|----|------|-------|---------|
| 26 | AFib Diagnosis | 5 | Entry event — AFib + subtypes |
| 27 | Warfarin | 2 | Drug exposure — ingredient + clinical drug |
| 28 | Antiplatelet Agents | 2 | Aspirin + clopidogrel |
| 29 | Thromboembolic Outcomes | 2 | MI + acute PE |
| 30 | Hemorrhagic Outcomes | 3 | ICH, GI hemorrhage, anorectal bleeding |
| 31 | CHA2DS2-VASc Components | 6 | CHF, HTN, DM, IHD, CVD, stroke sequelae |
| 32 | INR Measurements | 2 | INR + PT lab tests for TTR analysis |

All tagged `afib-study` with `include_descendants: true` for proper concept resolution.

### Cohort Definitions Created (2)

| ID | Name | Expected n | Key Criteria |
|----|------|-----------|--------------|
| 23 | AFib Warfarin + Antiplatelet (Dual Therapy) | ~1,502 | AFib dx + warfarin within 30d + overlapping antiplatelet + 365d prior obs + age ≥18 |
| 24 | AFib Warfarin Monotherapy (No Antiplatelet) | ~8,101 | AFib dx + warfarin within 30d + NO antiplatelet overlap + 365d prior obs + age ≥18 |

Both use Atlas-compatible expression JSON with embedded ConceptSets, AdditionalCriteria for drug exposure requirements, and DemographicCriteria for age filter.

### Analyses Created (4)

| Type | ID | Name | Design |
|------|----|------|--------|
| Estimation | 3 | Comparative Effectiveness | PS 1:4 matching, Cox PH, 5yr TAR |
| Incidence Rate | 3 | Dual Therapy Events | MI/PE/bleeding per 1,000 PY, age/gender stratified |
| Incidence Rate | 4 | Monotherapy Events | MI/PE/bleeding per 1,000 PY, age/gender stratified |
| Characterization | 3 | Baseline Comparison | Demographics, comorbidities, meds, SMD balance |

### Study Created

| Field | Value |
|-------|-------|
| ID | 42 |
| Title | Thromboembolic and Hemorrhagic Risk in AFib: Warfarin Dual Antithrombotic Therapy vs Monotherapy |
| Type | comparative_effectiveness |
| Design | cohort |
| Status | draft |
| Cohorts | Target (dual therapy) + Comparator (monotherapy) |
| Analyses | 4 linked analyses |

## Clinical Rationale

Guidelines discourage adding antiplatelet agents to warfarin in AFib unless there's a strong indication (recent ACS, PCI stent). This study quantifies the risk-benefit tradeoff:

- **Hypothesis:** Dual therapy increases bleeding without reducing thromboembolic events
- **Primary outcomes:** Composite thromboembolic (MI + PE) and hemorrhagic events
- **Secondary:** CHA2DS2-VASc stratification, TTR analysis, age/gender incidence rates
- **Adjustment:** Propensity score matching on demographics + comorbidities

## Minor Fixes (from prior session)

- `ai/requirements.txt`: Fixed transformers version constraint (`>=4.41,<5` instead of `5.*`)
- `docker-compose.yml`: ChromaDB healthcheck uses Python urllib instead of curl (curl not in image)
- `GenomicsPage.tsx`: Added GB formatting for large file sizes

## Gotchas

1. **Synthea AFib module:** 100% of AFib patients get warfarin + digoxin. No NOACs at all.
2. **Drug concept hierarchy:** Drug exposures stored at clinical drug level, not ingredient. Use `drug_era` table for ingredient-level queries, or `concept_ancestor` to find descendants.
3. **Sanctum token expiry:** Tokens from login can expire during long sessions. Re-authenticate if you get 401s.
4. **Study sub-routes:** `GET /studies/{id}/cohorts` may fail with 404 even when study exists — possible route model binding issue with slug vs ID.
