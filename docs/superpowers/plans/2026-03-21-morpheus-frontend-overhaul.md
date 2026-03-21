# Morpheus Frontend Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Morpheus inpatient module to exceed the Patient Profiles gold standard — add clinical monitoring dashboard (labs/vitals), antibiogram heatmap, concept detail drawer, and comprehensive polish.

**Architecture:** 14 new components + 15 modified components + 4 constant files + 1 new backend endpoint. All new frontend components are pure SVG (no chart library). Backend uses existing MorpheusDashboardService patterns with caching and materialized view fallback. ConceptDetailDrawer is the primary interaction pattern for deep inspection.

**Tech Stack:** React 19, TypeScript strict, Tailwind 4, TanStack Query, pure SVG, Laravel 11/PHP 8.4

**Spec:** `docs/superpowers/specs/2026-03-21-morpheus-frontend-overhaul-design.md`

**Key reference files (gold standard patterns to port):**
- `frontend/src/features/profiles/components/ConceptDetailDrawer.tsx` — drawer pattern
- `frontend/src/features/profiles/components/PatientLabPanel.tsx` — sparkline + lab grouping
- `frontend/src/features/profiles/types/profile.ts` — ClinicalEvent type

---

## Phase 1: Foundation (Constants, Shared Components, API Updates)

These are dependency-free building blocks used by everything else.

### Task 1: Domain Colors Constant

**Files:**
- Create: `frontend/src/features/morpheus/constants/domainColors.ts`

- [ ] **Step 1: Create the constants file**

```typescript
// frontend/src/features/morpheus/constants/domainColors.ts

export const DOMAIN_COLORS = {
  condition: '#E85A6B',
  diagnosis: '#E85A6B',
  drug: '#2DD4BF',
  medication: '#2DD4BF',
  procedure: '#C9A227',
  measurement: '#818CF8',
  lab: '#818CF8',
  observation: '#94A3B8',
  vital: '#94A3B8',
  visit: '#F59E0B',
  admission: '#F59E0B',
  microbiology: '#F472B6',
} as const;

export type ClinicalDomain = keyof typeof DOMAIN_COLORS;

export const DOMAIN_LABELS: Record<string, string> = {
  condition: 'Condition',
  diagnosis: 'Diagnosis',
  drug: 'Drug',
  medication: 'Medication',
  procedure: 'Procedure',
  measurement: 'Measurement',
  lab: 'Lab',
  observation: 'Observation',
  vital: 'Vital',
  visit: 'Visit',
  admission: 'Admission',
  microbiology: 'Microbiology',
};

/** Vital-specific colors for the bedside monitor grid (override domain-level slate) */
export const VITAL_COLORS = {
  heart_rate: '#22C55E',
  blood_pressure: '#E85A6B',
  spo2: '#2DD4BF',
  respiratory_rate: '#C9A227',
  temperature: '#818CF8',
  gcs: '#94A3B8',
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to domainColors.ts

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/constants/domainColors.ts
git commit -m "feat(morpheus): add domain colors and vital colors constants"
```

---

### Task 2: Lab Panels Constant

**Files:**
- Create: `frontend/src/features/morpheus/constants/labPanels.ts`

- [ ] **Step 1: Create the lab panels lookup**

```typescript
// frontend/src/features/morpheus/constants/labPanels.ts

export interface LabPanelConfig {
  name: string;
  color: string;
  tests: string[]; // Match against MorpheusLabResult.label (case-insensitive)
}

export const LAB_PANELS: LabPanelConfig[] = [
  {
    name: 'Renal',
    color: '#3B82F6',
    tests: [
      'creatinine', 'urea nitrogen', 'potassium', 'sodium', 'chloride',
      'bicarbonate', 'calcium, total', 'phosphate', 'magnesium',
    ],
  },
  {
    name: 'Hepatic',
    color: '#F59E0B',
    tests: [
      'alanine aminotransferase', 'asparate aminotransferase',
      'alkaline phosphatase', 'bilirubin, total', 'bilirubin, direct',
      'albumin', 'total protein',
    ],
  },
  {
    name: 'Hematologic',
    color: '#E85A6B',
    tests: [
      'white blood cells', 'hemoglobin', 'hematocrit', 'platelet count',
      'red blood cells', 'mcv', 'mch', 'mchc', 'rdw',
    ],
  },
  {
    name: 'Metabolic',
    color: '#22C55E',
    tests: [
      'glucose', 'lactate', 'anion gap',
    ],
  },
  {
    name: 'Coagulation',
    color: '#A855F7',
    tests: [
      'pt', 'inr(pt)', 'ptt', 'fibrinogen', 'd-dimer',
    ],
  },
  {
    name: 'Cardiac',
    color: '#EC4899',
    tests: [
      'troponin t', 'troponin i', 'ck (cpk)', 'ck-mb', 'ldh',
      'ntprobnp', 'bnp',
    ],
  },
  {
    name: 'Inflammatory',
    color: '#F97316',
    tests: [
      'c-reactive protein', 'procalcitonin', 'ferritin',
    ],
  },
];

/**
 * Map a lab label to its panel. Returns undefined if not in any panel.
 * Comparison is case-insensitive.
 */
export function findLabPanel(label: string): LabPanelConfig | undefined {
  const lower = label.toLowerCase();
  return LAB_PANELS.find((panel) => panel.tests.some((t) => lower.includes(t)));
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/constants/labPanels.ts
git commit -m "feat(morpheus): add lab panel organ system lookup table"
```

---

### Task 3: Vital Types Constant

**Files:**
- Create: `frontend/src/features/morpheus/constants/vitalTypes.ts`

- [ ] **Step 1: Create the vital types lookup**

```typescript
// frontend/src/features/morpheus/constants/vitalTypes.ts

export type VitalCategory = 'heart_rate' | 'blood_pressure_systolic' | 'blood_pressure_diastolic'
  | 'blood_pressure_mean' | 'spo2' | 'respiratory_rate' | 'temperature' | 'gcs' | 'pain';

export interface VitalTypeConfig {
  category: VitalCategory;
  label: string;
  unit: string;
  normalRange: [number, number];
  criticalRange: [number, number];
}

/**
 * Map MIMIC-IV chartevents labels to vital categories.
 * MorpheusVital uses `label` field from d_items, not raw itemid.
 */
export const VITAL_LABEL_MAP: Record<string, VitalCategory> = {
  'heart rate': 'heart_rate',
  'respiratory rate': 'respiratory_rate',
  'o2 saturation pulseoxymetry': 'spo2',
  'spo2': 'spo2',
  'non invasive blood pressure systolic': 'blood_pressure_systolic',
  'arterial blood pressure systolic': 'blood_pressure_systolic',
  'non invasive blood pressure diastolic': 'blood_pressure_diastolic',
  'arterial blood pressure diastolic': 'blood_pressure_diastolic',
  'non invasive blood pressure mean': 'blood_pressure_mean',
  'arterial blood pressure mean': 'blood_pressure_mean',
  'temperature fahrenheit': 'temperature',
  'temperature celsius': 'temperature',
  'gcs - verbal response': 'gcs',
  'gcs - motor response': 'gcs',
  'gcs - eye opening': 'gcs',
  'gcs total': 'gcs',
  'pain level': 'pain',
  'pain level (rest)': 'pain',
};

export const VITAL_TYPE_CONFIGS: Record<string, VitalTypeConfig> = {
  heart_rate: { category: 'heart_rate', label: 'Heart Rate', unit: 'bpm', normalRange: [60, 100], criticalRange: [40, 150] },
  blood_pressure_systolic: { category: 'blood_pressure_systolic', label: 'BP Systolic', unit: 'mmHg', normalRange: [90, 140], criticalRange: [70, 180] },
  blood_pressure_diastolic: { category: 'blood_pressure_diastolic', label: 'BP Diastolic', unit: 'mmHg', normalRange: [60, 90], criticalRange: [40, 120] },
  blood_pressure_mean: { category: 'blood_pressure_mean', label: 'MAP', unit: 'mmHg', normalRange: [65, 110], criticalRange: [50, 130] },
  spo2: { category: 'spo2', label: 'SpO2', unit: '%', normalRange: [95, 100], criticalRange: [88, 100] },
  respiratory_rate: { category: 'respiratory_rate', label: 'Resp Rate', unit: '/min', normalRange: [12, 20], criticalRange: [8, 35] },
  temperature: { category: 'temperature', label: 'Temperature', unit: '\u00B0F', normalRange: [97.0, 99.5], criticalRange: [95.0, 104.0] },
  gcs: { category: 'gcs', label: 'GCS', unit: '', normalRange: [15, 15], criticalRange: [3, 15] },
  pain: { category: 'pain', label: 'Pain', unit: '/10', normalRange: [0, 3], criticalRange: [0, 10] },
};

export function classifyVital(label: string): VitalCategory | undefined {
  return VITAL_LABEL_MAP[label.toLowerCase()];
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/constants/vitalTypes.ts
git commit -m "feat(morpheus): add vital types MIMIC-IV label mapping"
```

---

### Task 4: Antibiotic Classes Constant

**Files:**
- Create: `frontend/src/features/morpheus/constants/antibioticClasses.ts`

- [ ] **Step 1: Create the antibiotic class lookup**

