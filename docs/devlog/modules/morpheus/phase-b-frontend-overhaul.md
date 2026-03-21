# Morpheus Phase B — Frontend Overhaul

**Date:** 2026-03-21
**Status:** Complete
**Commits:** b2bdff1fb..a87b9e88e (12 commits)

## Summary

Thorough overhaul of the Morpheus inpatient module frontend to exceed the Patient Profiles gold standard. Added clinical monitoring dashboard for labs (organ-system grouped panels with sparklines and interactive charts), bedside monitor layout for vitals (2x3 ICU-style grid with severity indicators), antibiogram heatmap for microbiology (organism x antibiotic S/I/R matrix), and a ConceptDetailDrawer for deep clinical data inspection with dual-code display (source + OMOP) and population context.

## What Changed

### New Components (14)

| Component | Lines | Purpose |
|-----------|-------|---------|
| LabPanelDashboard | ~200 | Organ-system grouped lab panels (Renal, Hepatic, Hematologic, Metabolic, Coagulation, Cardiac, Inflammatory) with expandable interactive charts |
| LabSparkline | ~40 | Inline SVG sparkline (100x28px) with green reference range band |
| LabTimeSeriesChart | ~120 | Zoomable/pannable SVG line chart with ResizeObserver, hover tooltips, keyboard navigation, optional overlay series |
| VitalsMonitorGrid | ~150 | 2x3 bedside monitor layout (HR, BP, SpO2, RR, Temp, GCS) with multi-vital timeline chart below |
| VitalsMonitorCell | ~50 | Individual vital sign cell with severity-driven border glow (red=critical, yellow=mild) |
| ConceptDetailDrawer | ~240 | Right-side slide-out with dual-code display (ICD/LOINC/NDC + OMOP), reference range indicators, patient history sparkline, population context stats |
| AntibiogramHeatmap | ~180 | Organism x antibiotic matrix with S/I/R color coding, specimen filter, MIC values in tooltips |
| CultureTable | ~130 | Grouped culture results with expandable sensitivity panels and S/I/R summary badges |
| HoverCard | ~70 | Reusable rich tooltip replacing all HTML `title` attributes — dark theme, auto-positioning, ESC dismiss |
| GroupedDiagnosisList | ~120 | Deduplicated diagnosis cards with count badges (x3), expandable per-admission occurrences |
| SearchDropdown | ~90 | Debounced patient search (300ms) with dropdown preview showing demographics, keyboard navigation |
| ExportButton | ~30 | CSV export with injection prevention (HIGHSEC: sanitizes `=`, `+`, `-`, `@` prefixes) |
| TruncationWarning | ~15 | Yellow warning banner when API results are capped |

### Modified Components (15)

- **MetricCard** — Now clickable with hover states, keyboard support (Enter/Space), focus ring
- **EventCountBar** — Domain colors from centralized constant, pills are buttons with onDomainClick → tab switching
- **PatientJourneyPage** — Full integration: Labs/Vitals/Microbiology tabs replaced with new components, drawer state, CSV export, medication click-to-drawer
- **MorpheusDashboardPage** — MetricCards navigate to filtered patient journey on click
- **LocationTrack** — HTML `title` replaced with HoverCard, keyboard pan/zoom (Arrow/+/-)
- **MedicationTimeline** — HoverCard tooltips, keyboard nav, onDrugClick → ConceptDetailDrawer
- **TrendChart, HorizontalBarChart, DonutChart, DistributionChart** — HoverCard tooltips on all elements, opacity hover effects
- **FilterBar, DatasetSelector, AdmissionPicker** — Focus indicators added

### Constants (4 new files)

- `constants/domainColors.ts` — 7 clinical domain colors + vital-specific colors, used across all components
- `constants/labPanels.ts` — LOINC-based organ system panel mapping (7 panels, ~50 lab tests)
- `constants/vitalTypes.ts` — MIMIC-IV itemid/label → vital category mapping with normal/critical ranges
- `constants/antibioticClasses.ts` — 40-entry antibiotic → drug class mapping for antibiogram column ordering

### Backend

- New endpoint: `GET /api/v1/morpheus/dashboard/concept-stats/{conceptId}` — population-level statistics for ConceptDetailDrawer (patient count, percentage, mean/median for labs)
- Service method with 10-min cache TTL, queries diagnoses_icd + labevents
- 3 Pest tests added

## Stats

| Metric | Before | After |
|--------|--------|-------|
| Files | 17 | 32 |
| Lines of code | 1,916 | 3,953 |
| Components | 13 | 27 |
| Constants | 0 | 4 |
| Backend endpoints | 8 | 9 |

## Design Decisions

1. **Kitchen sink approach** — went beyond Patient Profiles parity with inpatient-specific features (bedside monitor, antibiogram, organ-system lab panels)
2. **Pure SVG charts** — no chart library dependency, consistent with existing codebase pattern
3. **Domain color system** — centralized in `domainColors.ts`, used across all components for consistency
4. **ConceptDetailDrawer as primary interaction** — single drawer component handles all clinical domains (labs, meds, diagnoses, vitals, microbiology)
5. **Dual-code display** — shows both source code (ICD/LOINC/NDC) and OMOP standard concept side-by-side
6. **Population context** — new backend endpoint provides per-concept stats; graceful degradation when unavailable

## Spec & Plan

- Spec: `docs/superpowers/specs/2026-03-21-morpheus-frontend-overhaul-design.md`
- Plan: `docs/superpowers/plans/2026-03-21-morpheus-frontend-overhaul.md`

## What's Next

- Infection timeline (culture-to-treatment temporal correlation) — deferred to future phase
- Clinical decision support alerts/rules engine — out of scope
- IntersectionObserver lazy rendering for lab sparklines — optimization for patients with 2000+ results
- Frontend unit tests for new utility functions (findLabPanel, classifyVital, sanitizeCell, etc.)
