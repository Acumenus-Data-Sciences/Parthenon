# Morpheus v1 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Morpheus population dashboard, workbench shell with internal navigation, and enhanced patient list with smart filters — completing the v1 researcher experience.

**Architecture:** Backend adds a `MorpheusDashboardService` + controller with 8 aggregate endpoints querying `mimiciv.*` on host PG. Frontend adds a `MorpheusLayout` shell (top bar + tabs + breadcrumbs), a `MorpheusDashboardPage` with SVG charts, and enhances the existing `PatientJourneyPage` with operational/clinical filters. Morpheus toolset registry entry flipped from "coming_soon" to "available".

**Tech Stack:** Laravel 11 / PHP 8.4 (backend), React 19 / TypeScript / Tailwind 4 / TanStack Query (frontend), inline SVG charts (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-03-20-morpheus-v1-frontend-design.md`

---

## File Structure

```
# Backend — new files
backend/app/Services/Morpheus/MorpheusDashboardService.php    — 8 aggregate queries
backend/app/Http/Controllers/Api/V1/MorpheusDashboardController.php — 8 endpoints

# Backend — modified files
backend/app/Services/Morpheus/MorpheusPatientService.php      — Add filter params to listPatients
backend/routes/api.php                                         — Add dashboard routes

# Frontend — new files
frontend/src/features/morpheus/components/MorpheusLayout.tsx   — Shell: top bar, tabs, breadcrumbs, Outlet
frontend/src/features/morpheus/components/MetricCard.tsx       — Single KPI card
frontend/src/features/morpheus/components/HorizontalBarChart.tsx — SVG horizontal bars
frontend/src/features/morpheus/components/DistributionChart.tsx — SVG vertical histogram
frontend/src/features/morpheus/components/TrendChart.tsx       — SVG bar + line chart
frontend/src/features/morpheus/components/DonutChart.tsx       — SVG donut/arc
frontend/src/features/morpheus/components/FilterBar.tsx        — Operational + clinical filters
frontend/src/features/morpheus/pages/MorpheusDashboardPage.tsx — Population overview dashboard

# Frontend — modified files
frontend/src/features/morpheus/api.ts                          — Add dashboard hooks + filter types
frontend/src/features/morpheus/pages/PatientJourneyPage.tsx    — Add FilterBar, URL param handling, new columns
frontend/src/features/workbench/toolsets.ts                    — Flip Morpheus to available
frontend/src/components/layout/Sidebar.tsx                     — Remove Patient Journey entry
frontend/src/app/router.tsx                                    — Restructure routes with MorpheusLayout
```

---

### Task 1: Backend Dashboard API

**Files:**
- Create: `backend/app/Services/Morpheus/MorpheusDashboardService.php`
- Create: `backend/app/Http/Controllers/Api/V1/MorpheusDashboardController.php`
- Modify: `backend/routes/api.php`

Build the 8 aggregate dashboard endpoints. All queries use `mimiciv.*` schema-qualified table names on the `inpatient` DB connection.

- [ ] **Step 1: Create MorpheusDashboardService.php**

Create `backend/app/Services/Morpheus/MorpheusDashboardService.php` with these methods:

- `getMetrics()` — Single query with subqueries:
```sql
SELECT
  (SELECT count(DISTINCT subject_id) FROM mimiciv.patients) as total_patients,
  (SELECT count(*) FROM mimiciv.admissions) as total_admissions,
  ROUND((SELECT count(DISTINCT subject_id) FROM mimiciv.icustays)::numeric
    / NULLIF((SELECT count(DISTINCT subject_id) FROM mimiciv.patients), 0) * 100, 1) as icu_admission_rate,
  ROUND((SELECT count(*) FROM mimiciv.admissions WHERE hospital_expire_flag = '1')::numeric
    / NULLIF((SELECT count(*) FROM mimiciv.admissions), 0) * 100, 1) as mortality_rate,
  ROUND((SELECT avg(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0)
    FROM mimiciv.admissions)::numeric, 1) as avg_los_days,
  ROUND((SELECT avg(los::numeric) FROM mimiciv.icustays)::numeric, 1) as avg_icu_los_days
```
- `getTrends()` — Monthly aggregates with computed rate and avg LOS:
```sql
SELECT to_char(admittime::timestamp, 'YYYY-MM') as month,
       count(*) as admissions,
       count(*) FILTER (WHERE hospital_expire_flag = '1') as deaths,
       ROUND(count(*) FILTER (WHERE hospital_expire_flag = '1')::numeric
         / NULLIF(count(*), 0) * 100, 1) as mortality_rate,
       ROUND(avg(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0)::numeric, 1) as avg_los
FROM mimiciv.admissions
GROUP BY month ORDER BY month
```
- `getTopDiagnoses(int $limit = 10)` — Top diagnoses by patient count:
```sql
SELECT d.icd_code, d.icd_version, COALESCE(dd.long_title, '') as description,
       count(DISTINCT d.subject_id) as patient_count
FROM mimiciv.diagnoses_icd d
LEFT JOIN mimiciv.d_icd_diagnoses dd ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version
GROUP BY d.icd_code, d.icd_version, dd.long_title
ORDER BY patient_count DESC LIMIT ?
```
- `getTopProcedures(int $limit = 10)` — Same pattern:
```sql
SELECT p.icd_code, p.icd_version, COALESCE(dp.long_title, '') as description,
       count(DISTINCT p.subject_id) as patient_count
FROM mimiciv.procedures_icd p
LEFT JOIN mimiciv.d_icd_procedures dp ON p.icd_code = dp.icd_code AND p.icd_version = dp.icd_version
GROUP BY p.icd_code, p.icd_version, dp.long_title
ORDER BY patient_count DESC LIMIT ?
```
- `getDemographics()` — Two queries composed in PHP. Gender query:
```sql
SELECT gender, count(*) as count FROM mimiciv.patients GROUP BY gender
```
Age group query:
```sql
SELECT CASE
  WHEN anchor_age::int < 20 THEN '<20'
  WHEN anchor_age::int BETWEEN 20 AND 29 THEN '20-29'
  WHEN anchor_age::int BETWEEN 30 AND 39 THEN '30-39'
  WHEN anchor_age::int BETWEEN 40 AND 49 THEN '40-49'
  WHEN anchor_age::int BETWEEN 50 AND 59 THEN '50-59'
  WHEN anchor_age::int BETWEEN 60 AND 69 THEN '60-69'
  WHEN anchor_age::int BETWEEN 70 AND 79 THEN '70-79'
  WHEN anchor_age::int BETWEEN 80 AND 89 THEN '80-89'
  ELSE '90+' END as range,
  count(*) as count
FROM mimiciv.patients GROUP BY range ORDER BY range
```
PHP composes: `return ['gender' => $genderCounts, 'age_groups' => $ageGroups];`
- `getLosDistribution()` — Bucket admissions by LOS: `CASE WHEN los <= 2 THEN '0-2d' WHEN los <= 5 THEN '3-5d' WHEN los <= 10 THEN '6-10d' WHEN los <= 20 THEN '11-20d' ELSE '20d+' END` where los = `EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0`
- `getIcuUnits()` — From icustays: `SELECT first_careunit as careunit, count(*) as admission_count, avg(los::numeric) as avg_los_days FROM mimiciv.icustays GROUP BY first_careunit ORDER BY admission_count DESC`
- `getMortalityByType()` — `SELECT admission_type, count(*) as total, count(*) FILTER (WHERE hospital_expire_flag = '1') as deaths FROM mimiciv.admissions GROUP BY admission_type ORDER BY total DESC`

All use `DB::connection('inpatient')` and `mimiciv.*` schema-qualified tables.

- [ ] **Step 2: Create MorpheusDashboardController.php**

8 methods, each delegating to the service and returning `response()->json(['data' => $result])`.

- [ ] **Step 3: Add routes to api.php**

Inside the `auth:sanctum` group, add:
```php
Route::prefix('morpheus/dashboard')->group(function () {
    Route::get('/metrics', [MorpheusDashboardController::class, 'metrics']);
    Route::get('/trends', [MorpheusDashboardController::class, 'trends']);
    Route::get('/top-diagnoses', [MorpheusDashboardController::class, 'topDiagnoses']);
    Route::get('/top-procedures', [MorpheusDashboardController::class, 'topProcedures']);
    Route::get('/demographics', [MorpheusDashboardController::class, 'demographics']);
    Route::get('/los-distribution', [MorpheusDashboardController::class, 'losDistribution']);
    Route::get('/icu-units', [MorpheusDashboardController::class, 'icuUnits']);
    Route::get('/mortality-by-type', [MorpheusDashboardController::class, 'mortalityByType']);
});
```

Add the use import at the top of the routes file. Include a TODO comment:
```php
// TODO: Phase H — add permission:morpheus.view middleware per HIGHSEC spec
```

- [ ] **Step 4: Test each endpoint**

```bash
# Get auth token
TOKEN=$(curl -s http://localhost:8082/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@acumenus.net","password":"superuser"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Test each endpoint
curl -s http://localhost:8082/api/v1/morpheus/dashboard/metrics -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s http://localhost:8082/api/v1/morpheus/dashboard/trends -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s http://localhost:8082/api/v1/morpheus/dashboard/top-diagnoses -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s http://localhost:8082/api/v1/morpheus/dashboard/demographics -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s http://localhost:8082/api/v1/morpheus/dashboard/los-distribution -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s http://localhost:8082/api/v1/morpheus/dashboard/icu-units -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s http://localhost:8082/api/v1/morpheus/dashboard/mortality-by-type -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s http://localhost:8082/api/v1/morpheus/dashboard/top-procedures -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Each should return `{ "data": ... }` with non-empty results.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Morpheus/MorpheusDashboardService.php backend/app/Http/Controllers/Api/V1/MorpheusDashboardController.php backend/routes/api.php
git commit -m "feat(morpheus): dashboard API — 8 aggregate endpoints for population overview"
```

---

### Task 2: Enhanced Patient List Backend

**Files:**
- Modify: `backend/app/Services/Morpheus/MorpheusPatientService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/MorpheusPatientController.php`

Add filter parameters and new columns to the existing patient list endpoint.

- [ ] **Step 1: Enhance listPatients in MorpheusPatientService.php**

New method signature: `public function listPatients(int $limit = 100, int $offset = 0, array $filters = []): array`

The `$filters` array accepts keys: `icu`, `deceased`, `admission_type`, `min_los`, `max_los`, `diagnosis`, `sort`, `order`. All are optional.

Replace the existing `listPatients` method with a version that:
- Accepts filter params: `?icu=true&deceased=true&admission_type=EMERGENCY&min_los=5&max_los=20&diagnosis=I10&sort=total_los&order=desc`
- Adds computed columns: total_los_days, longest_icu_los, primary_diagnosis, primary_icd_code, deceased
- Uses parameterized queries for all filters (no string interpolation)
- primary_diagnosis = seq_num='1' from most recent admission (ORDER BY hadm_id DESC)

The SQL will use CTEs:
```sql
WITH patient_base AS (
    SELECT p.subject_id, p.gender, p.anchor_age, p.anchor_year, p.anchor_year_group, p.dod,
           count(DISTINCT a.hadm_id) as admission_count
    FROM mimiciv.patients p
    LEFT JOIN mimiciv.admissions a ON p.subject_id = a.subject_id
    GROUP BY p.subject_id, p.gender, p.anchor_age, p.anchor_year, p.anchor_year_group, p.dod
),
patient_icu AS (
    SELECT subject_id, count(DISTINCT stay_id) as icu_stay_count,
           max(los::numeric) as longest_icu_los
    FROM mimiciv.icustays GROUP BY subject_id
),
patient_los AS (
    SELECT subject_id,
           sum(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0) as total_los_days
    FROM mimiciv.admissions GROUP BY subject_id
),
patient_dx AS (
    SELECT DISTINCT ON (d.subject_id)
           d.subject_id, d.icd_code as primary_icd_code,
           COALESCE(dd.long_title, '') as primary_diagnosis
    FROM mimiciv.diagnoses_icd d
    LEFT JOIN mimiciv.d_icd_diagnoses dd ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version
    WHERE d.seq_num = '1'
    ORDER BY d.subject_id, d.hadm_id::bigint DESC
)
SELECT pb.*, pi.icu_stay_count, pi.longest_icu_los,
       pl.total_los_days, pd.primary_icd_code, pd.primary_diagnosis,
       CASE WHEN pb.dod IS NOT NULL THEN true ELSE false END as deceased
FROM patient_base pb
LEFT JOIN patient_icu pi ON pb.subject_id = pi.subject_id
LEFT JOIN patient_los pl ON pb.subject_id = pl.subject_id
LEFT JOIN patient_dx pd ON pb.subject_id = pd.subject_id
WHERE 1=1
  -- filters appended dynamically with parameterized values
ORDER BY pb.subject_id::int
LIMIT ? OFFSET ?
```

Filter conditions appended with `?` params:
- `icu=true` → `AND pi.icu_stay_count > 0`
- `icu=false` → `AND (pi.icu_stay_count IS NULL OR pi.icu_stay_count = 0)`
- `deceased=true` → `AND pb.dod IS NOT NULL`
- `deceased=false` → `AND pb.dod IS NULL`
- `admission_type=X` → `AND pb.subject_id IN (SELECT subject_id FROM mimiciv.admissions WHERE admission_type = ?)`
- `min_los=N` → `AND pl.total_los_days >= ?`
- `max_los=N` → `AND pl.total_los_days <= ?`
- `diagnosis=X` → `AND pb.subject_id IN (SELECT subject_id FROM mimiciv.diagnoses_icd d LEFT JOIN mimiciv.d_icd_diagnoses dd ON d.icd_code=dd.icd_code AND d.icd_version=dd.icd_version WHERE d.icd_code ILIKE ? OR dd.long_title ILIKE ?)`
- `sort=X&order=Y` → `ORDER BY {validated_column} {validated_direction}`

Sort column whitelist: subject_id, gender, anchor_age, admission_count, icu_stay_count, total_los_days, longest_icu_los, deceased.

- [ ] **Step 2: Update controller to pass filter params**

In `MorpheusPatientController::listPatients`, extract all filter params from the request and pass to the service.

- [ ] **Step 3: Test filters**

```bash
curl -s "http://localhost:8082/api/v1/morpheus/patients?icu=true&limit=5" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
curl -s "http://localhost:8082/api/v1/morpheus/patients?deceased=true" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Deceased: {d[\"total\"]} patients')"
curl -s "http://localhost:8082/api/v1/morpheus/patients?diagnosis=hypertension" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Hypertension: {d[\"total\"]} patients')"
curl -s "http://localhost:8082/api/v1/morpheus/patients?sort=total_los_days&order=desc&limit=5" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/Morpheus/MorpheusPatientService.php backend/app/Http/Controllers/Api/V1/MorpheusPatientController.php
git commit -m "feat(morpheus): enhanced patient list with operational/clinical filters and new columns"
```

---

### Task 3: Frontend API Hooks + Dashboard Types

**Files:**
- Modify: `frontend/src/features/morpheus/api.ts`

Add TanStack Query hooks for all 8 dashboard endpoints and the enhanced patient list filter params.

- [ ] **Step 1: Add dashboard TypeScript interfaces to api.ts**

Add after the existing interfaces:

```typescript
// Dashboard types
export interface DashboardMetrics {
  total_patients: number;
  total_admissions: number;
  icu_admission_rate: number;
  mortality_rate: number;
  avg_los_days: number;
  avg_icu_los_days: number;
}

export interface DashboardTrend {
  month: string;
  admissions: number;
  deaths: number;
  mortality_rate: number;
  avg_los: number;
}

export interface TopDiagnosis {
  icd_code: string;
  icd_version: string;
  description: string;
  patient_count: number;
}

export interface TopProcedure {
  icd_code: string;
  icd_version: string;
  description: string;
  patient_count: number;
}

export interface DemographicBreakdown {
  gender: Record<string, number>;
  age_groups: Array<{ range: string; count: number }>;
}

export interface LosDistribution {
  bucket: string;
  count: number;
}

export interface IcuUnitStats {
  careunit: string;
  admission_count: number;
  avg_los_days: number;
}

export interface MortalityByType {
  admission_type: string;
  total: number;
  deaths: number;
  rate: number;
}

export interface PatientFilters {
  icu?: boolean;
  deceased?: boolean;
  admission_type?: string;
  min_los?: number;
  max_los?: number;
  diagnosis?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}
```

- [ ] **Step 2: Add dashboard query hooks**

```typescript
const DASH = '/api/v1/morpheus/dashboard';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'metrics'],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/metrics`);
      return res.data.data as DashboardMetrics;
    },
  });
}

export function useDashboardTrends() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'trends'],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/trends`);
      return res.data.data as DashboardTrend[];
    },
  });
}