```typescript
// frontend/src/features/morpheus/constants/antibioticClasses.ts

export interface AntibioticClass {
  name: string;
  order: number;
}

const CLASS_MAP: Record<string, AntibioticClass> = {
  // Penicillins
  'ampicillin': { name: 'Penicillins', order: 1 },
  'ampicillin/sulbactam': { name: 'Penicillins', order: 1 },
  'piperacillin/tazobactam': { name: 'Penicillins', order: 1 },
  'oxacillin': { name: 'Penicillins', order: 1 },
  'penicillin g': { name: 'Penicillins', order: 1 },
  'penicillin': { name: 'Penicillins', order: 1 },
  // Cephalosporins
  'cefazolin': { name: 'Cephalosporins', order: 2 },
  'ceftriaxone': { name: 'Cephalosporins', order: 2 },
  'ceftazidime': { name: 'Cephalosporins', order: 2 },
  'cefepime': { name: 'Cephalosporins', order: 2 },
  'cefoxitin': { name: 'Cephalosporins', order: 2 },
  // Carbapenems
  'meropenem': { name: 'Carbapenems', order: 3 },
  'imipenem': { name: 'Carbapenems', order: 3 },
  'ertapenem': { name: 'Carbapenems', order: 3 },
  'doripenem': { name: 'Carbapenems', order: 3 },
  // Fluoroquinolones
  'ciprofloxacin': { name: 'Fluoroquinolones', order: 4 },
  'levofloxacin': { name: 'Fluoroquinolones', order: 4 },
  'moxifloxacin': { name: 'Fluoroquinolones', order: 4 },
  // Aminoglycosides
  'gentamicin': { name: 'Aminoglycosides', order: 5 },
  'tobramycin': { name: 'Aminoglycosides', order: 5 },
  'amikacin': { name: 'Aminoglycosides', order: 5 },
  // Glycopeptides
  'vancomycin': { name: 'Glycopeptides', order: 6 },
  // Macrolides
  'erythromycin': { name: 'Macrolides', order: 7 },
  'azithromycin': { name: 'Macrolides', order: 7 },
  // Lincosamides
  'clindamycin': { name: 'Lincosamides', order: 7 },
  // Tetracyclines
  'tetracycline': { name: 'Tetracyclines', order: 8 },
  'doxycycline': { name: 'Tetracyclines', order: 8 },
  // Sulfonamides
  'trimethoprim/sulfa': { name: 'Sulfonamides', order: 9 },
  'trimethoprim/sulfamethoxazole': { name: 'Sulfonamides', order: 9 },
  // Other
  'nitrofurantoin': { name: 'Other', order: 10 },
  'linezolid': { name: 'Other', order: 10 },
  'daptomycin': { name: 'Other', order: 10 },
  'colistin': { name: 'Other', order: 10 },
  'metronidazole': { name: 'Other', order: 10 },
  'rifampin': { name: 'Other', order: 10 },
};

export function getAntibioticClass(name: string): AntibioticClass {
  return CLASS_MAP[name.toLowerCase()] ?? { name: 'Other', order: 10 };
}

export function sortAntibioticsByClass(antibiotics: string[]): string[] {
  return [...antibiotics].sort((a, b) => {
    const classA = getAntibioticClass(a);
    const classB = getAntibioticClass(b);
    if (classA.order !== classB.order) return classA.order - classB.order;
    return a.localeCompare(b);
  });
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/constants/antibioticClasses.ts
git commit -m "feat(morpheus): add antibiotic class mapping for antibiogram"
```

---

### Task 5: Update API Types and Add Hooks

**Files:**
- Modify: `frontend/src/features/morpheus/api.ts:129-138` (MorpheusMicrobiology interface)
- Modify: `frontend/src/features/morpheus/api.ts:472` (add new hook at end)

- [ ] **Step 1: Add dilution fields to MorpheusMicrobiology**

In `api.ts`, change lines 129-138:

```typescript
export interface MorpheusMicrobiology {
  microevent_id: string;
  hadm_id: string;
  chartdate: string;
  spec_type_desc: string;
  test_name: string;
  org_name: string | null;
  ab_name: string | null;
  interpretation: string | null;
  dilution_comparison: string | null;
  dilution_value: string | null;
}
```

- [ ] **Step 2: Add ConceptStats interface and hook**

Append to `api.ts` after the last hook:

```typescript
// ── Concept Stats (for ConceptDetailDrawer population context) ──────────────

export interface ConceptStats {
  concept_id: number;
  patient_count: number;
  total_patients: number;
  percentage: number;
  mean_value: number | null;
  median_value: number | null;
}

export function useMorpheusConceptStats(conceptId: number | undefined, dataset?: string) {
  return useQuery({
    queryKey: ['morpheus', 'dashboard', 'concept-stats', conceptId, dataset],
    queryFn: async () => {
      const res = await apiClient.get(
        appendDataset(`${DASH}/concept-stats/${conceptId}`, dataset),
      );
      return res.data.data as ConceptStats;
    },
    enabled: !!conceptId,
    staleTime: 60_000, // 60s cache per spec
  });
}
```

- [ ] **Step 3: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/morpheus/api.ts
git commit -m "feat(morpheus): add dilution fields to microbiology interface and concept-stats hook"
```

---

### Task 6: HoverCard Component

**Files:**
- Create: `frontend/src/features/morpheus/components/HoverCard.tsx`

- [ ] **Step 1: Create the HoverCard component**

```typescript
// frontend/src/features/morpheus/components/HoverCard.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface HoverCardProps {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
}

