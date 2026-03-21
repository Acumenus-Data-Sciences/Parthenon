# Morpheus Frontend Overhaul — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Kitchen-sink overhaul of Morpheus inpatient module to exceed Patient Profiles gold standard

## Context

The Morpheus inpatient module has strong foundations — population-level dashboard, LocationTrack/MedicationTimeline Gantt charts, dataset selector, URL-synced filters — but falls short of the Patient Profiles gold standard in clinical data presentation, interactivity, and polish. This overhaul brings Morpheus to parity on all 22 identified gaps and adds inpatient-specific features that go beyond Patient Profiles.

## Design Decisions (from brainstorming)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Approach | Kitchen sink (C) | Go beyond Patient Profiles with inpatient-specific features |
| Labs/Vitals visualization | Clinical monitoring dashboard (C) | Bedside monitor layout for vitals, organ-system lab panels with interactive charts |
| Microbiology | Antibiogram heatmap (B) | Universally recognized ID visualization, high impact-to-effort |
| ConceptDetailDrawer | Dual-code with contextual enrichment (C) | Source code + OMOP mapping + patient history + population context |
| Keyboard/Accessibility | Patient Profiles parity (A) | Arrow keys on timelines, Escape closes, Tab through all, focus rings |

---

## Section 1: Labs Tab — Clinical Monitoring Dashboard

### Organ System Grouping

Labs grouped into clinical panels via a static LOINC lookup:

| Panel | Lab Tests |
|-------|-----------|
| Renal | Creatinine, BUN, eGFR, Potassium, Sodium, Chloride, CO2, Calcium, Phosphate |
| Hepatic | AST, ALT, Alk Phos, Total Bilirubin, Direct Bilirubin, Albumin, Total Protein |
| Hematologic | WBC, Hemoglobin, Hematocrit, Platelets, RBC, MCV, MCH, MCHC, RDW |
| Metabolic | Glucose, HbA1c, Lactate, Magnesium, Anion Gap |
| Coagulation | PT, INR, PTT, Fibrinogen, D-Dimer |
| Cardiac | Troponin, BNP/NT-proBNP, CK, CK-MB, LDH |
| Inflammatory | CRP, ESR, Procalcitonin, Ferritin |

### Panel Row Display