export function useDashboardTopDiagnoses(limit = 10) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'top-diagnoses', limit],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/top-diagnoses?limit=${limit}`);
      return res.data.data as TopDiagnosis[];
    },
  });
}

export function useDashboardTopProcedures(limit = 10) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'top-procedures', limit],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/top-procedures?limit=${limit}`);
      return res.data.data as TopProcedure[];
    },
  });
}

export function useDashboardDemographics() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'demographics'],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/demographics`);
      return res.data.data as DemographicBreakdown;
    },
  });
}

export function useDashboardLosDistribution() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'los-distribution'],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/los-distribution`);
      return res.data.data as LosDistribution[];
    },
  });
}

export function useDashboardIcuUnits() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'icu-units'],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/icu-units`);
      return res.data.data as IcuUnitStats[];
    },
  });
}

export function useDashboardMortalityByType() {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'mortality-by-type'],
    queryFn: async () => {
      const res = await apiClient.get(`${DASH}/mortality-by-type`);
      return res.data.data as MortalityByType[];
    },
  });
}
```

- [ ] **Step 3: Update useMorpheusPatients hook to accept filters**

**IMPORTANT:** Preserve `useMorpheusPatientSearch` unchanged — it is still used by PatientJourneyPage.

Replace the existing `useMorpheusPatients` with:

