# Morpheus v1 Frontend — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Author:** Dr. Sanjay Udoshi + Claude
**Module:** Morpheus Workbench Frontend

---

## 1. Problem Statement

Morpheus has a Patient Journey page but no landing experience. An inpatient outcomes researcher launching Morpheus from the Workbench has no population-level situational awareness — they're dropped straight into a patient list with no context about the dataset's size, acuity, or clinical profile. The patient list also lacks filters, making it hard to find relevant cases.

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Navigation model | Workbench toolset, not sidebar | Morpheus is a standalone workbench app launched from `/workbench` |
| Landing page | Population dashboard | Researcher needs dataset overview before drilling into patients |
| Dashboard priority | Metrics → Trends → Breakdowns | Hospital-wide numbers first, temporal patterns second, subgroup variation third |
| Patient list priority | Operational filters first | LOS, ICU, mortality, admission type are the fastest inpatient segmentation |
| Internal nav | Top bar with tabs + breadcrumbs | Lightweight shell, not sidebar — two pages only |

## 3. Page Structure

```
/workbench                    → Workbench Launcher (existing)
  └─ Click Morpheus card      → /morpheus

/morpheus                     → MorpheusLayout (shell with top bar)
  ├─ /morpheus                → MorpheusDashboardPage (index)
  ├─ /morpheus/journey        → PatientJourneyPage (enhanced list)
  └─ /morpheus/journey/:id    → PatientJourneyPage (patient detail)
```

## 4. MorpheusLayout — Workbench Shell

Shared layout wrapping all Morpheus pages. Renders inside MainLayout (auth, sidebar still visible but Morpheus content fills the main area).

**Top bar contents:**
- Left: BedDouble icon + "Morpheus" title + breadcrumb trail (Dashboard / Patient Journey / Patient 10018328)
- Center: Tab navigation — **Dashboard** | **Patient Journey**
- Right: "Back to Workbench" link → `/workbench`

**Implementation:** `features/morpheus/components/MorpheusLayout.tsx` using `<Outlet />` for child routes. Registered as a nested route wrapper in `router.tsx`.

## 5. Dashboard Page (`/morpheus`)

### 5.1 Headline Metrics Row

Single horizontal row of 6-7 metric cards (scrollable on mobile):

| Metric | Computation | Format |
|--------|-------------|--------|
| Total Patients | `count(DISTINCT subject_id) FROM patients` | Integer |
| Total Admissions | `count(*) FROM admissions` | Integer |
| ICU Admission Rate | `count(DISTINCT subject_id) FROM icustays / total patients * 100` | Percentage |
| In-Hospital Mortality | `count(*) WHERE hospital_expire_flag='1' / total admissions * 100` | Percentage |
| Avg LOS | `avg(dischtime - admittime) FROM admissions` | Days (1 decimal) |
| Avg ICU LOS | `avg(los) FROM icustays` | Days (1 decimal) |

### 5.2 Trend Charts (2-column grid)

**Left: Admission Volume by Month** — Vertical bar chart. X-axis: month/year. Y-axis: admission count. Shows temporal patterns in the dataset.

**Right: Mortality Rate by Month** — Line chart. X-axis: month/year. Y-axis: mortality rate (%). Trend line shows whether mortality is stable, improving, or worsening.

Chart library: SVG-based inline charts (same pattern as PatientLabPanel sparklines) or a lightweight charting approach consistent with Parthenon's existing patterns. No new chart library dependencies.

### 5.3 Top Lists (2-column grid)

**Left: Top 10 Diagnoses** — Horizontal bar chart. Each bar: ICD code (gold monospace) + description + count. Sorted by frequency descending.

**Right: Top 10 Procedures** — Same format.

### 5.4 Demographic Breakdowns (2-column grid)

**Left: Gender Distribution** — Donut chart or horizontal stacked bar (M/F counts and percentages).

**Right: Age Distribution** — Histogram by decade (20s, 30s, 40s, 50s, 60s, 70s, 80s, 90+). Bars colored by theme.

### 5.5 Operational Breakdowns (2-column grid)