export default function HoverCard({ content, children, delay = 200 }: HoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [positionAbove, setPositionAbove] = useState(true);
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const cardHeight = 120; // estimate
      const spaceAbove = rect.top;
      const above = spaceAbove > cardHeight;
      const top = above ? rect.top - 8 : rect.bottom + 8;
      const left = Math.min(rect.left, window.innerWidth - 280);
      setPosition({ top, left });
      setPositionAbove(above);
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    if (visible) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [visible]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-block"
      >
        {children}
      </div>
      {visible && (
        <div
          ref={cardRef}
          className="fixed z-50 max-w-[260px] rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 text-xs text-[#C5C0B8] shadow-xl"
          style={{ top: position.top, left: position.left, transform: positionAbove ? 'translateY(-100%)' : undefined }}
          onMouseEnter={() => clearTimeout(timeoutRef.current)}
          onMouseLeave={hide}
        >
          {content}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/HoverCard.tsx
git commit -m "feat(morpheus): add reusable HoverCard tooltip component"
```

---

### Task 7: ExportButton Component

**Files:**
- Create: `frontend/src/features/morpheus/components/ExportButton.tsx`

- [ ] **Step 1: Create the CSV export component**

```typescript
// frontend/src/features/morpheus/components/ExportButton.tsx
import { Download } from 'lucide-react';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  headers?: string[];
}

/** Sanitize a cell value to prevent CSV injection (HIGHSEC requirement). */
function sanitizeCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function ExportButton({ data, filename, headers }: ExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;
    const cols = headers ?? Object.keys(data[0]);
    const rows = data.map((row) => cols.map((col) => sanitizeCell(row[col])).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={data.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-[#C5C0B8] transition-colors hover:bg-zinc-800 hover:text-[#F0EDE8] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
    >
      <Download size={12} />
      Export CSV
    </button>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/ExportButton.tsx
git commit -m "feat(morpheus): add CSV export button with injection prevention"
```

---

### Task 8: TruncationWarning Component

**Files:**
- Create: `frontend/src/features/morpheus/components/TruncationWarning.tsx`

- [ ] **Step 1: Create the truncation warning banner**

```typescript
// frontend/src/features/morpheus/components/TruncationWarning.tsx
import { AlertTriangle } from 'lucide-react';

interface TruncationWarningProps {
  loaded: number;
  total: number;
  domain: string;
}

export default function TruncationWarning({ loaded, total, domain }: TruncationWarningProps) {
  if (loaded >= total) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-400">
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        Showing <strong>{loaded.toLocaleString()}</strong> of{' '}
        <strong>{total.toLocaleString()}</strong> {domain}. Results capped for performance.
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/TruncationWarning.tsx
git commit -m "feat(morpheus): add truncation warning banner component"
```

---

## Phase 2: Backend — Concept Stats Endpoint

### Task 9: Add concept-stats Service Method

**Files:**
- Modify: `backend/app/Services/Morpheus/MorpheusDashboardService.php` (add method at end)

- [ ] **Step 1: Add getConceptStats method to the service**

Append before the closing `}` of the class:

```php
/**
 * Get population-level statistics for a single concept within a dataset.
 * Returns patient count, percentage, and mean/median for measurement concepts.
 */
public function getConceptStats(string $schema, int $conceptId): ?array
{
    $s = $this->getSchemaName($schema);

    return $this->cached("concept_stats:{$conceptId}", $schema, function () use ($s, $conceptId) {
        // Check diagnoses_icd (ICD codes map to concept_id via omop.concept)
        $diagStats = DB::connection($this->conn)->selectOne("
            SELECT
                COUNT(DISTINCT d.subject_id) as patient_count,
                (SELECT COUNT(DISTINCT subject_id) FROM \"{$s}\".admissions) as total_patients
            FROM \"{$s}\".diagnoses_icd d
            JOIN omop.concept c ON c.concept_code = d.icd_code
                AND c.vocabulary_id = CASE WHEN d.icd_version = 9 THEN 'ICD9CM' ELSE 'ICD10CM' END
            WHERE c.concept_id = ?
        ", [$conceptId]);

        if ($diagStats && $diagStats->patient_count > 0) {
            $total = (int) $diagStats->total_patients;
            $count = (int) $diagStats->patient_count;
            return [
                'concept_id' => $conceptId,
                'patient_count' => $count,
                'total_patients' => $total,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0,
                'mean_value' => null,
                'median_value' => null,
            ];
        }

        // Check labevents (measurement concept via d_labitems)
        $labStats = DB::connection($this->conn)->selectOne("
            SELECT
                COUNT(DISTINCT le.subject_id) as patient_count,
                (SELECT COUNT(DISTINCT subject_id) FROM \"{$s}\".admissions) as total_patients,
                ROUND(AVG(le.valuenum)::numeric, 2) as mean_value,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY le.valuenum)::numeric, 2) as median_value
            FROM \"{$s}\".labevents le
            WHERE le.itemid = ? AND le.valuenum IS NOT NULL
        ", [$conceptId]);

        if ($labStats && $labStats->patient_count > 0) {
            $total = (int) $labStats->total_patients;
            $count = (int) $labStats->patient_count;
            return [
                'concept_id' => $conceptId,
                'patient_count' => $count,
                'total_patients' => $total,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0,
                'mean_value' => $labStats->mean_value !== null ? (float) $labStats->mean_value : null,
                'median_value' => $labStats->median_value !== null ? (float) $labStats->median_value : null,
            ];
        }

        return null;
    });
}
```

- [ ] **Step 2: Verify PHP syntax**

Run: `cd /home/smudoshi/Github/Parthenon/backend && php -l app/Services/Morpheus/MorpheusDashboardService.php`
Expected: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/Morpheus/MorpheusDashboardService.php
git commit -m "feat(morpheus): add concept-stats service method with caching"
```

---

### Task 10: Add concept-stats Controller Method and Route

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/MorpheusDashboardController.php:96` (add method)
- Modify: `backend/routes/api.php:1205` (add route)

- [ ] **Step 1: Add controller method**

Add before the closing `}` of `MorpheusDashboardController`:

```php
public function conceptStats(Request $request, int $conceptId): JsonResponse
{
    $schema = $this->resolveSchema($request);
    $stats = $this->service->getConceptStats($schema, $conceptId);

    if (! $stats) {
        return response()->json(['data' => null, 'message' => 'No data available for this concept'], 200);
    }

    return response()->json(['data' => $stats]);
}
```

- [ ] **Step 2: Add route**

In `api.php`, inside the `morpheus/dashboard` prefix group (after line 1205), add:

```php
Route::get('/concept-stats/{conceptId}', [MorpheusDashboardController::class, 'conceptStats']);
```

- [ ] **Step 3: Verify route is registered**

Run: `cd /home/smudoshi/Github/Parthenon/backend && php artisan route:list --path=morpheus/dashboard/concept-stats 2>&1`
Expected: Shows GET route for `api/v1/morpheus/dashboard/concept-stats/{conceptId}`

- [ ] **Step 4: Add test**

Add to `backend/tests/Feature/Api/V1/MorpheusDashboardTest.php`:

```php
test('unauthenticated user cannot access concept stats', function () {
    $this->getJson('/api/v1/morpheus/dashboard/concept-stats/316139')
        ->assertStatus(401);
});

test('authenticated user can access concept stats', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getConceptStats')
            ->once()
            ->with('mimiciv', 316139)
            ->andReturn([
                'concept_id' => 316139,
                'patient_count' => 250,
                'total_patients' => 1000,
                'percentage' => 25.0,
                'mean_value' => null,
                'median_value' => null,
            ]);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/concept-stats/316139')
        ->assertOk()
        ->assertJsonStructure(['data' => [
            'concept_id', 'patient_count', 'total_patients', 'percentage',
        ]]);
});

test('concept stats returns null for unknown concept', function () {
    $user = User::factory()->create();

    $this->mock(MorpheusDashboardService::class, function ($mock) {
        $mock->shouldReceive('getConceptStats')
            ->once()
            ->andReturn(null);
    });

    $this->actingAs($user)
        ->getJson('/api/v1/morpheus/dashboard/concept-stats/999999')
        ->assertOk()
        ->assertJson(['data' => null]);
});
```

- [ ] **Step 5: Run tests**

Run: `cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Feature/Api/V1/MorpheusDashboardTest.php --filter="concept" -v`
Expected: 3 new tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/MorpheusDashboardController.php backend/routes/api.php backend/tests/Feature/Api/V1/MorpheusDashboardTest.php
git commit -m "feat(morpheus): add concept-stats endpoint for population context"
```

---

## Phase 3: ConceptDetailDrawer

### Task 11: ConceptDetailDrawer Component

**Files:**
- Create: `frontend/src/features/morpheus/components/ConceptDetailDrawer.tsx`

Reference: `frontend/src/features/profiles/components/ConceptDetailDrawer.tsx` (port and extend)

- [ ] **Step 1: Create the drawer component**

Create `frontend/src/features/morpheus/components/ConceptDetailDrawer.tsx`. This is a significant component (~250 lines). Key sections:

```typescript
// frontend/src/features/morpheus/components/ConceptDetailDrawer.tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Hash, Database, Tag, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DOMAIN_COLORS } from '../constants/domainColors';
import { useMorpheusConceptStats } from '../api';

export interface DrawerEvent {
  domain: string;
  concept_id: number | null;
  concept_name: string;
  source_code: string | null;
  source_vocabulary: string | null;
  standard_concept_name: string | null;
  start_date: string | null;
  end_date: string | null;
  // Measurement fields
  value: number | string | null;
  unit: string | null;
  ref_range_lower: number | null;
  ref_range_upper: number | null;
  // Drug fields
  route: string | null;
  dose: string | null;
  days_supply: number | null;
  // Diagnosis fields
  seq_num: number | null;
  // Context
  hadm_id: string | null;
  // History (pre-computed by parent)
  occurrenceCount: number;
  sparklineValues: number[];
}

interface ConceptDetailDrawerProps {
  event: DrawerEvent | null;
  onClose: () => void;
  dataset?: string;
}

function Row({ icon: Icon, label, value, mono }: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      {Icon && <Icon size={12} className="mt-0.5 text-[#5A5650] shrink-0" />}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">{label}</div>
        <div className={`text-sm text-[#C5C0B8] ${mono ? 'font-mono text-[#2DD4BF]' : ''}`}>{value ?? '\u2014'}</div>
      </div>
    </div>
  );
}

function RangeIndicator({ value, low, high }: { value: number; low: number | null; high: number | null }) {
  if (low == null && high == null) return null;
  if (low != null && value < low) {
    return (
      <span className="inline-flex items-center gap-1 text-[#818CF8]">
        <TrendingDown size={12} /> Below range ({low})
      </span>
    );
  }
  if (high != null && value > high) {
    return (
      <span className="inline-flex items-center gap-1 text-[#E85A6B]">
        <TrendingUp size={12} /> Above range ({high})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[#22C55E]">
      <Minus size={12} /> Normal ({low}\u2013{high})
    </span>
  );
}

function MiniSparkline({ values, currentIdx }: { values: number[]; currentIdx?: number }) {
  if (values.length < 2) return null;
  const recent = values.slice(-100);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;
  const w = 200;
  const h = 32;
  const points = recent.map((v, i) => `${(i / (recent.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <svg width={w} height={h} className="my-1">
      <polyline points={points} fill="none" stroke="#818CF8" strokeWidth={1.5} />
      {currentIdx != null && currentIdx < recent.length && (
        <circle
          cx={(currentIdx / (recent.length - 1)) * w}
          cy={h - ((recent[currentIdx] - min) / range) * h}
          r={3}
          fill="#F0EDE8"
          stroke="#818CF8"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}

export default function ConceptDetailDrawer({ event, onClose, dataset }: ConceptDetailDrawerProps) {
  const { data: popStats } = useMorpheusConceptStats(
    event?.concept_id ?? undefined,
    dataset,
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!event) return null;

  const color = DOMAIN_COLORS[event.domain as keyof typeof DOMAIN_COLORS] ?? '#8A857D';
  const numericValue = typeof event.value === 'number' ? event.value : (typeof event.value === 'string' ? Number(event.value) : null);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[360px] flex-col border-l bg-[#0E0E11]"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#323238] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#F0EDE8] truncate">{event.concept_name}</h3>
          <button type="button" onClick={onClose} className="text-[#5A5650] hover:text-[#C5C0B8] transition-colors focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Dual Code Display */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#5A5650] mb-1">Source Code</div>
              {event.source_code ? (
                <>
                  <div className="font-mono text-sm text-[#C9A227]">{event.source_code}</div>
                  <div className="text-[10px] text-[#5A5650]">{event.source_vocabulary}</div>
                </>
              ) : (
                <div className="text-xs text-[#5A5650]">\u2014</div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#5A5650] mb-1">OMOP Concept</div>
              {event.concept_id ? (
                <>
                  <div className="font-mono text-sm text-[#2DD4BF]">{event.concept_id}</div>
                  <div className="text-[10px] text-[#5A5650]">{event.standard_concept_name}</div>
                  <span className="inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#22C55E]/10 text-[#22C55E]">Mapped</span>
                </>
              ) : (
                <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-400">Unmapped</span>
              )}
            </div>
          </div>

          {/* Current Occurrence */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8A857D] mb-2">Occurrence Details</div>
            {event.start_date && <Row icon={Tag} label="Date" value={`${event.start_date}${event.end_date ? ` \u2013 ${event.end_date}` : ''}`} />}
            {numericValue != null && !isNaN(numericValue) && (
              <>
                <Row icon={Hash} label="Value" value={`${numericValue} ${event.unit ?? ''}`} />
                <div className="ml-5 text-xs">
                  <RangeIndicator value={numericValue} low={event.ref_range_lower} high={event.ref_range_upper} />
                </div>
              </>
            )}
            {event.route && <Row icon={Tag} label="Route" value={event.route} />}
            {event.dose && <Row icon={Tag} label="Dose" value={event.dose} />}
            {event.seq_num != null && <Row icon={Hash} label="Sequence" value={`#${event.seq_num}`} mono />}
          </div>

          {/* Patient History */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8A857D] mb-2">This Patient</div>
            <div className="text-xs text-[#C5C0B8]">
              {event.occurrenceCount} occurrence{event.occurrenceCount !== 1 ? 's' : ''}
            </div>
            {event.sparklineValues.length > 1 && (
              <MiniSparkline values={event.sparklineValues} currentIdx={event.sparklineValues.length - 1} />
            )}
          </div>

          {/* Population Context */}
          {popStats && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8A857D] mb-2">Dataset Population</div>
              <div className="text-xs text-[#C5C0B8]">
                {popStats.patient_count.toLocaleString()} of {popStats.total_patients.toLocaleString()} patients ({popStats.percentage}%)
              </div>
              {popStats.mean_value != null && (
                <div className="text-xs text-[#8A857D] mt-1">
                  Mean: {popStats.mean_value} | Median: {popStats.median_value}
                </div>
              )}
            </div>
          )}
          {!popStats && event.concept_id && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8A857D] mb-2">Dataset Population</div>
              <div className="text-xs text-[#5A5650]">Population data not available</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#323238] px-4 py-3 space-y-2">
          {event.concept_id && (
            <Link
              to={`/vocabulary?concept=${event.concept_id}`}
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-[#2DD4BF] transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
              title="View concept in Vocabulary Browser"
            >
              <ExternalLink size={12} /> View in Vocabulary Browser
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/ConceptDetailDrawer.tsx
git commit -m "feat(morpheus): add ConceptDetailDrawer with dual-code display and population context"
```

---

## Phase 4: Labs Tab — Clinical Monitoring Dashboard

### Task 12: LabSparkline Component

**Files:**
- Create: `frontend/src/features/morpheus/components/LabSparkline.tsx`

Reference: `frontend/src/features/profiles/components/PatientLabPanel.tsx` (Sparkline sub-component)

- [ ] **Step 1: Create the sparkline component**

```typescript
// frontend/src/features/morpheus/components/LabSparkline.tsx

interface LabSparklineProps {
  values: number[];
  rangeLow: number | null;
  rangeHigh: number | null;
  width?: number;
  height?: number;
}

export default function LabSparkline({ values, rangeLow, rangeHigh, width = 100, height = 28 }: LabSparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values, rangeLow ?? Infinity);
  const max = Math.max(...values, rangeHigh ?? -Infinity);
  const range = max - min || 1;
  const pad = 2;

  const toX = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
  const toY = (v: number) => pad + (1 - (v - min) / range) * (height - 2 * pad);

  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      {/* Reference range band */}
      {rangeLow != null && rangeHigh != null && (
        <rect
          x={pad}
          y={toY(rangeHigh)}
          width={width - 2 * pad}
          height={Math.max(0, toY(rangeLow) - toY(rangeHigh))}
          fill="#22C55E"
          opacity={0.12}
          rx={2}
        />
      )}
      {/* Value line */}
      <polyline points={points} fill="none" stroke="#818CF8" strokeWidth={1.5} />
      {/* Latest point */}
      <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r={2.5} fill="#F0EDE8" stroke="#818CF8" strokeWidth={1} />
    </svg>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/LabSparkline.tsx
git commit -m "feat(morpheus): add LabSparkline SVG component with reference range band"
```

---

### Task 13: LabTimeSeriesChart Component

**Files:**
- Create: `frontend/src/features/morpheus/components/LabTimeSeriesChart.tsx`

- [ ] **Step 1: Create the interactive time-series chart**

```typescript
// frontend/src/features/morpheus/components/LabTimeSeriesChart.tsx
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';

interface DataPoint {
  date: string;
  value: number;
}

interface LabTimeSeriesChartProps {
  data: DataPoint[];
  rangeLow: number | null;
  rangeHigh: number | null;
  unit: string;
  color?: string;
  /** Optional second series for overlay */
  overlayData?: DataPoint[];
  overlayLabel?: string;
  overlayColor?: string;
}

export default function LabTimeSeriesChart({
  data, rangeLow, rangeHigh, unit, color = '#818CF8',
  overlayData, overlayLabel, overlayColor = '#2DD4BF',
}: LabTimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() =>
    [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [data],
  );

  const height = 200;
  const padX = 50;
  const padY = 24;
  const chartW = (containerWidth - 2 * padX) * zoom;
  const chartH = height - 2 * padY;

  const allValues = sorted.map((d) => d.value).concat(overlayData?.map((d) => d.value) ?? []);
  const minVal = Math.min(...allValues, rangeLow ?? Infinity);
  const maxVal = Math.max(...allValues, rangeHigh ?? -Infinity);
  const valRange = maxVal - minVal || 1;

  const timeMin = sorted.length > 0 ? new Date(sorted[0].date).getTime() : 0;
  const timeMax = sorted.length > 0 ? new Date(sorted[sorted.length - 1].date).getTime() : 1;
  const timeRange = timeMax - timeMin || 1;

  const toX = (date: string) => padX + ((new Date(date).getTime() - timeMin) / timeRange) * chartW - panOffset;
  const toY = (val: number) => padY + (1 - (val - minVal) / valRange) * chartH;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPanOffset((p) => Math.max(0, p - 40));
    if (e.key === 'ArrowRight') setPanOffset((p) => p + 40);
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(10, z * 1.2));
    if (e.key === '-') setZoom((z) => Math.max(0.5, z / 1.2));
  }, []);

  const primaryPoints = sorted.map((d) => `${toX(d.date)},${toY(d.value)}`).join(' ');

  return (
    <div ref={containerRef} className="w-full" tabIndex={0} onKeyDown={handleKeyDown}>
      <svg width={containerWidth} height={height} className="overflow-visible">
        {/* Reference range band */}
        {rangeLow != null && rangeHigh != null && (
          <rect
            x={padX}
            y={toY(rangeHigh)}
            width={chartW}
            height={Math.max(0, toY(rangeLow) - toY(rangeHigh))}
            fill="#22C55E"
            opacity={0.08}
          />
        )}

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line key={frac} x1={padX} x2={padX + chartW} y1={padY + frac * chartH} y2={padY + frac * chartH}
            stroke="#323238" strokeWidth={0.5} />
        ))}

        {/* Primary series */}
        <polyline points={primaryPoints} fill="none" stroke={color} strokeWidth={2} />
        {sorted.map((d, i) => (
          <circle
            key={i}
            cx={toX(d.date)}
            cy={toY(d.value)}
            r={hoverIdx === i ? 5 : 3}
            fill={hoverIdx === i ? '#F0EDE8' : color}
            stroke={color}
            strokeWidth={1}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="cursor-pointer"
          />
        ))}

        {/* Overlay series */}
        {overlayData && overlayData.length > 1 && (
          <>
            <polyline
              points={[...overlayData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((d) => `${toX(d.date)},${toY(d.value)}`).join(' ')}
              fill="none"
              stroke={overlayColor}
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          </>
        )}

        {/* Hover tooltip */}
        {hoverIdx != null && sorted[hoverIdx] && (
          <g>
            <rect x={toX(sorted[hoverIdx].date) - 40} y={toY(sorted[hoverIdx].value) - 32}
              width={80} height={24} rx={4} fill="#1A1A1E" stroke="#323238" />
            <text x={toX(sorted[hoverIdx].date)} y={toY(sorted[hoverIdx].value) - 16}
              textAnchor="middle" fill="#C5C0B8" fontSize={10}>
              {sorted[hoverIdx].value} {unit}
            </text>
          </g>
        )}

        {/* Y axis labels */}
        {[0, 0.5, 1].map((frac) => {
          const val = minVal + frac * valRange;
          return (
            <text key={frac} x={padX - 8} y={padY + (1 - frac) * chartH + 4}
              textAnchor="end" fill="#5A5650" fontSize={9}>
              {val.toFixed(1)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      {overlayData && overlayLabel && (
        <div className="flex items-center gap-4 mt-1 text-[10px] text-[#8A857D]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: color }} /> Primary
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block border-t border-dashed" style={{ borderColor: overlayColor }} /> {overlayLabel}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/LabTimeSeriesChart.tsx
git commit -m "feat(morpheus): add interactive LabTimeSeriesChart with zoom/pan and overlay"
```

---

### Task 14: LabPanelDashboard Component

**Files:**
- Create: `frontend/src/features/morpheus/components/LabPanelDashboard.tsx`

- [ ] **Step 1: Create the lab panel dashboard**

```typescript
// frontend/src/features/morpheus/components/LabPanelDashboard.tsx
import { useMemo, useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MorpheusLabResult } from '../api';
import { LAB_PANELS, findLabPanel, type LabPanelConfig } from '../constants/labPanels';
import LabSparkline from './LabSparkline';
import LabTimeSeriesChart from './LabTimeSeriesChart';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface LabPanelDashboardProps {
  labs: MorpheusLabResult[];
  onConceptClick: (event: DrawerEvent) => void;
}

interface LabGroup {
  itemid: string;
  label: string;
  values: { date: string; value: number }[];
  rangeLow: number | null;
  rangeHigh: number | null;
  latest: number;
  latestDate: string;
  unit: string;
  count: number;
}

function getSeverity(value: number, low: number | null, high: number | null): 'normal' | 'mild' | 'moderate' | 'critical' {
  if (low == null && high == null) return 'normal';
  if (low != null && value < low) {
    const pct = low > 0 ? ((low - value) / low) * 100 : 0;
    if (pct > 50) return 'critical';
    if (pct > 25) return 'moderate';
    return 'mild';
  }
  if (high != null && value > high) {
    const pct = high > 0 ? ((value - high) / high) * 100 : 0;
    if (pct > 50) return 'critical';
    if (pct > 25) return 'moderate';
    return 'mild';
  }
  return 'normal';
}

const SEVERITY_COLORS = {
  normal: '#22C55E',
  mild: '#EAB308',
  moderate: '#F97316',
  critical: '#E85A6B',
};

function TrendIcon({ values }: { values: number[] }) {
  if (values.length < 2) return <Minus size={12} className="text-[#5A5650]" />;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev * 1.05) return <TrendingUp size={12} className="text-[#E85A6B]" />;
  if (last < prev * 0.95) return <TrendingDown size={12} className="text-[#818CF8]" />;
  return <Minus size={12} className="text-[#22C55E]" />;
}

export default function LabPanelDashboard({ labs, onConceptClick }: LabPanelDashboardProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, LabGroup>();
    for (const lab of labs) {
      const num = lab.valuenum != null ? Number(lab.valuenum) : null;
      if (num == null || isNaN(num)) continue;

      const existing = map.get(lab.itemid);
      if (existing) {
        existing.values.push({ date: lab.charttime, value: num });
        existing.count++;
        if (new Date(lab.charttime) > new Date(existing.latestDate)) {
          existing.latest = num;
          existing.latestDate = lab.charttime;
        }
        if (lab.ref_range_lower != null) existing.rangeLow = Number(lab.ref_range_lower);
        if (lab.ref_range_upper != null) existing.rangeHigh = Number(lab.ref_range_upper);
      } else {
        map.set(lab.itemid, {
          itemid: lab.itemid,
          label: lab.label,
          values: [{ date: lab.charttime, value: num }],
          rangeLow: lab.ref_range_lower != null ? Number(lab.ref_range_lower) : null,
          rangeHigh: lab.ref_range_upper != null ? Number(lab.ref_range_upper) : null,
          latest: num,
          latestDate: lab.charttime,
          unit: lab.valueuom ?? '',
          count: 1,
        });
      }
    }
    // Sort values chronologically within each group
    for (const g of map.values()) {
      g.values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [labs]);

  // Organize into panels
  const panels = useMemo(() => {
    const result: { panel: LabPanelConfig; tests: LabGroup[] }[] = [];
    const ungrouped: LabGroup[] = [];

    for (const panel of LAB_PANELS) {
      const tests: LabGroup[] = [];
      for (const g of groups.values()) {
        if (findLabPanel(g.label)?.name === panel.name) {
          tests.push(g);
        }
      }
      if (tests.length > 0) {
        tests.sort((a, b) => a.label.localeCompare(b.label));
        result.push({ panel, tests });
      }
    }

    // Collect ungrouped
    for (const g of groups.values()) {
      if (!findLabPanel(g.label)) ungrouped.push(g);
    }
    if (ungrouped.length > 0) {
      ungrouped.sort((a, b) => a.label.localeCompare(b.label));
      result.push({
        panel: { name: 'Other', color: '#8A857D', tests: [] },
        tests: ungrouped,
      });
    }

    return result;
  }, [groups]);

  if (panels.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No numeric lab results available</p>
      </div>
    );
  }

  const handleConceptClick = (g: LabGroup) => {
    onConceptClick({
      domain: 'lab',
      concept_id: Number(g.itemid) || null,
      concept_name: g.label,
      source_code: g.itemid,
      source_vocabulary: 'MIMIC-IV d_labitems',
      standard_concept_name: null,
      start_date: g.latestDate,
      end_date: null,
      value: g.latest,
      unit: g.unit,
      ref_range_lower: g.rangeLow,
      ref_range_upper: g.rangeHigh,
      route: null,
      dose: null,
      days_supply: null,
      seq_num: null,
      hadm_id: null,
      occurrenceCount: g.count,
      sparklineValues: g.values.map((v) => v.value),
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-[#8A857D]">
        {groups.size} tests \u00B7 {labs.filter((l) => l.valuenum != null).length} numeric values
      </div>

      {panels.map(({ panel, tests }) => (
        <div key={panel.name} className="rounded-xl border border-zinc-800 bg-zinc-950/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedPanel(expandedPanel === panel.name ? null : panel.name)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1A1A1E] transition-colors focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: panel.color }} />
              <span className="text-sm font-semibold text-[#F0EDE8]">{panel.name}</span>
              <span className="text-[10px] text-[#5A5650]">{tests.length} tests</span>
            </div>
            <ChevronDown size={14} className={`text-[#5A5650] transition-transform ${expandedPanel === panel.name || expandedPanel === null ? 'rotate-180' : ''}`} />
          </button>

          {(expandedPanel === panel.name || expandedPanel === null) && (
            <div className="divide-y divide-zinc-800/50">
              {tests.map((g) => {
                const severity = getSeverity(g.latest, g.rangeLow, g.rangeHigh);
                const isExpanded = expandedRow === g.itemid;
                const vals = g.values.map((v) => v.value);

                return (
                  <div key={g.itemid}>
                    <div
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#1A1A1E] transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : g.itemid)}
                    >
                      <ChevronDown size={12} className={`text-[#5A5650] transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleConceptClick(g); }}
                        className="text-xs text-[#C5C0B8] hover:text-[#2DD4BF] truncate min-w-[140px] text-left transition-colors"
                      >
                        {g.label}
                      </button>
                      <span className="text-[10px] text-[#5A5650] shrink-0">\u00D7{g.count}</span>
                      <LabSparkline values={vals} rangeLow={g.rangeLow} rangeHigh={g.rangeHigh} />
                      <span className="text-sm font-semibold text-[#F0EDE8] shrink-0 min-w-[60px] text-right">
                        {g.latest.toFixed(1)}
                        <span className="text-[10px] text-[#5A5650] ml-0.5">{g.unit}</span>
                      </span>
                      <TrendIcon values={vals} />
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLORS[severity] }} title={severity} />
                    </div>

                    {isExpanded && (
                      <div className="px-8 pb-3">
                        <LabTimeSeriesChart data={g.values} rangeLow={g.rangeLow} rangeHigh={g.rangeHigh} unit={g.unit} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/LabPanelDashboard.tsx
git commit -m "feat(morpheus): add LabPanelDashboard with organ system grouping and expandable charts"
```

---

## Phase 5: Vitals Tab — Bedside Monitor

### Task 15: VitalsMonitorCell Component

**Files:**
- Create: `frontend/src/features/morpheus/components/VitalsMonitorCell.tsx`

- [ ] **Step 1: Create the monitor cell component**

```typescript
// frontend/src/features/morpheus/components/VitalsMonitorCell.tsx
import LabSparkline from './LabSparkline';

interface VitalsMonitorCellProps {
  label: string;
  value: number | null;
  unit: string;
  color: string;
  sparklineValues: number[];
  normalRange: [number, number];
  criticalRange: [number, number];
  minValue?: number;
  maxValue?: number;
}

function getSeverityBorder(value: number | null, normal: [number, number], critical: [number, number]): string {
  if (value == null) return 'border-[#323238]';
  if (value < critical[0] || value > critical[1]) return 'border-[#E85A6B]';
  if (value < normal[0] || value > normal[1]) return 'border-yellow-500';
  return 'border-[#323238]';
}

export default function VitalsMonitorCell({
  label, value, unit, color, sparklineValues, normalRange, criticalRange, minValue, maxValue,
}: VitalsMonitorCellProps) {
  const borderClass = getSeverityBorder(value, normalRange, criticalRange);

  return (
    <div className={`rounded-xl border-2 ${borderClass} bg-zinc-950/70 p-3 flex flex-col gap-1 transition-colors`}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color }}>{label}</div>

      {value != null ? (
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color }}>{value.toFixed(1)}</span>
          <span className="text-[10px] text-[#5A5650]">{unit}</span>
        </div>
      ) : (
        <div className="text-sm text-[#5A5650]">No data</div>
      )}

      {sparklineValues.length > 1 && (
        <LabSparkline
          values={sparklineValues}
          rangeLow={normalRange[0]}
          rangeHigh={normalRange[1]}
          width={120}
          height={24}
        />
      )}

      {minValue != null && maxValue != null && (
        <div className="flex justify-between text-[9px] text-[#5A5650]">
          <span>Lo: {minValue.toFixed(1)}</span>
          <span>Hi: {maxValue.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/VitalsMonitorCell.tsx
git commit -m "feat(morpheus): add VitalsMonitorCell bedside monitor component"
```

---

### Task 16: VitalsMonitorGrid Component

**Files:**
- Create: `frontend/src/features/morpheus/components/VitalsMonitorGrid.tsx`

- [ ] **Step 1: Create the monitor grid with timeline**

```typescript
// frontend/src/features/morpheus/components/VitalsMonitorGrid.tsx
import { useMemo, useState } from 'react';
import type { MorpheusVital } from '../api';
import { classifyVital, VITAL_TYPE_CONFIGS, type VitalCategory } from '../constants/vitalTypes';
import { VITAL_COLORS } from '../constants/domainColors';
import VitalsMonitorCell from './VitalsMonitorCell';
import LabTimeSeriesChart from './LabTimeSeriesChart';

interface VitalsMonitorGridProps {
  vitals: MorpheusVital[];
}

interface VitalSeries {
  category: VitalCategory;
  values: { date: string; value: number }[];
  latest: number;
  min: number;
  max: number;
}

const GRID_ORDER: VitalCategory[] = [
  'heart_rate', 'blood_pressure_systolic', 'spo2',
  'respiratory_rate', 'temperature', 'gcs',
];

const GRID_COLORS: Record<string, string> = {
  heart_rate: VITAL_COLORS.heart_rate,
  blood_pressure_systolic: VITAL_COLORS.blood_pressure,
  blood_pressure_diastolic: VITAL_COLORS.blood_pressure,
  spo2: VITAL_COLORS.spo2,
  respiratory_rate: VITAL_COLORS.respiratory_rate,
  temperature: VITAL_COLORS.temperature,
  gcs: VITAL_COLORS.gcs,
  pain: VITAL_COLORS.gcs,
};

export default function VitalsMonitorGrid({ vitals }: VitalsMonitorGridProps) {
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set(GRID_ORDER));

  const series = useMemo(() => {
    const map = new Map<VitalCategory, VitalSeries>();

    for (const v of vitals) {
      const cat = classifyVital(v.label);
      if (!cat) continue;
      const num = v.valuenum != null ? Number(v.valuenum) : null;
      if (num == null || isNaN(num)) continue;

      const existing = map.get(cat);
      if (existing) {
        existing.values.push({ date: v.charttime, value: num });
        if (num < existing.min) existing.min = num;
        if (num > existing.max) existing.max = num;
        if (new Date(v.charttime) > new Date(existing.values[existing.values.length - 1]?.date ?? '')) {
          existing.latest = num;
        }
      } else {
        map.set(cat, {
          category: cat,
          values: [{ date: v.charttime, value: num }],
          latest: num,
          min: num,
          max: num,
        });
      }
    }

    for (const s of map.values()) {
      s.values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      s.latest = s.values[s.values.length - 1]?.value ?? s.latest;
    }

    return map;
  }, [vitals]);

  if (series.size === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No vital signs data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Monitor Grid */}
      <div className="grid grid-cols-3 gap-3">
        {GRID_ORDER.map((cat) => {
          const s = series.get(cat);
          const config = VITAL_TYPE_CONFIGS[cat];
          if (!config) return null;

          return (
            <VitalsMonitorCell
              key={cat}
              label={config.label}
              value={s?.latest ?? null}
              unit={config.unit}
              color={GRID_COLORS[cat] ?? '#8A857D'}
              sparklineValues={s?.values.map((v) => v.value) ?? []}
              normalRange={config.normalRange}
              criticalRange={config.criticalRange}
              minValue={s?.min}
              maxValue={s?.max}
            />
          );
        })}
      </div>

      {/* Timeline Chart */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[#F0EDE8]">Vital Signs Timeline</span>
          <div className="flex items-center gap-3">
            {GRID_ORDER.map((cat) => {
              const config = VITAL_TYPE_CONFIGS[cat];
              if (!config || !series.has(cat)) return null;
              const isVisible = visibleSeries.has(cat);
              return (
                <label key={cat} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => {
                      const next = new Set(visibleSeries);
                      if (isVisible) next.delete(cat);
                      else next.add(cat);
                      setVisibleSeries(next);
                    }}
                    className="w-3 h-3 rounded"
                  />
                  <span className="text-[10px]" style={{ color: GRID_COLORS[cat] }}>{config.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Render primary visible series chart */}
        {(() => {
          const visible = GRID_ORDER.filter((c) => visibleSeries.has(c) && series.has(c));
          if (visible.length === 0) return <div className="text-xs text-[#5A5650] text-center py-4">Select a vital to display</div>;
          const primary = visible[0];
          const pSeries = series.get(primary);
          const pConfig = VITAL_TYPE_CONFIGS[primary];
          if (!pSeries || !pConfig) return null;

          const overlay = visible.length > 1 ? series.get(visible[1]) : undefined;
          const overlayConfig = visible.length > 1 ? VITAL_TYPE_CONFIGS[visible[1]] : undefined;

          return (
            <LabTimeSeriesChart
              data={pSeries.values}
              rangeLow={pConfig.normalRange[0]}
              rangeHigh={pConfig.normalRange[1]}
              unit={pConfig.unit}
              color={GRID_COLORS[primary]}
              overlayData={overlay?.values}
              overlayLabel={overlayConfig?.label}
              overlayColor={GRID_COLORS[visible[1]] ?? '#8A857D'}
            />
          );
        })()}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/VitalsMonitorGrid.tsx
git commit -m "feat(morpheus): add VitalsMonitorGrid with bedside monitor layout and timeline"
```

---

## Phase 6: Microbiology — Antibiogram Heatmap

### Task 17: AntibiogramHeatmap Component

**Files:**
- Create: `frontend/src/features/morpheus/components/AntibiogramHeatmap.tsx`

- [ ] **Step 1: Create the antibiogram heatmap**

```typescript
// frontend/src/features/morpheus/components/AntibiogramHeatmap.tsx
import { useMemo, useState } from 'react';
import type { MorpheusMicrobiology } from '../api';
import { sortAntibioticsByClass } from '../constants/antibioticClasses';
import HoverCard from './HoverCard';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface AntibiogramHeatmapProps {
  data: MorpheusMicrobiology[];
  onOrganismClick: (event: DrawerEvent) => void;
}

const INTERP_COLORS: Record<string, string> = {
  S: '#22C55E',
  I: '#EAB308',
  R: '#E85A6B',
};

interface CellData {
  interpretation: string;
  mic: string | null;
  specimen: string;
  date: string;
}

export default function AntibiogramHeatmap({ data, onOrganismClick }: AntibiogramHeatmapProps) {
  const [specimenFilter, setSpecimenFilter] = useState<string>('');
  const [showTestedOnly, setShowTestedOnly] = useState(true);

  const specimens = useMemo(() => {
    const set = new Set<string>();
    for (const d of data) set.add(d.spec_type_desc);
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!specimenFilter) return data;
    return data.filter((d) => d.spec_type_desc === specimenFilter);
  }, [data, specimenFilter]);

  const { organisms, antibiotics, matrix } = useMemo(() => {
    // Count organisms by frequency
    const orgCount = new Map<string, number>();
    const abSet = new Set<string>();
    const cellMap = new Map<string, CellData>();

    for (const d of filtered) {
      if (!d.org_name || !d.ab_name || !d.interpretation) continue;
      orgCount.set(d.org_name, (orgCount.get(d.org_name) ?? 0) + 1);
      abSet.add(d.ab_name);
      const key = `${d.org_name}::${d.ab_name}`;
      cellMap.set(key, {
        interpretation: d.interpretation,
        mic: d.dilution_comparison && d.dilution_value ? `${d.dilution_comparison}${d.dilution_value}` : null,
        specimen: d.spec_type_desc,
        date: d.chartdate,
      });
    }

    const orgs = Array.from(orgCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const abs = sortAntibioticsByClass(Array.from(abSet));

    return { organisms: orgs, antibiotics: abs, matrix: cellMap };
  }, [filtered]);

  if (organisms.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No antibiogram data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={specimenFilter}
          onChange={(e) => setSpecimenFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-[#C5C0B8] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
        >
          <option value="">All specimens</option>
          {specimens.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[#8A857D] cursor-pointer">
          <input
            type="checkbox"
            checked={showTestedOnly}
            onChange={() => setShowTestedOnly(!showTestedOnly)}
            className="w-3 h-3 rounded"
          />
          Show tested only
        </label>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
        <table className="text-[10px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-zinc-900 px-2 py-1 text-left text-[#8A857D] font-semibold min-w-[160px]">Organism</th>
              {antibiotics.map((ab) => (
                <th key={ab} className="px-1 py-1 font-normal text-[#8A857D] whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80 }}>
                  {ab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {organisms.map((org) => (
              <tr key={org} className="hover:bg-[#1A1A1E]">
                <td className="sticky left-0 bg-zinc-950/70 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => onOrganismClick({
                      domain: 'microbiology',
                      concept_id: null,
                      concept_name: org,
                      source_code: null,
                      source_vocabulary: 'MIMIC-IV microbiologyevents',
                      standard_concept_name: null,
                      start_date: null, end_date: null,
                      value: null, unit: null, ref_range_lower: null, ref_range_upper: null,
                      route: null, dose: null, days_supply: null, seq_num: null, hadm_id: null,
                      occurrenceCount: filtered.filter((d) => d.org_name === org).length,
                      sparklineValues: [],
                    })}
                    className="text-left text-[#C5C0B8] hover:text-[#2DD4BF] transition-colors truncate max-w-[160px] block"
                  >
                    {org}
                  </button>
                </td>
                {antibiotics.map((ab) => {
                  const key = `${org}::${ab}`;
                  const cell = matrix.get(key);
                  if (!cell && showTestedOnly) {
                    return <td key={ab} />;
                  }
                  if (!cell) {
                    return <td key={ab} className="px-1 py-1 text-center text-[#323238]">\u2014</td>;
                  }
                  const color = INTERP_COLORS[cell.interpretation] ?? '#5A5650';
                  return (
                    <td key={ab} className="px-1 py-1 text-center">
                      <HoverCard content={
                        <div className="space-y-1">
                          <div className="font-semibold text-[#F0EDE8]">{org}</div>
                          <div>{ab}: <strong style={{ color }}>{cell.interpretation}</strong></div>
                          {cell.mic && <div>MIC: {cell.mic}</div>}
                          <div>{cell.specimen} \u2022 {cell.date}</div>
                        </div>
                      }>
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold cursor-default"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {cell.interpretation}
                        </span>
                      </HoverCard>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/AntibiogramHeatmap.tsx
git commit -m "feat(morpheus): add AntibiogramHeatmap with S/I/R matrix and specimen filters"
```

---

### Task 18: CultureTable Component

**Files:**
- Create: `frontend/src/features/morpheus/components/CultureTable.tsx`

- [ ] **Step 1: Create the enhanced culture table**

```typescript
// frontend/src/features/morpheus/components/CultureTable.tsx
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MorpheusMicrobiology } from '../api';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface CultureTableProps {
  data: MorpheusMicrobiology[];
  onOrganismClick: (event: DrawerEvent) => void;
}

const INTERP_COLORS: Record<string, { bg: string; text: string }> = {
  S: { bg: 'bg-green-500/10', text: 'text-green-400' },
  I: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  R: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

interface CultureGroup {
  key: string;
  specimen: string;
  date: string;
  organism: string | null;
  sensitivities: MorpheusMicrobiology[];
}

export default function CultureTable({ data, onOrganismClick }: CultureTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, CultureGroup>();
    for (const d of data) {
      const key = `${d.chartdate}-${d.spec_type_desc}-${d.org_name ?? 'no-org'}`;
      const existing = map.get(key);
      if (existing) {
        if (d.ab_name) existing.sensitivities.push(d);
      } else {
        map.set(key, {
          key,
          specimen: d.spec_type_desc,
          date: d.chartdate,
          organism: d.org_name,
          sensitivities: d.ab_name ? [d] : [],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No culture data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 divide-y divide-zinc-800">
      {groups.map((g) => {
        const isExpanded = expandedKey === g.key;
        const sCount = g.sensitivities.filter((s) => s.interpretation === 'S').length;
        const iCount = g.sensitivities.filter((s) => s.interpretation === 'I').length;
        const rCount = g.sensitivities.filter((s) => s.interpretation === 'R').length;

        return (
          <div key={g.key}>
            <button
              type="button"
              onClick={() => setExpandedKey(isExpanded ? null : g.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A1A1E] transition-colors text-left focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
            >
              <ChevronDown size={12} className={`text-[#5A5650] transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              <span className="text-xs text-[#8A857D] shrink-0 w-20">{g.date}</span>
              <span className="text-xs text-[#C5C0B8] shrink-0 w-32 truncate">{g.specimen}</span>
              {g.organism ? (
                <span
                  className="text-xs text-[#F472B6] hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrganismClick({
                      domain: 'microbiology', concept_id: null, concept_name: g.organism!,
                      source_code: null, source_vocabulary: 'MIMIC-IV', standard_concept_name: null,
                      start_date: g.date, end_date: null, value: null, unit: null,
                      ref_range_lower: null, ref_range_upper: null, route: null, dose: null,
                      days_supply: null, seq_num: null, hadm_id: null,
                      occurrenceCount: data.filter((d) => d.org_name === g.organism).length,
                      sparklineValues: [],
                    });
                  }}
                >
                  {g.organism}
                </span>
              ) : (
                <span className="text-xs text-[#5A5650]">No growth</span>
              )}
              {g.sensitivities.length > 0 && (
                <div className="flex items-center gap-1.5 ml-auto text-[10px]">
                  {sCount > 0 && <span className="px-1.5 rounded bg-green-500/10 text-green-400">S:{sCount}</span>}
                  {iCount > 0 && <span className="px-1.5 rounded bg-yellow-500/10 text-yellow-400">I:{iCount}</span>}
                  {rCount > 0 && <span className="px-1.5 rounded bg-red-500/10 text-red-400">R:{rCount}</span>}
                </div>
              )}
            </button>

            {isExpanded && g.sensitivities.length > 0 && (
              <div className="px-8 pb-3">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-[#5A5650] uppercase tracking-wider">
                      <th className="text-left py-1">Antibiotic</th>
                      <th className="text-center py-1 w-16">Result</th>
                      <th className="text-left py-1">MIC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {g.sensitivities.map((s, i) => {
                      const style = INTERP_COLORS[s.interpretation ?? ''];
                      return (
                        <tr key={i} className="hover:bg-[#1A1A1E]">
                          <td className="py-1 text-[#C5C0B8]">{s.ab_name}</td>
                          <td className="py-1 text-center">
                            {s.interpretation && style ? (
                              <span className={`inline-block px-1.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                                {s.interpretation}
                              </span>
                            ) : (
                              <span className="text-[#5A5650]">\u2014</span>
                            )}
                          </td>
                          <td className="py-1 text-[#8A857D] font-mono">
                            {s.dilution_comparison && s.dilution_value
                              ? `${s.dilution_comparison}${s.dilution_value}`
                              : '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/CultureTable.tsx
git commit -m "feat(morpheus): add CultureTable with grouped specimens and expandable sensitivities"
```

---

## Phase 7: Gold Standard Polish — Component Upgrades

### Task 19: Upgrade MetricCard (Clickable)

**Files:**
- Modify: `frontend/src/features/morpheus/components/MetricCard.tsx`

- [ ] **Step 1: Add onClick and hover states**

Replace the entire MetricCard.tsx content:

```typescript
import { type MouseEventHandler } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  onClick?: MouseEventHandler;
}

export default function MetricCard({ label, value, color = '#2DD4BF', subtext, onClick }: MetricCardProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 flex flex-col gap-1 transition-colors ${onClick ? 'cursor-pointer hover:bg-[#1A1A1E]' : ''}`}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent); } : undefined}
    >
      <span className="text-2xl font-bold text-[#F0EDE8]">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-[#5A5650]">{label}</span>
      {subtext && <span className="text-[10px] text-[#5A5650]">{subtext}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/MetricCard.tsx
git commit -m "feat(morpheus): make MetricCard clickable with hover states and keyboard support"
```

---

### Task 20: Upgrade EventCountBar (Clickable, Domain Colors)

**Files:**
- Modify: `frontend/src/features/morpheus/components/EventCountBar.tsx`

- [ ] **Step 1: Update colors and add onClick**

Replace the entire EventCountBar.tsx content:

```typescript
import type { MorpheusEventCounts } from '../api';
import { DOMAIN_COLORS } from '../constants/domainColors';

interface EventCountBarProps {
  counts: MorpheusEventCounts;
  onDomainClick?: (domain: string) => void;
}

const DOMAIN_CONFIG = [
  { key: 'admissions', label: 'Admissions', color: DOMAIN_COLORS.admission },
  { key: 'icu_stays', label: 'ICU Stays', color: '#9B1B30' },
  { key: 'transfers', label: 'Transfers', color: DOMAIN_COLORS.visit },
  { key: 'diagnoses', label: 'Diagnoses', color: DOMAIN_COLORS.diagnosis },
  { key: 'procedures', label: 'Procedures', color: DOMAIN_COLORS.procedure },
  { key: 'prescriptions', label: 'Medications', color: DOMAIN_COLORS.drug },
  { key: 'lab_results', label: 'Labs', color: DOMAIN_COLORS.lab },
  { key: 'vitals', label: 'Vitals', color: DOMAIN_COLORS.vital },
  { key: 'input_events', label: 'Inputs', color: '#06B6D4' },
  { key: 'output_events', label: 'Outputs', color: '#A855F7' },
  { key: 'microbiology', label: 'Micro', color: DOMAIN_COLORS.microbiology },
] as const;

export default function EventCountBar({ counts, onDomainClick }: EventCountBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {DOMAIN_CONFIG.map(({ key, label, color }) => {
        const count = counts[key] ?? 0;
        if (count === 0) return null;
        const isClickable = !!onDomainClick;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onDomainClick?.(key)}
            disabled={!isClickable}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-950/70 shrink-0 transition-colors
              ${isClickable ? 'cursor-pointer hover:bg-[#1A1A1E]' : ''}
              focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-[#8A857D]">{label}</span>
            <span className="text-[11px] font-semibold text-[#F0EDE8]">{count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/EventCountBar.tsx
git commit -m "feat(morpheus): make EventCountBar clickable with consistent domain colors"
```

---

### Task 21: GroupedDiagnosisList Component

**Files:**
- Create: `frontend/src/features/morpheus/components/GroupedDiagnosisList.tsx`

- [ ] **Step 1: Create the grouped diagnosis component**

```typescript
// frontend/src/features/morpheus/components/GroupedDiagnosisList.tsx
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MorpheusDiagnosis } from '../api';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface GroupedDiagnosisListProps {
  diagnoses: MorpheusDiagnosis[];
  onConceptClick: (event: DrawerEvent) => void;
}

interface DiagnosisGroup {
  icd_code: string;
  icd_version: string;
  description: string;
  concept_id: number | null;
  standard_concept_name: string | null;
  occurrences: MorpheusDiagnosis[];
}

export default function GroupedDiagnosisList({ diagnoses, onConceptClick }: GroupedDiagnosisListProps) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, DiagnosisGroup>();
    for (const dx of diagnoses) {
      const key = `${dx.icd_code}-${dx.icd_version}`;
      const existing = map.get(key);
      if (existing) {
        existing.occurrences.push(dx);
      } else {
        map.set(key, {
          icd_code: dx.icd_code,
          icd_version: dx.icd_version,
          description: dx.description || '\u2014',
          concept_id: dx.concept_id ?? null,
          standard_concept_name: dx.standard_concept_name ?? null,
          occurrences: [dx],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.occurrences.length - a.occurrences.length);
  }, [diagnoses]);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No diagnoses recorded</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 divide-y divide-zinc-800">
      {groups.map((g) => {
        const key = `${g.icd_code}-${g.icd_version}`;
        const isExpanded = expandedCode === key;
        const count = g.occurrences.length;

        return (
          <div key={key}>
            <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A1A1E] transition-colors">
              {count > 1 && (
                <button type="button" onClick={() => setExpandedCode(isExpanded ? null : key)}
                  className="focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30 rounded">
                  <ChevronDown size={12} className={`text-[#5A5650] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
              {count === 1 && <span className="w-3" />}

              <button
                type="button"
                onClick={() => onConceptClick({
                  domain: 'diagnosis',
                  concept_id: g.concept_id,
                  concept_name: g.description,
                  source_code: g.icd_code,
                  source_vocabulary: `ICD${g.icd_version}`,
                  standard_concept_name: g.standard_concept_name,
                  start_date: null, end_date: null,
                  value: null, unit: null, ref_range_lower: null, ref_range_upper: null,
                  route: null, dose: null, days_supply: null,
                  seq_num: g.occurrences[0]?.seq_num != null ? Number(g.occurrences[0].seq_num) : null,
                  hadm_id: g.occurrences[0]?.hadm_id ?? null,
                  occurrenceCount: count,
                  sparklineValues: [],
                })}
                className="font-mono text-xs text-[#C9A227] hover:text-[#F0EDE8] transition-colors focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30 rounded"
              >
                {g.icd_code}
              </button>
              <span className="text-xs text-[#5A5650]">v{g.icd_version}</span>
              <span className="text-xs text-[#C5C0B8] truncate flex-1">{g.description}</span>

              {g.concept_id ? (
                <span className="text-xs text-[#2DD4BF] shrink-0">{g.standard_concept_name}</span>
              ) : (
                <span className="text-[10px] text-[#5A5650] shrink-0">unmapped</span>
              )}

              {count > 1 && (
                <span className="text-[10px] font-semibold text-[#8A857D] shrink-0">\u00D7{count}</span>
              )}
            </div>

            {isExpanded && count > 1 && (
              <div className="px-8 pb-2">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-[#5A5650] uppercase tracking-wider">
                      <th className="text-left py-1">Admission</th>
                      <th className="text-left py-1">Sequence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {g.occurrences.map((dx, i) => (
                      <tr key={i} className="hover:bg-[#1A1A1E]">
                        <td className="py-1 font-mono text-[#2DD4BF]">{dx.hadm_id}</td>
                        <td className="py-1 text-[#8A857D]">#{dx.seq_num}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/GroupedDiagnosisList.tsx
git commit -m "feat(morpheus): add GroupedDiagnosisList with deduplication and expandable occurrences"
```

---

### Task 22: SearchDropdown Component

**Files:**
- Create: `frontend/src/features/morpheus/components/SearchDropdown.tsx`

- [ ] **Step 1: Create the enhanced search dropdown**

```typescript
// frontend/src/features/morpheus/components/SearchDropdown.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useMorpheusPatientSearch } from '../api';

interface SearchDropdownProps {
  dataset?: string;
  onSelect: (subjectId: string) => void;
}

export default function SearchDropdown({ dataset, onSelect }: SearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: results, isLoading } = useMorpheusPatientSearch(debouncedQuery, dataset);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length >= 1) setIsOpen(true);
    else setIsOpen(false);
    setSelectedIdx(-1);
  }, [debouncedQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!results) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) {
      onSelect(results[selectedIdx].subject_id);
      setIsOpen(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [results, selectedIdx, onSelect]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (debouncedQuery.length >= 1) setIsOpen(true); }}
          placeholder="Search by Subject ID..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-[#C5C0B8] placeholder:text-[#5A5650] focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/50 focus:border-[#9B1B30]"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[#323238] bg-[#1A1A1E] shadow-xl z-30 max-h-64 overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-4 text-center text-xs text-[#8A857D]">Searching...</div>
          )}
          {!isLoading && results && results.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-[#8A857D]">No patients found</div>
          )}
          {results?.map((p, i) => (
            <button
              key={p.subject_id}
              type="button"
              onClick={() => { onSelect(p.subject_id); setIsOpen(false); setQuery(''); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                ${i === selectedIdx ? 'bg-[#2DD4BF]/10' : 'hover:bg-[#1A1A1E]'}
                focus:outline-none`}
            >
              <span className="font-mono text-sm text-[#2DD4BF]">{p.subject_id}</span>
              <span className="text-xs text-[#8A857D]">{p.gender}</span>
              <span className="text-xs text-[#8A857D]">Age {p.anchor_age ?? '\u2014'}</span>
              <span className="text-xs text-[#5A5650] ml-auto">{p.admission_count} adm</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/morpheus/components/SearchDropdown.tsx
git commit -m "feat(morpheus): add SearchDropdown with debounced search and keyboard navigation"
```

---

## Phase 8: Wire Everything Together

### Task 23: Wire Labs, Vitals, Microbiology, and Drawer into PatientJourneyPage

**Files:**
- Modify: `frontend/src/features/morpheus/pages/PatientJourneyPage.tsx`

This is the integration task — wiring all new components into the existing page. The page currently has 6 tabs but Labs, Vitals are placeholders and Microbiology is a basic table.

- [ ] **Step 1: Add imports to PatientJourneyPage.tsx**

Add these imports at the top of PatientJourneyPage.tsx:

```typescript
import LabPanelDashboard from '../components/LabPanelDashboard';
import VitalsMonitorGrid from '../components/VitalsMonitorGrid';
import AntibiogramHeatmap from '../components/AntibiogramHeatmap';
import CultureTable from '../components/CultureTable';
import ConceptDetailDrawer, { type DrawerEvent } from '../components/ConceptDetailDrawer';
import GroupedDiagnosisList from '../components/GroupedDiagnosisList';
import EventCountBar from '../components/EventCountBar';
import ExportButton from '../components/ExportButton';
import TruncationWarning from '../components/TruncationWarning';
import SearchDropdown from '../components/SearchDropdown';
```

- [ ] **Step 2: Add drawer state**

Inside the component, add state for the drawer:

```typescript
const [drawerEvent, setDrawerEvent] = useState<DrawerEvent | null>(null);
```

- [ ] **Step 3: Replace Labs tab placeholder**

Find the Labs tab content (currently shows "coming next iteration" placeholder) and replace with:

```tsx
{viewMode === 'labs' && subjectId && (
  <>
    {labsData && eventCounts && (
      <TruncationWarning loaded={labsData.length} total={eventCounts.lab_results ?? labsData.length} domain="lab results" />
    )}
    {labsLoading ? (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    ) : labsData ? (
      <div>
        <div className="flex justify-end mb-2">
          <ExportButton data={labsData} filename={`morpheus-labs-${subjectId}`} />
        </div>
        <LabPanelDashboard labs={labsData} onConceptClick={setDrawerEvent} />
      </div>
    ) : null}
  </>
)}
```

- [ ] **Step 4: Replace Vitals tab placeholder**

Replace the Vitals tab placeholder with:

```tsx
{viewMode === 'vitals' && subjectId && (
  <>
    {vitalsLoading ? (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    ) : vitalsData ? (
      <div>
        <div className="flex justify-end mb-2">
          <ExportButton data={vitalsData} filename={`morpheus-vitals-${subjectId}`} />
        </div>
        <VitalsMonitorGrid vitals={vitalsData} />
      </div>
    ) : null}
  </>
)}
```

- [ ] **Step 5: Replace Microbiology tab with heatmap + culture table**

Replace the existing Microbiology table with:

```tsx
{viewMode === 'microbiology' && subjectId && (
  <>
    {microLoading ? (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    ) : microData ? (
      <div className="space-y-6">
        <div className="flex justify-end">
          <ExportButton data={microData} filename={`morpheus-micro-${subjectId}`} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">Antibiogram</h3>
          <AntibiogramHeatmap data={microData} onOrganismClick={setDrawerEvent} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">Culture Results</h3>
          <CultureTable data={microData} onOrganismClick={setDrawerEvent} />
        </div>
      </div>
    ) : null}
  </>
)}
```

- [ ] **Step 6: Replace DiagnosisList with GroupedDiagnosisList**

Find where DiagnosisList is rendered and replace with:

```tsx
<GroupedDiagnosisList diagnoses={diagnosesData ?? []} onConceptClick={setDrawerEvent} />
```

- [ ] **Step 7: Wire EventCountBar onClick to tab switching**

Update the EventCountBar usage to add domain click handler:

```tsx
<EventCountBar
  counts={eventCounts}
  onDomainClick={(domain) => {
    const tabMap: Record<string, string> = {
      diagnoses: 'diagnoses', prescriptions: 'medications',
      lab_results: 'labs', vitals: 'vitals', microbiology: 'microbiology',
    };
    const tab = tabMap[domain];
    if (tab) setViewMode(tab);
  }}
/>
```

- [ ] **Step 8: Add CSV export to patient list (browse mode)**

In the browse mode section (when `!subjectId`), add an ExportButton above the patient table:

```tsx
<ExportButton data={patientsData?.data ?? []} filename="morpheus-patient-list" />
```

- [ ] **Step 9: Wire medication clicks to ConceptDetailDrawer**

In the Medications tab section, update the MedicationTimeline component to accept an `onDrugClick` prop. When a medication bar is clicked, create a DrawerEvent:

```tsx
onDrugClick={(med: MorpheusMedication) => setDrawerEvent({
  domain: 'medication',
  concept_id: null,
  concept_name: med.drug,
  source_code: null,
  source_vocabulary: 'MIMIC-IV prescriptions',
  standard_concept_name: null,
  start_date: med.starttime,
  end_date: med.stoptime,
  value: null, unit: null, ref_range_lower: null, ref_range_upper: null,
  route: med.route,
  dose: `${med.dose_val_rx} ${med.dose_unit_rx}`,
  days_supply: null,
  seq_num: null,
  hadm_id: med.hadm_id,
  occurrenceCount: medicationsData?.filter((m) => m.drug === med.drug).length ?? 1,
  sparklineValues: [],
})}
```

- [ ] **Step 10: Render the ConceptDetailDrawer**

Add at the end of the component's return (inside the outermost fragment):

```tsx
<ConceptDetailDrawer event={drawerEvent} onClose={() => setDrawerEvent(null)} dataset={dataset} />
```

**NOTE for implementor:** The existing PatientJourneyPage uses TanStack Query hooks directly (e.g., `const { data: labsData, isLoading: labsLoading } = useMorpheusLabResults(...)` or similar patterns via query objects). Adapt the variable names in Steps 3-7 to match the existing destructuring pattern in the file. Import `Loader2` from `lucide-react`. For the `setViewMode` tabMap, type it as `Record<string, typeof viewMode>` or use a type assertion to match the ViewMode type.

- [ ] **Step 11: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 12: Run frontend tests**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: All existing tests pass

- [ ] **Step 13: Commit**

```bash
git add frontend/src/features/morpheus/pages/PatientJourneyPage.tsx
git commit -m "feat(morpheus): wire Labs, Vitals, Microbiology, Drawer, and polish into PatientJourneyPage"
```

---

### Task 24: Upgrade Dashboard Charts with HoverCards

**Files:**
- Modify: `frontend/src/features/morpheus/pages/MorpheusDashboardPage.tsx`
- Modify: `frontend/src/features/morpheus/components/TrendChart.tsx`
- Modify: `frontend/src/features/morpheus/components/HorizontalBarChart.tsx`
- Modify: `frontend/src/features/morpheus/components/DonutChart.tsx`
- Modify: `frontend/src/features/morpheus/components/DistributionChart.tsx`

This task adds HoverCard tooltips to all dashboard charts and makes MetricCards clickable to navigate to filtered patient journey views.

- [ ] **Step 1: Update MorpheusDashboardPage to make MetricCards clickable**

Add navigation imports and onClick handlers to each MetricCard:

```typescript
import { useNavigate } from 'react-router-dom';
// ...
const navigate = useNavigate();
// ...
<MetricCard label="ICU Admission Rate" value={...} onClick={() => navigate(`/morpheus/journey?icu=true&dataset=${dataset}`)} />
<MetricCard label="Mortality Rate" value={...} onClick={() => navigate(`/morpheus/journey?deceased=true&dataset=${dataset}`)} />
// etc. for each metric
```

- [ ] **Step 2: Update TrendChart to use HoverCard on bars**

Import HoverCard and wrap each `<rect>` bar element with a HoverCard showing month, value, and rate details.

- [ ] **Step 3: Update HorizontalBarChart to use HoverCard**

Wrap each bar with HoverCard showing label, sublabel, and value.

- [ ] **Step 4: Update DonutChart to use HoverCard**

Wrap each arc path with HoverCard showing category, count, and percentage.

- [ ] **Step 5: Update DistributionChart to use HoverCard**

Wrap each bar with HoverCard showing bucket name and count.

- [ ] **Step 6: Add opacity hover effect to all chart bars**

Add `opacity={0.7}` default with `onMouseEnter` → `opacity=1` pattern (or use CSS):

```tsx
className="transition-opacity opacity-70 hover:opacity-100"
```

- [ ] **Step 7: Verify compiles and test**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run --reporter=verbose 2>&1 | tail -30`

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/morpheus/pages/MorpheusDashboardPage.tsx frontend/src/features/morpheus/components/TrendChart.tsx frontend/src/features/morpheus/components/HorizontalBarChart.tsx frontend/src/features/morpheus/components/DonutChart.tsx frontend/src/features/morpheus/components/DistributionChart.tsx
git commit -m "feat(morpheus): add HoverCard tooltips and clickable MetricCards to dashboard"
```

---

### Task 25: Upgrade LocationTrack and MedicationTimeline

**Files:**
- Modify: `frontend/src/features/morpheus/components/LocationTrack.tsx`
- Modify: `frontend/src/features/morpheus/components/MedicationTimeline.tsx`

- [ ] **Step 1: Replace `title` attributes with HoverCard in LocationTrack**

Import HoverCard and wrap each transfer segment with structured tooltip content (unit name, care unit type, in/out datetime, duration).

- [ ] **Step 2: Add keyboard navigation to LocationTrack**

Add `tabIndex={0}` and `onKeyDown` handler for Arrow Left/Right (pan) and +/- (zoom).

- [ ] **Step 3: Replace `title` attributes with HoverCard in MedicationTimeline**

Same pattern — wrap each medication bar with HoverCard showing drug name, route, dose, start/stop, duration.

- [ ] **Step 4: Add keyboard navigation to MedicationTimeline**

Same Arrow/zoom pattern.

- [ ] **Step 5: Add focus indicators to both components**

Add `focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30` to the container divs.

- [ ] **Step 6: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/morpheus/components/LocationTrack.tsx frontend/src/features/morpheus/components/MedicationTimeline.tsx
git commit -m "feat(morpheus): add HoverCards and keyboard navigation to LocationTrack and MedicationTimeline"
```

---

### Task 26: Typography and Focus Consistency Pass

**Files:**
- Modify: Multiple components for consistent styling

- [ ] **Step 1: Update FilterBar focus indicators**

Add `focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 focus:border-[#9B1B30]` to all inputs in FilterBar.tsx.

- [ ] **Step 2: Update DatasetSelector focus indicators**

Add focus ring styles to the select element.

- [ ] **Step 3: Update AdmissionPicker focus and keyboard**

Add focus rings to admission buttons and ensure Tab navigation works.

- [ ] **Step 4: Update text color hierarchy across components**

Ensure consistent usage:
- Primary text: `text-[#F0EDE8]` (not `text-zinc-100`)
- Secondary: `text-[#C5C0B8]` (not `text-zinc-300`)
- Tertiary: `text-[#8A857D]` (not `text-zinc-500`)
- Disabled: `text-[#5A5650]` (not `text-zinc-600`)
- Data codes: `text-[#2DD4BF] font-mono`

- [ ] **Step 5: Verify compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 6: Run all frontend tests**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run --reporter=verbose 2>&1 | tail -30`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/morpheus/
git commit -m "feat(morpheus): typography and focus indicator consistency pass"
```

---

### Task 27: Final Integration Test

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty`
Expected: Zero errors

- [ ] **Step 2: Run full frontend test suite**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run backend tests for Morpheus**

Run: `cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Feature/Api/V1/MorpheusDashboardTest.php -v`
Expected: All tests pass including new concept-stats tests

- [ ] **Step 4: Run ESLint**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx eslint src/features/morpheus/ 2>&1 | tail -20`
Expected: No errors (warnings acceptable)

- [ ] **Step 5: Verify frontend build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add frontend/src/features/morpheus/ backend/app/Services/Morpheus/ backend/app/Http/Controllers/Api/V1/MorpheusDashboardController.php backend/routes/api.php backend/tests/Feature/Api/V1/MorpheusDashboardTest.php && git commit -m "fix(morpheus): address lint and build issues from overhaul"
```