```typescript
export function useMorpheusPatients(filters: PatientFilters = {}, limit = 100, offset = 0) {
  return useQuery({
    queryKey: ['morpheus', 'patients', filters, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (filters.icu !== undefined) params.set('icu', String(filters.icu));
      if (filters.deceased !== undefined) params.set('deceased', String(filters.deceased));
      if (filters.admission_type) params.set('admission_type', filters.admission_type);
      if (filters.min_los !== undefined) params.set('min_los', String(filters.min_los));
      if (filters.max_los !== undefined) params.set('max_los', String(filters.max_los));
      if (filters.diagnosis) params.set('diagnosis', filters.diagnosis);
      if (filters.sort) params.set('sort', filters.sort);
      if (filters.order) params.set('order', filters.order);
      const res = await apiClient.get(`${BASE}?${params.toString()}`);
      return res.data as { data: MorpheusPatient[]; total: number };
    },
  });
}
```

Update `MorpheusPatient` interface to include new fields:
```typescript
export interface MorpheusPatient {
  subject_id: string;
  gender: string;
  anchor_age: string;
  anchor_year: string;
  anchor_year_group: string;
  dod: string | null;
  admission_count: number;
  icu_stay_count: number;
  total_los_days: number | null;
  longest_icu_los: number | null;
  primary_diagnosis: string | null;
  primary_icd_code: string | null;
  deceased: boolean;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/morpheus/api.ts
git commit -m "feat(morpheus): dashboard API hooks + patient list filter types"
```

