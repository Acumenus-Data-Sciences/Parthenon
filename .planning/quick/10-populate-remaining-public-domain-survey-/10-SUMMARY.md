---
phase: quick-10
plan: 01
subsystem: survey-instruments
tags: [pro, survey, instruments, public-domain, clinical-data]
dependency_graph:
  requires: []
  provides: [survey-instrument-items]
  affects: [standard-pros-module]
tech_stack:
  added: []
  patterns: [json-fixture-population]
key_files:
  created: []
  modified:
    - backend/database/fixtures/survey-instruments/library.json
decisions:
  - PROMIS instruments include LOINC codes where well-documented
  - PRAPARE and AHC HRSN include documented LOINC codes
  - NIH Toolbox CB uses performance response_type for cognitive subtests
  - OARS/OMFAQ expanded to full 100 items across all 5 OARS sections
  - DAS28 represented as 28 joint assessments with binary tenderness/swelling
  - PSQI items 1,3 use text response_type for time-of-day entries
metrics:
  duration: 10min
  completed: 2026-03-29
  tasks_completed: 3
  tasks_total: 3
  files_modified: 1
  items_added: 605
  instruments_populated: 29
---

# Quick Task 10: Populate Remaining Public Domain Survey Instruments Summary

Populated items arrays for 29 public domain survey instruments in library.json, adding 605 items across clinical, psychiatric, PROMIS, screening, and functional assessment domains.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 61f0442dc | Batch A: 10 clinical/psychiatric instruments (239 items) |
| 2 | de45d5850 | Batch B: 13 PROMIS + screening instruments (169 items) |
| 3 | 2932d2605 | Batch C: 6 remaining instruments (197 items) |

## Batch A: Clinical/Psychiatric Instruments (10)

| Instrument | Items | Response Type | Domain |
|------------|-------|---------------|--------|
| SAPS | 34 | Likert 0-5 | Mental Health |
| SANS | 25 | Likert 0-5 | Mental Health |
| WHOQOL-BREF | 26 | Mixed 1-5 Likert | Quality of Life |
| RMDQ | 24 | Binary yes/no | Functional Status |
| EPIC-26 | 26 | Mixed Likert | Oncology |
| NIH Toolbox CB | 12 | Performance | Cognition |
| Tinetti | 28 | Mixed 0-1/0-2 | Functional Status |
| DDS | 17 | Likert 1-6 | Diabetes |
| PSQI | 19 | Mixed (text, numeric, Likert) | Sleep |
| DAS28 | 28 | Binary (joint assessment) | Rheumatology |

## Batch B: PROMIS Family + Screening (13)

| Instrument | Items | LOINC Codes | Domain |
|------------|-------|-------------|--------|
| PROMIS-29 | 29 | Yes | Multi-domain |
| PROMIS PF | 10 | Yes | Physical Function |
| PROMIS PI | 8 | Yes | Pain Interference |
| PROMIS Fatigue | 8 | Yes | Fatigue |
| PROMIS Anxiety | 8 | Yes | Anxiety |
| PROMIS Depression | 8 | Yes | Depression |
| PROMIS Sleep | 8 | Yes | Sleep |
| PROMIS SI | 8 | Yes | Social Isolation |
| PROMIS CF | 8 | Yes | Cognitive Function |
| PROMIS PI-3a | 3 | Yes | Pain Intensity |
| PROMIS Ped | 40 | No | Pediatric Multi-domain |
| PRAPARE | 21 | Yes | Social Determinants |
| AHC HRSN | 10 | Yes | Social Needs |

## Batch C: Remaining Instruments (6)

| Instrument | Items | Response Type | Domain |
|------------|-------|---------------|--------|
| OARS/OMFAQ | 100 | Mixed | Geriatric Assessment |
| WHO SSC | 19 | Binary checklist | Surgical Safety |
| NEI VFQ-25 | 25 | Mixed Likert | Vision |
| YGTSS | 12 | Likert 0-5 | Tic Disorders |
| PHQ-SADS | 35 | Mixed Likert | Multi-symptom Screening |
| QOL-1 | 6 | Likert 1-5 | Quality of Life |

## Final Statistics

- Instruments populated in this task: 29
- Total new items added: 605
- Total instruments with items: 61 / 100
- JSON validation: PASSED

## Deviations from Plan

### Minor Adjustment

**1. [Rule 3 - Blocking] Batch B commit merged with concurrent risk-scores commit**
- **Found during:** Task 2 commit
- **Issue:** An intervening commit (de45d5850) from another process included library.json changes, absorbing Batch B changes
- **Resolution:** Batch B items were verified present in the committed state; no data loss

## Self-Check: PASSED

- library.json: FOUND
- Commit 61f0442dc: FOUND
- Commit 2932d2605: FOUND
- JSON validation: VALID
- Populated instruments: 61/100 (correct)