**Left: LOS Distribution** — Histogram with buckets: 0-2d, 3-5d, 6-10d, 11-20d, 20d+.

**Right: Mortality by Admission Type** — Grouped bar chart: Emergency / Elective / Urgent / Surgical. Each group shows total admissions + deaths + rate.

### 5.6 ICU Breakdown (full width)

**ICU Utilization by Unit** — Horizontal bar chart showing admission count per care unit (MICU, SICU, CCU, TSICU, Neuro Stepdown, etc.). Sorted by count. Bar color: crimson (#9B1B30) for ICU units, teal for step-down.

### 5.7 Quick Actions (bottom)

Three link buttons that navigate to the patient list with pre-applied filters:
- "Browse All Patients" → `/morpheus/journey`
- "View ICU Patients Only" → `/morpheus/journey?icu=true`
- "View Deceased Patients" → `/morpheus/journey?deceased=true`

## 6. Enhanced Patient List (`/morpheus/journey`)

### 6.1 Filter Bar

**Primary row (always visible):**

| Filter | Type | Options |
|--------|------|---------|
| LOS Range | Range slider | 0–60 days |
| ICU Stay | Toggle buttons | All / Yes / No |
| Mortality | Toggle buttons | All / Survived / Deceased |
| Admission Type | Pill buttons | All / Emergency / Elective / Urgent / Surgical |

**Secondary row (collapsed, expand via "Clinical Filters" toggle):**

| Filter | Type | Behavior |
|--------|------|----------|
| Diagnosis Search | Text input | Searches ICD code or description in `diagnoses_icd` + `d_icd_diagnoses`. Returns patients who have that diagnosis in any admission. |

Filters compose: ICU=Yes + Mortality=Deceased shows deceased ICU patients.

URL query params (`?icu=true&deceased=true&admission_type=EMERGENCY`) enable dashboard quick actions to pre-populate filters.

### 6.2 Table Enhancements

New columns added to existing patient table:

| Column | Source | Sortable |
|--------|--------|----------|
| Subject ID | patients.subject_id | Yes |
| Gender | patients.gender | Yes |
| Age (anchor) | patients.anchor_age | Yes |
| Admissions | count(admissions) | Yes |
| ICU Stays | count(icustays) | Yes |
| Total LOS | sum(los_days) across admissions | Yes |
| Longest ICU | max(los) from icustays | Yes |
| Primary Dx | first diagnosis by seq_num=1 | No |
| Deceased | patients.dod IS NOT NULL | Yes |

Row count indicator: "Showing 47 of 100 patients" updates as filters change.

### 6.3 Existing Search

Subject ID search input stays as-is. Composes with filters.

## 7. Patient Journey Detail (Existing)

No changes to the patient detail view in this iteration. Already has 6 tabs:
- Journey (location track, medication timeline, diagnosis preview, admission summary)
- Diagnoses (full ICD table with OMOP mapping)
- Medications (top 20 drug timeline)
- Labs (placeholder — data loaded, chart view deferred)
- Vitals (placeholder — data loaded, chart view deferred)
- Microbiology (full table with S/I/R)

Labs and vitals chart visualizations are deferred to v1.1.

## 8. Backend API

### 8.1 New Dashboard Endpoints

All under `GET /api/v1/morpheus/dashboard/` with `auth:sanctum` middleware.

**`GET /dashboard/metrics`**
Returns headline KPIs as a single JSON object:
```json
{
  "total_patients": 100,
  "total_admissions": 275,
  "icu_admission_rate": 56.0,
  "mortality_rate": 8.7,
  "avg_los_days": 6.2,
  "avg_icu_los_days": 3.8
}
```

**`GET /dashboard/trends`**
Returns monthly aggregates:
```json
[
  { "month": "2150-01", "admissions": 12, "deaths": 1, "mortality_rate": 8.3, "avg_los": 5.4 },
  ...
]
```

**`GET /dashboard/top-diagnoses?limit=10`**
```json
[
  { "icd_code": "I10", "icd_version": "10", "description": "Essential hypertension", "patient_count": 42 },
  ...
]
```

**`GET /dashboard/top-procedures?limit=10`**
Same structure as diagnoses.

**`GET /dashboard/demographics`**
```json
{
  "gender": { "M": 55, "F": 45 },
  "age_groups": [
    { "range": "20-29", "count": 5 },
    { "range": "30-39", "count": 8 },
    ...
  ]
}
```

**`GET /dashboard/los-distribution`**
```json
[
  { "bucket": "0-2d", "count": 45 },
  { "bucket": "3-5d", "count": 82 },
  { "bucket": "6-10d", "count": 65 },
  { "bucket": "11-20d", "count": 52 },
  { "bucket": "20d+", "count": 31 }
]
```

**`GET /dashboard/icu-units`**
```json
[
  { "careunit": "Medical Intensive Care Unit (MICU)", "admission_count": 45, "avg_los_days": 4.2 },
  ...
]
```

**`GET /dashboard/mortality-by-type`**
```json
[
  { "admission_type": "EMERGENCY", "total": 180, "deaths": 20, "rate": 11.1 },
  { "admission_type": "ELECTIVE", "total": 50, "deaths": 1, "rate": 2.0 },
  ...
]
```

### 8.2 Enhanced Patient List Endpoint

The existing `GET /api/v1/morpheus/patients` gets optional query parameters:

| Param | Type | Effect |
|-------|------|--------|
| `icu` | boolean | Filter to patients with (true) or without (false) ICU stays |
| `deceased` | boolean | Filter to patients who died (true) or survived (false) |
| `admission_type` | string | Filter to patients with at least one admission of this type |
| `min_los` | number | Minimum total LOS in days (sum across admissions) |
| `max_los` | number | Maximum total LOS in days |
| `diagnosis` | string | ICD code or description substring match |
| `sort` | string | Column to sort by (subject_id, gender, anchor_age, admission_count, icu_stay_count, total_los, deceased) |
| `order` | string | asc or desc |

The response adds new fields per patient:
```json
{
  "subject_id": "10018328",
  "gender": "M",
  "anchor_age": "65",
  "admission_count": 4,
  "icu_stay_count": 2,
  "total_los_days": 22.5,
  "longest_icu_los": 7.7,
  "primary_diagnosis": "Essential hypertension",
  "primary_icd_code": "I10",
  "deceased": true
}
```

## 9. Cleanup Tasks

1. **Toolset Registry:** Change Morpheus entry in `features/workbench/toolsets.ts` from `status: "coming_soon", route: null` to `status: "available", route: "/morpheus"`
2. **Remove Sidebar Entry:** Remove "Patient Journey" from `components/layout/Sidebar.tsx` (it was added in the Clinical group)
3. **Route Restructure:** Wrap `/morpheus` routes in `MorpheusLayout` as nested routes

## 10. File Structure

```
frontend/src/features/morpheus/
├── api.ts                              — (existing) Add dashboard query hooks
├── components/
│   ├── MorpheusLayout.tsx              — NEW: Shell with top bar, tabs, breadcrumbs
│   ├── MetricCard.tsx                  — NEW: Single KPI card
│   ├── TrendChart.tsx                  — NEW: SVG bar/line chart for monthly trends
│   ├── HorizontalBarChart.tsx          — NEW: Reusable horizontal bar (diagnoses, procedures, ICU units)
│   ├── DistributionChart.tsx           — NEW: Histogram (age, LOS)
│   ├── DonutChart.tsx                  — NEW: Gender distribution
│   ├── FilterBar.tsx                   — NEW: Operational + clinical filters
│   ├── LocationTrack.tsx               — (existing)
│   ├── AdmissionPicker.tsx             — (existing)
│   ├── EventCountBar.tsx               — (existing)
│   ├── DiagnosisList.tsx               — (existing)
│   └── MedicationTimeline.tsx          — (existing)
├── pages/
│   ├── MorpheusDashboardPage.tsx       — NEW: Population overview dashboard
│   └── PatientJourneyPage.tsx          — (existing) Enhanced with filters

backend/app/
├── Http/Controllers/Api/V1/
│   └── MorpheusDashboardController.php — NEW: 8 dashboard endpoints
├── Services/Morpheus/
│   ├── MorpheusPatientService.php      — (existing) Enhanced with filter params
│   └── MorpheusDashboardService.php    — NEW: Aggregate queries
```

## 11. Theme Adherence

All new components follow the dark clinical theme:
- Background: `#0E0E11` (page), `#1A1A2E` (cards)
- Borders: `border-gray-800`
- Text: `text-gray-100` (headers), `text-gray-300` (body), `text-gray-500` (labels)
- Accent colors: `#2DD4BF` teal (primary), `#9B1B30` crimson (ICU/critical), `#C9A227` gold (codes), `#E85A6B` (alerts)
- Charts: SVG-based, inline, matching existing sparkline patterns in PatientLabPanel

No new npm dependencies. Charts built with raw SVG (same approach as existing PatientTimeline and PatientLabPanel sparklines).

## 12. Implementation Notes

### 12.1 TypeScript Interfaces for Dashboard API

All dashboard hooks follow the `useMorpheus{Domain}` naming convention. Interfaces:

```typescript
interface DashboardMetrics {
  total_patients: number;
  total_admissions: number;
  icu_admission_rate: number;
  mortality_rate: number;
  avg_los_days: number;
  avg_icu_los_days: number;
}

interface DashboardTrend {
  month: string;
  admissions: number;
  deaths: number;
  mortality_rate: number;
  avg_los: number;
}

interface TopDiagnosis {
  icd_code: string;
  icd_version: string;
  description: string;
  patient_count: number;
}

interface DemographicBreakdown {
  gender: Record<string, number>;
  age_groups: Array<{ range: string; count: number }>;
}

interface LosDistribution {
  bucket: string;
  count: number;
}

interface IcuUnitStats {
  careunit: string;
  admission_count: number;
  avg_los_days: number;
}

interface MortalityByType {
  admission_type: string;
  total: number;
  deaths: number;
  rate: number;
}
```

### 12.2 Schema Qualification

All dashboard SQL queries MUST use `mimiciv.*` schema-qualified table names (e.g., `mimiciv.admissions`, not bare `admissions`). The `inpatient` DB connection search_path does NOT include `mimiciv`. This matches the existing `MorpheusPatientService` pattern.

### 12.3 Primary Diagnosis Ambiguity

For multi-admission patients, `primary_diagnosis` uses the **most recent admission's** seq_num=1 diagnosis. SQL: `WHERE seq_num = '1' ORDER BY hadm_id DESC LIMIT 1` per patient.

### 12.4 SVG Chart Phasing

Implement charts in order of complexity:
1. MetricCard (text only, trivial)
2. HorizontalBarChart (top diagnoses, procedures, ICU units — simple SVG rects)
3. DistributionChart (age, LOS histograms — vertical bars)
4. DonutChart (gender — SVG circle + arc path)
5. TrendChart bar variant (admission volume — vertical bars with x-axis labels)
6. TrendChart line variant (mortality rate — SVG polyline/path)

Grouped bar chart (mortality by admission type) can be simplified to a table with inline bars if SVG complexity is too high for v1.

### 12.5 LOS Filter

Use two number inputs (Min LOS / Max LOS) rather than a dual-thumb range slider to avoid custom component complexity. Simple `<input type="number">` with step=1.

### 12.6 Loading States

Each dashboard section renders independently via its own TanStack Query hook. Loading state: shimmer/skeleton placeholder matching the card dimensions. Error state: card shows "Failed to load" with retry button. Partial failure (some endpoints succeed, others fail) is handled naturally by independent queries — working sections render while failed sections show error state.

### 12.7 HIGHSEC Note

Morpheus routes currently use `auth:sanctum` only, without `permission:` middleware. This is acceptable for v1 (MIMIC-IV demo data is de-identified, no PHI). A security pass to add `permission:morpheus.view` middleware is deferred to Phase H (Production Hardening) per the architecture spec.