---

### Task 4: MorpheusLayout Shell + Route Restructure + Cleanup

**Files:**
- Create: `frontend/src/features/morpheus/components/MorpheusLayout.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/workbench/toolsets.ts`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create MorpheusLayout.tsx**

```tsx
import { Outlet, useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { BedDouble, ArrowLeft } from 'lucide-react';

const TABS = [
  { path: '/morpheus', label: 'Dashboard', exact: true },
  { path: '/morpheus/journey', label: 'Patient Journey', exact: false },
];

export default function MorpheusLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { subjectId } = useParams();

  // Build breadcrumb
  const crumbs: Array<{ label: string; path?: string }> = [{ label: 'Dashboard', path: '/morpheus' }];
  if (location.pathname.startsWith('/morpheus/journey')) {
    crumbs.push({ label: 'Patient Journey', path: '/morpheus/journey' });
    if (subjectId) {
      crumbs.push({ label: `Patient ${subjectId}` });
    }
  }

  // Determine active tab
  const activeTab = location.pathname === '/morpheus' ? '/morpheus'
    : location.pathname.startsWith('/morpheus/journey') ? '/morpheus/journey'
    : '/morpheus';

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-800 bg-[#0E0E11] px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: icon + title + breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9B1B30]/15">
              <BedDouble className="h-4 w-4 text-[#9B1B30]" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-100">Morpheus</span>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="text-gray-600">/</span>
                  {c.path ? (
                    <Link to={c.path} className="text-gray-400 hover:text-gray-200 transition-colors">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-gray-300">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Center: tabs */}
          <div className="flex items-center gap-1">
            {TABS.map(({ path, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === path
                    ? 'bg-[#1A1A2E] text-[#2DD4BF]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right: back to workbench */}
          <Link
            to="/workbench"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Workbench
          </Link>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Restructure routes in router.tsx**

Replace the existing morpheus route block (lines 402-424) with:

```typescript
      {
        path: "morpheus",
        lazy: () =>
          import("@/features/morpheus/components/MorpheusLayout").then((m) => ({
            Component: m.default,
          })),
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/morpheus/pages/MorpheusDashboardPage").then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: "journey",
            lazy: () =>
              import("@/features/morpheus/pages/PatientJourneyPage").then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: "journey/:subjectId",
            lazy: () =>
              import("@/features/morpheus/pages/PatientJourneyPage").then((m) => ({
                Component: m.default,
              })),
          },
        ],
      },