Each row within a panel shows:
- Test name + count badge (x12)
- Inline SVG sparkline (100x28px) with green reference range band
- Latest value (large, domain-colored #818CF8 indigo)
- Trend icon: TrendingUp (#E85A6B red) / TrendingDown (#818CF8 blue) / Minus (#22C55E green)
- Severity grading: Normal (green), Mild (yellow), Moderate (orange), Critical (red) — based on distance from reference range

### Expandable Interactive Chart

Clicking a row expands to a zoomable/pannable SVG line chart:
- X-axis: time, Y-axis: value
- Reference range as green semi-transparent band
- Data points as circles; hover shows exact value + date
- Scopes to selected admission when AdmissionPicker is active
- Multi-overlay: select multiple tests from same panel to overlay on one chart (e.g., Creatinine + BUN)

### Data Flow

Uses existing `useMorpheusLabResults(subjectId, hadmId, dataset)` hook. Frontend groups by lab item `label` or `itemid` (MIMIC-IV d_labitems references), maps to organ system panels via static lookup table. Note: MIMIC-IV labevents uses `itemid`/`label`, not LOINC codes directly. The `constants/labPanels.ts` lookup maps by label string (e.g., "Creatinine", "Potassium").

---

## Section 2: Vitals Tab — Bedside Monitor Layout

### Monitor Grid (2x3)

| Cell | Vital | Color | Display |
|------|-------|-------|---------|
| Top-left | Heart Rate | #22C55E green | Large value + bpm, sparkline |
| Top-center | Blood Pressure | #E85A6B red | Systolic/Diastolic + MAP, sparkline |
| Top-right | SpO2 | #2DD4BF cyan | Percentage, waveform-style sparkline |
| Bottom-left | Respiratory Rate | #C9A227 yellow | Breaths/min, sparkline |
| Bottom-center | Temperature | #818CF8 indigo | F/C toggle, sparkline |
| Bottom-right | GCS / Pain Score | #94A3B8 slate | Score + component breakdown (shows "No data" if unavailable; grid remains 2x3) |

### Each Monitor Cell

- Vital name (small label, top-left)
- Large current/latest value (prominent, domain-colored)
- Unit label
- Mini sparkline (last 24h or admission window)
- Min/Max range for displayed window (small text, bottom)
- Abnormal indicator: cell border glows severity color (normal=none, mild=yellow, critical=red)

### Full Timeline Chart (Below Grid)

- Scrollable time-series with all vitals overlaid (each in assigned color)
- Toggle checkboxes to show/hide individual vitals
- Zoom/pan matching Labs chart interaction pattern
- Hover crosshair shows all vital values at that timestamp
- Admission-scoped when selected via AdmissionPicker

### Data Flow

Uses existing `useMorpheusVitals(subjectId, hadmId, stayId, dataset)` hook. Frontend maps MIMIC-IV itemids to vital categories via static lookup.

---

## Section 3: ConceptDetailDrawer — Dual-Code with Contextual Enrichment

### Structure

360px right-side slide-out drawer. Appears when clicking any clinical data point.

### Header

- Domain color bar (left border)
- Concept name (large, bold)
- Close button (X) + Escape key
- Backdrop dimming (click to close)

### Section 3.1 — Dual Code Display

Two columns:

| Source Code | OMOP Standard Concept |
|-------------|----------------------|
| ICD-10: `I50.9` | Concept ID: `316139` |
| Vocabulary: ICD10CM | Vocabulary: SNOMED |
| "Heart failure, unspecified" | "Heart failure" |
| | Mapping status badge |

Applies to all domains: ICD for diagnoses, NDC for drugs, LOINC for labs. Unmapped concepts show yellow "Unmapped" badge, no right column.

### Section 3.2 — Current Occurrence Details

- Start/end dates
- Labs: value + unit, reference range, severity badge (Normal/Low/High/Critical with icons)
- Drugs: route, dose, frequency, days supply
- Diagnoses: sequence number, priority (primary/secondary)
- Vitals: value + unit, timestamp

### Section 3.3 — Patient History (Contextual Enrichment)

- "This Patient" header
- Total occurrences count (e.g., "Creatinine measured 47 times")
- Labs: inline sparkline of all historical values, current value highlighted
- Medications: total administrations, date range of use
- Diagnoses: list of admissions where this diagnosis appeared

**Data fetching strategy:** The drawer always fetches patient-wide data (with `hadmId = undefined`) regardless of the current AdmissionPicker selection. This ensures the "Patient History" section shows the full picture. The domain-specific hooks are called in parallel: one admission-scoped call for the active tab, one patient-scoped call for the drawer's history section. TanStack Query deduplicates and caches both. To prevent performance issues with patients who have thousands of results, the drawer sparkline uses at most the 100 most recent values.

### Section 3.4 — Population Context (Contextual Enrichment)

- "Dataset Population" header
- Diagnoses: "X of Y patients (Z%) have this diagnosis"
- Labs: population mean/median for this test
- Medications: "Prescribed to X% of patients"

**Backend requirement:** Existing dashboard hooks (`useDashboardTopDiagnoses`, `useDashboardDemographics`) return only top-N aggregates and cannot provide per-concept population stats for arbitrary concepts. A new backend endpoint is needed:

```
GET /api/v1/morpheus/dashboard/concept-stats/{concept_id}?dataset=X
```

Returns: `{ patient_count, total_patients, percentage, mean_value?, median_value? }`

For concepts that appear in the top-N dashboard data, the frontend may use cached dashboard data instead of making an additional API call. For concepts not in the top-N, the endpoint is called on drawer open. If the endpoint is unavailable or returns no data, the population context section shows "Population data not available" gracefully.

### Section 3.5 — Actions

- "View in Vocabulary Browser" button → `/vocabulary?concept={omop_concept_id}`
- "View All Occurrences" button → switches to relevant tab with filter

### Keyboard/Accessibility

- Escape closes, Tab cycles within drawer, focus trapped while open

---

## Section 4: Antibiogram Heatmap for Microbiology

### Heatmap Matrix

- Y-axis: organisms (sorted by frequency, most cultured first)
- X-axis: antibiotics (sorted by class: Penicillins, Cephalosporins, Carbapenems, Fluoroquinolones, Aminoglycosides, etc.)
- Cell colors: Sensitive=#22C55E green, Intermediate=#EAB308 yellow, Resistant=#E85A6B red, No data=#1A1A1E
- Cell text: "S", "I", or "R" (color + text, not color alone)
- Hover → tooltip: organism, antibiotic, interpretation, MIC value (dilution_comparison + dilution_value), specimen type, culture date
- Click → ConceptDetailDrawer for the organism concept
- Column headers rotated 45 degrees

### Filters

- Specimen type dropdown — dynamically populated from `spec_type_desc` values in the data (e.g., "BLOOD CULTURE", "URINE", "SPUTUM", "MRSA SCREEN"), not hardcoded
- Admission filter (respects AdmissionPicker)
- "Show only tested combinations" toggle

### Enhanced Culture Table (Below Heatmap)

- Grouped by specimen (collapsible sections)
- Columns: Collection Date, Specimen Type, Organism, Antibiotic Count, S/I/R Summary
- Expandable rows → full sensitivity panel
- Organism names clickable → ConceptDetailDrawer
- Color-coded interpretation badges

### Data Flow

Uses existing `useMorpheusMicrobiology(subjectId, hadmId, dataset)` hook. Frontend pivots flat results into organism x antibiotic matrix. Static lookup maps antibiotic names to drug classes for column ordering.

---

## Section 5: Gold Standard Polish

### 5a. Rich Tooltips

Replace all HTML `title` attributes with hover cards:
- Dark background (#1A1A1E), border (#323238), rounded
- ~200ms hover delay, auto-positioning (flips to avoid viewport overflow)
- Structured content (label + value pairs)
- Applied to: LocationTrack segments, MedicationTimeline bars, all dashboard chart elements

### 5b. Clickable KPIs and Event Counts

- Dashboard MetricCards clickable → navigate to Patient Journey with filter (e.g., "ICU Rate" → `?icu=true`)
- EventCountBar pills clickable → switch to relevant tab
- Visual: `cursor-pointer`, `hover:bg-[domain-color]/10`, subtle scale on hover

### 5c. Grouped Event Cards

- DiagnosisList: same diagnosis across admissions grouped with count badge (x3)
- Expandable → nested table with admission date + sequence number
- Chevron rotation animation

### 5d. Consistent Domain Color System

| Domain | Color | Hex |
|--------|-------|-----|
| Condition/Diagnosis | Red | #E85A6B |
| Drug/Medication | Teal | #2DD4BF |
| Procedure | Gold | #C9A227 |
| Measurement/Lab | Indigo | #818CF8 |
| Observation/Vital | Slate | #94A3B8 |
| Visit/Admission | Amber | #F59E0B |
| Microbiology | Pink | #F472B6 |

Applied consistently across: EventCountBar, tab icons, drawer header, chart legends, table row accents.

**Note:** The domain color system applies to domain-level identifiers (tab icons, drawer borders, EventCountBar pills). Individual vitals within the Vitals Monitor Grid use their own per-vital color scheme (HR=green, BP=red, SpO2=cyan, etc.) which takes precedence over the generic "Observation/Vital = Slate" domain color. The EventCountBar must be updated from its current colors (prescriptions=#22C55E, vitals=#F97316) to match this domain table.

### 5e. Loading, Error, and Empty States

- Loading: centered `Loader2` spinner, `animate-spin text-[#8A857D]`
- Error: centered red message + context ("Patient #X may not exist")
- Empty: `border-dashed border-[#323238] bg-[#151518]` container with descriptive message
- Applied consistently to all tabs and panels

### 5f. Hover Micro-interactions

- Clickable rows: `hover:bg-[#1A1A1E]` + `transition-colors`
- Clickable text: `hover:text-[#C5C0B8]`
- Buttons: opacity/background shift
- Chart bars: opacity 0.7 → 1.0 on hover

### 5g. Focus Indicators

All focusable elements: `focus:outline-none focus:ring-1 focus:ring-[accent-color]/30 focus:border-[accent-color]`

### 5h. Keyboard Navigation

- Arrow Left/Right to pan LocationTrack and MedicationTimeline
- +/- to zoom timelines
- Escape closes ConceptDetailDrawer and hover cards
- Tab cycles through all interactive elements

### 5i. Truncation Warnings

Yellow warning banner at top of tab when API response hits limit: "Showing {loaded} of {total} {domain}. Results capped for performance." Lists affected domains. The `total` count is sourced from the `useMorpheusEventCounts` hook (which returns aggregate counts per domain), while `loaded` is the array length from the domain-specific data hook.

### 5j. CSV Export

Export button on:
- Patient Journey table (patient list)
- Each clinical data tab (diagnoses, medications, labs, vitals, microbiology)
- Exports visible/filtered data as CSV with headers
- **CSV injection prevention:** All cell values are sanitized before export — values starting with `=`, `+`, `-`, `@` are prefixed with a single quote to prevent formula injection (per HIGHSEC security requirements)

### 5k. Search Enhancement

- Dropdown preview panel on patient search input
- Shows: Subject ID (teal mono), gender, age, admission count
- Keyboard nav (arrow keys + Enter)
- Debounced query (300ms)

### 5l. Cross-Module Linking

- ICD codes in diagnosis tables → clickable, opens ConceptDetailDrawer
- OMOP concept IDs → "View in Vocabulary Browser" link in drawer
- Drug names → ConceptDetailDrawer with RxNorm mapping

### 5m. Typography Consistency

- Monospace (`font-mono`): subject IDs, ICD codes, LOINC codes, concept IDs
- Color hierarchy: #F0EDE8 (primary) → #C5C0B8 (secondary) → #8A857D (tertiary) → #5A5650 (disabled) → #2DD4BF (data codes)
- Section headers: `text-sm font-semibold`
- Labels: `text-[10px] uppercase tracking-wider`

---

## New Components Inventory

| Component | File | Purpose |
|-----------|------|---------|
| LabPanelDashboard | `components/LabPanelDashboard.tsx` | Organ-system grouped lab panels with sparklines |
| LabSparkline | `components/LabSparkline.tsx` | Inline SVG sparkline with reference range band |
| LabTimeSeriesChart | `components/LabTimeSeriesChart.tsx` | Zoomable/pannable line chart for lab trends |
| VitalsMonitorGrid | `components/VitalsMonitorGrid.tsx` | 2x3 bedside monitor layout |
| VitalsMonitorCell | `components/VitalsMonitorCell.tsx` | Individual vital sign monitor cell |
| VitalsTimelineChart | `components/VitalsTimelineChart.tsx` | Multi-vital overlay time-series |
| ConceptDetailDrawer | `components/ConceptDetailDrawer.tsx` | Right-side slide-out with dual codes + enrichment |
| AntibiogramHeatmap | `components/AntibiogramHeatmap.tsx` | Organism x antibiotic matrix |
| CultureTable | `components/CultureTable.tsx` | Enhanced grouped culture table |
| HoverCard | `components/HoverCard.tsx` | Reusable rich tooltip component |
| GroupedDiagnosisList | `components/GroupedDiagnosisList.tsx` | Deduplicated diagnosis cards |
| ExportButton | `components/ExportButton.tsx` | CSV export button |
| SearchDropdown | `components/SearchDropdown.tsx` | Enhanced search with preview dropdown |
| TruncationWarning | `components/TruncationWarning.tsx` | Yellow warning banner for capped results |

## Modified Components

| Component | Changes |
|-----------|---------|
| MorpheusLayout | Add keyboard event listeners |
| MetricCard | Add onClick, hover states |
| EventCountBar | Add onClick per pill, domain colors |
| LocationTrack | Replace `title` with HoverCard, add keyboard pan/zoom |
| MedicationTimeline | Replace `title` with HoverCard, add keyboard pan/zoom |
| DiagnosisList | Replace with GroupedDiagnosisList |
| FilterBar | Consistent focus indicators |
| PatientJourneyPage | Wire up new tabs (Labs, Vitals, enhanced Microbiology), drawer state, export |
| MorpheusDashboardPage | Make MetricCards clickable, add HoverCards to all charts |
| DatasetSelector | Focus indicators, typography alignment |
| TrendChart | Add HoverCard on bars, opacity hover effect |
| HorizontalBarChart | Add HoverCard on bars, opacity hover effect |
| DonutChart | Add HoverCard on segments |
| DistributionChart | Add HoverCard on bars |
| AdmissionPicker | Focus indicators, keyboard nav |

## Static Lookup Tables

| File | Purpose |
|------|---------|
| `constants/labPanels.ts` | Lab item label/itemid → organ system panel mapping |
| `constants/vitalTypes.ts` | MIMIC-IV itemid → vital category mapping |
| `constants/antibioticClasses.ts` | Antibiotic name → drug class mapping |
| `constants/domainColors.ts` | Domain → hex color mapping (shared across module) |

## API Dependencies

Existing hooks cover most data needs. Frontend performs:
- Lab grouping by label/itemid (from `useMorpheusLabResults`)
- Vital categorization by itemid (from `useMorpheusVitals`)
- Microbiology pivot to matrix (from `useMorpheusMicrobiology`)
- Event counts for truncation warnings (from `useMorpheusEventCounts`)

### New Backend Endpoint Required

**`GET /api/v1/morpheus/dashboard/concept-stats/{concept_id}?dataset=X`**

Returns population-level statistics for a single concept within the dataset:
```json
{
  "concept_id": 316139,
  "patient_count": 1234,
  "total_patients": 5000,
  "percentage": 24.68,
  "mean_value": 1.2,
  "median_value": 1.1
}
```

Used by the ConceptDetailDrawer's "Population Context" section. `mean_value`/`median_value` are only populated for measurement concepts (labs).

### TypeScript Interface Update Required

`MorpheusMicrobiology` interface in `api.ts` must add:
- `dilution_comparison: string | null`
- `dilution_value: string | null`

These fields are already returned by the backend but not typed in the frontend interface.

## Performance Considerations

- **Lab sparklines:** Patients with 2000+ lab results across dozens of test types could cause frame drops if all sparklines render simultaneously. Sparklines use lazy rendering: only panels that are visible in the viewport render their sparklines (IntersectionObserver). Each sparkline is capped at the 100 most recent data points.
- **ConceptDetailDrawer data fetching:** The drawer fetches patient-wide history (hadmId=undefined) on open. TanStack Query caching prevents redundant calls if the drawer is reopened for the same concept. The population context endpoint (`concept-stats`) is called on drawer open and cached for 60s.
- **React 19 strict mode:** Heavy components (LabPanelDashboard, VitalsMonitorGrid, AntibiogramHeatmap) should be wrapped in React `startTransition` for tab switches to avoid blocking the main thread. Effects in these components must be idempotent (React 19 double-renders in dev).

## Out of Scope

- Real-time data streaming (this is retrospective data review)
- Clinical decision support alerts/rules engine
- FHIR integration within Morpheus (handled by separate FHIR module)
- Custom hotkeys beyond Patient Profiles parity
- Infection timeline (culture-to-treatment temporal correlation — future phase)