```

- [ ] **Step 3: Flip toolset registry**

In `frontend/src/features/workbench/toolsets.ts`, change the Morpheus entry:
- `status: "coming_soon"` → `status: "available"`
- `route: null` → `route: "/morpheus"`

- [ ] **Step 4: Remove sidebar entry**

In `frontend/src/components/layout/Sidebar.tsx`, remove line 114:
```
{ path: "/morpheus/journey", label: "Patient Journey", icon: Activity },
```

- [ ] **Step 5: Create placeholder MorpheusDashboardPage.tsx**

Create `frontend/src/features/morpheus/pages/MorpheusDashboardPage.tsx` with a minimal placeholder so the routes compile:

```tsx
export default function MorpheusDashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-100">Morpheus Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">Population overview — building...</p>
    </div>
  );
}
```

- [ ] **Step 6: Remove inline headers from PatientJourneyPage, keep compact patient info bar**

The MorpheusLayout now handles navigation/breadcrumbs. Remove:
- Browse mode: the header div with "Morpheus — Patient Journey" h1 and subtitle
- Detail mode: the header div with "← Back" button

Keep: In detail mode, add a compact patient info bar below the MorpheusLayout top bar (above EventCountBar). This preserves demographic context that the breadcrumb doesn't carry:

```tsx
{patient && (
  <div className="flex items-center gap-3 text-sm">
    <span className="font-semibold text-gray-100">Patient {subjectId}</span>
    <span className="text-gray-500">|</span>
    <span className="text-gray-300">{patient.gender === 'M' ? 'Male' : 'Female'}</span>
    <span className="text-gray-500">|</span>
    <span className="text-gray-300">Age {patient.anchor_age}</span>
    {patient.dod && (
      <>
        <span className="text-gray-500">|</span>
        <span className="text-[#E85A6B]">Deceased</span>
      </>
    )}
    <span className="text-gray-500">|</span>
    <span className="text-gray-400">{patient.admission_count} admissions, {patient.icu_stay_count ?? 0} ICU stays</span>
  </div>
)}
```

- [ ] **Step 7: Verify frontend compiles and Workbench card is clickable**

```bash
cd frontend && npx tsc --noEmit
```

Then visit http://localhost:5175/workbench — Morpheus card should show green "Available" and be clickable.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/morpheus/components/MorpheusLayout.tsx frontend/src/features/morpheus/pages/MorpheusDashboardPage.tsx frontend/src/features/morpheus/pages/PatientJourneyPage.tsx frontend/src/app/router.tsx frontend/src/features/workbench/toolsets.ts frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(morpheus): workbench shell with top bar, tabs, breadcrumbs — Morpheus now launchable"
```

---

### Task 5: SVG Chart Components

**Files:**
- Create: `frontend/src/features/morpheus/components/MetricCard.tsx`
- Create: `frontend/src/features/morpheus/components/HorizontalBarChart.tsx`
- Create: `frontend/src/features/morpheus/components/DistributionChart.tsx`
- Create: `frontend/src/features/morpheus/components/TrendChart.tsx`
- Create: `frontend/src/features/morpheus/components/DonutChart.tsx`

Build 5 reusable SVG chart components. Each is self-contained with props interface, no external dependencies.

- [ ] **Step 1: Create MetricCard.tsx**

Simple KPI display card. Props: `{ label: string; value: string | number; subtext?: string; color?: string; icon?: React.ReactNode }`. Renders: large value, label below, optional subtext, accent-colored left border.

- [ ] **Step 2: Create HorizontalBarChart.tsx**

Reusable for top diagnoses, procedures, ICU units. Props: `{ data: Array<{ label: string; value: number; sublabel?: string }>; maxItems?: number; barColor?: string; title?: string }`. SVG with text labels on left, horizontal bars on right, value at bar end. Auto-scales to max value.

- [ ] **Step 3: Create DistributionChart.tsx**

Vertical histogram for age and LOS distributions. Props: `{ data: Array<{ label: string; value: number }>; barColor?: string; title?: string }`. SVG vertical bars with x-axis labels below.

- [ ] **Step 4: Create TrendChart.tsx**

Combined bar + line chart for trends. Props: `{ data: Array<{ label: string; barValue: number; lineValue?: number }>; barColor?: string; lineColor?: string; title?: string; barLabel?: string; lineLabel?: string }`. SVG with bars for admission volume, optional line overlay for mortality rate. X-axis: month labels (rotated if needed). Dual Y-axes (left for bars, right for line).

- [ ] **Step 5: Create DonutChart.tsx**

Gender distribution. Props: `{ data: Array<{ label: string; value: number; color: string }>; title?: string; size?: number }`. SVG donut using arc paths. Legend below with labels, counts, percentages.

- [ ] **Step 6: Verify all components compile**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/morpheus/components/MetricCard.tsx frontend/src/features/morpheus/components/HorizontalBarChart.tsx frontend/src/features/morpheus/components/DistributionChart.tsx frontend/src/features/morpheus/components/TrendChart.tsx frontend/src/features/morpheus/components/DonutChart.tsx
git commit -m "feat(morpheus): 5 SVG chart components — metric card, horizontal bar, distribution, trend, donut"
```

---

### Task 6: Dashboard Page + Enhanced Patient List

**Files:**
- Modify: `frontend/src/features/morpheus/pages/MorpheusDashboardPage.tsx` (replace placeholder)
- Create: `frontend/src/features/morpheus/components/FilterBar.tsx`
- Modify: `frontend/src/features/morpheus/pages/PatientJourneyPage.tsx` (add filters + new columns)

- [ ] **Step 1: Build MorpheusDashboardPage.tsx**

Full dashboard page using all chart components and dashboard hooks. Layout:

```
┌──────────────────────────────────────────────────────────────────┐
│ Headline Metrics (6 MetricCards in a row)                        │
├───────────────────────────────┬──────────────────────────────────┤
│ Admission Volume by Month     │ Mortality Rate by Month          │
│ (TrendChart bars)             │ (TrendChart line)                │
├───────────────────────────────┬──────────────────────────────────┤
│ Top 10 Diagnoses              │ Top 10 Procedures                │
│ (HorizontalBarChart)          │ (HorizontalBarChart)             │
├───────────────────────────────┬──────────────────────────────────┤
│ Gender Distribution           │ Age Distribution                 │
│ (DonutChart)                  │ (DistributionChart)              │
├───────────────────────────────┬──────────────────────────────────┤
│ LOS Distribution              │ Mortality by Admission Type      │
│ (DistributionChart)           │ (HorizontalBarChart)             │
├──────────────────────────────────────────────────────────────────┤
│ ICU Utilization by Unit (HorizontalBarChart, full width)         │
├──────────────────────────────────────────────────────────────────┤
│ Quick Actions: Browse All │ ICU Only │ Deceased                  │
└──────────────────────────────────────────────────────────────────┘
```

Each section is wrapped in a card div (`bg-[#1A1A2E] border border-gray-800 rounded-lg p-4`). Loading states show a subtle shimmer placeholder per section. Error states show "Failed to load" with the section title.

Quick action buttons use `navigate('/morpheus/journey?icu=true')` etc.

- [ ] **Step 2: Create FilterBar.tsx**

Filter bar component for the patient list. Props: `{ filters: PatientFilters; onChange: (filters: PatientFilters) => void }`.

Layout:
- Primary row: ICU toggle (All/Yes/No), Mortality toggle (All/Survived/Deceased), Admission Type pills (All/Emergency/Elective/Urgent/Surgical), LOS min/max number inputs
- Secondary row (collapsed by default, "Clinical Filters" toggle): diagnosis text input with debounce
- Active filter count badge
- "Clear All" button

- [ ] **Step 3: Enhance PatientJourneyPage browse mode**

In the browse mode (no subjectId):
- Read URL search params on mount: `const [searchParams] = useSearchParams()`. Parse `icu`, `deceased`, `admission_type` from URL.
- Add `FilterBar` component above the table
- Pass filters to `useMorpheusPatients(filters)`
- Add new table columns: Total LOS, Longest ICU, Primary Dx, Deceased
- Make columns sortable (click header → update filters.sort/order)
- Show "Showing X of Y patients" count

- [ ] **Step 4: Verify full flow**

1. Visit `/workbench` → click Morpheus → see dashboard with real data
2. Click "View ICU Patients Only" quick action → navigate to patient list with ICU filter applied
3. Apply filters → table updates
4. Click a patient → see journey detail
5. Breadcrumbs update correctly at each level

- [ ] **Step 5: Build production frontend**

```bash
./deploy.sh --frontend
```

Verify build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/morpheus/pages/MorpheusDashboardPage.tsx frontend/src/features/morpheus/components/FilterBar.tsx frontend/src/features/morpheus/pages/PatientJourneyPage.tsx
git commit -m "feat(morpheus): population dashboard + smart filtered patient list — v1 complete"
```

---

## Completion Criteria

Morpheus v1 frontend is complete when:
- [ ] Workbench launcher shows Morpheus as "Available" with working link
- [ ] `/morpheus` shows population dashboard with 6 metric cards, 2 trend charts, 2 top lists, 4 breakdowns, ICU utilization, 3 quick actions
- [ ] All dashboard charts render with real MIMIC-IV data (100 patients)
- [ ] `/morpheus/journey` shows patient list with operational filters (ICU, mortality, admission type, LOS) and clinical filter (diagnosis search)
- [ ] Filters compose correctly and update URL params
- [ ] Dashboard quick actions navigate to pre-filtered patient list
- [ ] `/morpheus/journey/:id` still works with full patient detail view
- [ ] MorpheusLayout shell shows top bar with tabs + breadcrumbs + "Back to Workbench"
- [ ] Sidebar no longer has "Patient Journey" entry
- [ ] Production build succeeds via `deploy.sh --frontend`
