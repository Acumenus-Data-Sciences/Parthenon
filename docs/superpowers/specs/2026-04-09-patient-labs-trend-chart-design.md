# Patient Labs Panel — Trend Chart with Reference Ranges

**Date:** 2026-04-09
**Author:** Dr. Sanjay Udoshi (with Claude)
**Status:** DESIGN (awaiting user review before implementation planning)
**Module:** Patient Profiles
**Related files:**
- `frontend/src/features/profiles/components/PatientLabPanel.tsx`
- `backend/app/Services/Analysis/PatientProfileService.php`
- `backend/app/Http/Controllers/Api/V1/PatientProfileController.php`

---

## 1. Problem Statement

The Labs Panel on the Patient Profile page (`PatientLabPanel.tsx`) has two user-visible defects and a UX shortcoming:

1. **Ranges column is empty** — the expanded lab table shows dashes for reference ranges.
2. **Status column is empty** — nothing classifies a value as Low / Normal / High.
3. **Tabular presentation obscures trends** — a clinician reading a patient chart wants to see a value's trajectory over time at a glance, not parse a column of numbers.

### Root cause (empirical)

The Parthenon ETL does not populate OMOP `measurement.range_low` / `range_high` for the vast majority of data:

| Source | Row count | `range_low` populated | Coverage |
|---|---:|---:|---:|
| `omop` (Acumenus) | 710,965,770 | 0 | 0.00% |
| `synpuf` | 69,816,562 | 0 | 0.00% |
| `irsf` | 370,581 | 0 | 0.00% |
| `pancreas` | 185,455 | 184,011 | 99.22% |

The frontend code is already wired to render ranges and status (lines 198-223 of `PatientLabPanel.tsx`) — it is correctly showing "nothing" because the data layer returns nothing. The status classification is impossible without a range.

This is therefore **not** a UI bug. It is a missing data-layer capability: Parthenon has no source of reference ranges independent of what the ETL imports from source systems.

### What the user wants

> Instead of listing the values as a table it would be far more informative to show a line graph with a ranges box in the background, similar to what we have in Aurora.

Two work items rolled into one:

1. **Data** — give measurements a reference range to compare against.
2. **UI** — replace the expanded-row table with a line graph that shades that range in the background.

---

## 2. Goals & Non-Goals

### Goals

- Every common lab rendered on a Patient Profile has a reference range and a Low/Normal/High status.
- Curated ranges (authoritative clinical references) apply where available; a population-derived fallback covers uncurated labs.
- The expanded lab view shows a Recharts line chart with the reference range shaded as a background band.
- The collapsed sparkline and status indicator (which already exist in the component) finally light up with real data.
- Users who want the raw value list can still see it via a "Show values" toggle.
- The clinician always knows whether the range shown is curated or population-derived.
- No mutation of OMOP CDM data. All new data lives in the Laravel-owned `app` schema.

### Non-Goals

- Modal/drawer deep-dive view for labs (considered and deferred — can be a follow-up if the inline chart is insufficient).
- Unit conversion (mg/dL ↔ mmol/L etc.) — sampling shows Parthenon sources use consistent US-conventional units; unnecessary for v1.
- Multi-lab overlay (plotting Hgb and Hct together).
- Time-range filter controls (3mo / 6mo / 1y / all) — existing 500-row limit is sufficient for v1.
- CSV export of lab values.
- Critical-value alerting / notifications (flag is displayed; no push).
- ETL-level backfill of `omop.measurement.range_low` / `range_high` — HIGHSEC §3.2 forbids mutation of CDM schemas.
- Changes to `imaging/MeasurementTrendChart.tsx` (tumor measurements, not labs) or `morpheus/LabTimeSeriesChart.tsx` (Morpheus-owned).

---

## 3. Architecture Overview

Three layers, one vertical slice.

```
┌──────────────────────────────────────────────────────────────┐
│  PatientLabPanel.tsx (React)                                 │
│    ├─ collapsed row: sparkline + status indicator            │
│    └─ expanded row: <LabTrendChart/> + "Show values" toggle  │
│                                 │                             │
└─────────────────────────────────┼─────────────────────────────┘
                                  │  GET /profiles/{id}
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│  PatientProfileController::show → PatientProfileService     │
│    getMeasurements() → groups by (concept_id, unit_concept_id)│
│    LabReferenceRangeService::lookupMany()                    │
│    LabStatusClassifier::classify()                           │
│    returns clinicalEvents[] + labGroups[]                    │
└─────────────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│  Data (app schema, Laravel-owned)                            │
│    app.lab_reference_range_curated    (~250 rows, YAML seed) │
│    app.lab_reference_range_population (computed per source)  │
│                                                               │
│  Data (CDM schemas, read-only)                                │
│    {source}.measurement — source of truth for values         │
│    vocab.concept         — LOINC + UCUM resolution            │
└──────────────────────────────────────────────────────────────┘
```

### Lookup strategy

**Hybrid — curated authoritative, population fallback:**

1. **Curated** — hand-seeded from clinical references (Mayo Clinic Path Handbook, LOINC, MSKCC, etc.), sex- and age-stratified where clinically relevant. ~170 labs, ~250 rows. Authoritative when a match exists.
2. **Population** — P2.5/P97.5 percentiles computed per `(source_id, measurement_concept_id, unit_concept_id)` via Artisan command at deploy time. Fills gaps for any lab the curated table doesn't cover.
3. **Null** — no range available → chart renders line only, no band; Status = `—`.

Per-source population scoping (rather than global) is clinically honest: SynPUF's Medicare-elderly cohort and IRSF's rare-disease cohort should have different "expected" bands than a general outpatient population. Mixing them by pooling would bias every lab toward whichever source has the most rows (SynPUF dominates at 69M).

### Backward compatibility

The existing `clinicalEvents` array in the `GET /profiles/{id}` response is unchanged. A new `labGroups` field is added alongside. Any other consumer of `clinicalEvents` (dashboards, study-agent, downstream analytics) continues to work without modification.

---

## 4. Data Model

### Table 1 — `app.lab_reference_range_curated`

Migration (`create_lab_reference_range_curated_table`):

```php
Schema::connection('pgsql')->create('lab_reference_range_curated', function (Blueprint $t) {
    $t->id();
    $t->unsignedInteger('measurement_concept_id')->index();
    $t->unsignedInteger('unit_concept_id')->index();
    $t->char('sex', 1);                       // 'M','F','A' (A = any)
    $t->unsignedSmallInteger('age_low')->nullable();
    $t->unsignedSmallInteger('age_high')->nullable();
    $t->decimal('range_low', 12, 4);
    $t->decimal('range_high', 12, 4);
    $t->string('source_ref', 64);             // 'LOINC','Mayo','MSKCC', etc.
    $t->text('notes')->nullable();
    $t->timestamps();
    $t->unique(
        ['measurement_concept_id','unit_concept_id','sex','age_low','age_high'],
        'lrr_curated_uniq'
    );
});
```

Seeded from `backend/database/seeders/data/lab_reference_ranges.yaml` via `LabReferenceRangeSeeder`. Idempotent upsert on the unique key.

### Table 2 — `app.lab_reference_range_population`

Migration (`create_lab_reference_range_population_table`):

```php
Schema::connection('pgsql')->create('lab_reference_range_population', function (Blueprint $t) {
    $t->id();
    $t->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
    $t->unsignedInteger('measurement_concept_id');
    $t->unsignedInteger('unit_concept_id');
    $t->decimal('range_low', 12, 4);          // P2.5
    $t->decimal('range_high', 12, 4);         // P97.5
    $t->decimal('median', 12, 4)->nullable(); // P50, informational
    $t->unsignedBigInteger('n_observations');
    $t->timestamp('computed_at');
    $t->timestamps();
    $t->unique(
        ['source_id','measurement_concept_id','unit_concept_id'],
        'lrr_pop_uniq'
    );
});
```

Populated by `php artisan labs:compute-reference-ranges`.

### Schema placement

Both tables live in the default `pgsql` connection (`app` schema). This is the only schema Laravel is allowed to mutate under HIGHSEC §3.2 and the memory note `feedback_schema_authority_laravel.md`. CDM schemas stay read-only.

### Seed file format

`backend/database/seeders/data/lab_reference_ranges.yaml`:

```yaml
# Hemoglobin (mass/volume, blood)
- loinc: "718-7"
  unit_ucum: "g/dL"                 # seeder resolves to unit_concept_id via vocab.concept
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 13.5, high: 17.5 }
    - { sex: F, age_low: 18, age_high: null, low: 12.0, high: 15.5 }
    - { sex: A, age_low:  1, age_high:  17,  low: 11.0, high: 16.0 }
  source_ref: "Mayo Clin Path Handbook"
  notes: "Adult ranges; peds band is a simplification."

# Creatinine (mass/volume, serum/plasma)
- loinc: "2160-0"
  unit_ucum: "mg/dL"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 0.74, high: 1.35 }
    - { sex: F, age_low: 18, age_high: null, low: 0.59, high: 1.04 }
  source_ref: "Mayo"
```

The YAML stores LOINC codes (not concept_ids) because LOINCs are stable and human-readable; the seeder resolves them to concept_ids via `vocab.concept` at load time so the file survives vocabulary refreshes. Same for UCUM unit codes.

The seeder **fails loudly** on any unresolvable LOINC or UCUM code so typos are caught during development, not silently dropped in production.

### Initial curated coverage

Target ~170 distinct labs, ~250 rows after sex/age expansion:

| Panel | Labs | Sex-stratified? | Age-stratified? |
|---|---|---|---|
| CBC w/ diff | WBC, RBC, Hgb, Hct, MCV, MCH, MCHC, RDW, Plt, MPV, neut/lymph/mono/eos/baso abs & % | Yes (Hgb/Hct/RBC) | Peds band for Hgb/WBC |
| BMP/CMP | Na, K, Cl, CO2, BUN, Cr, Glu, Ca, Alb, TP, TBili, DBili, AST, ALT, ALP, GGT | Yes (Cr) | ALP peds |
| Lipid | TC, HDL, LDL (calc & direct), TG, non-HDL, Apo A1/B | No | — |
| Coags | PT, INR, aPTT, Fibrinogen, D-dimer | No | — |
| Cardiac | Trop I, Trop T, hs-Trop, BNP, NT-proBNP, CK, CK-MB | No | — |
| Iron studies | Fe, TIBC, % sat, Ferritin | Yes (Ferritin) | — |
| Thyroid | TSH, Free T4, Total T4, Free T3, T Uptake | No | — |
| Diabetes | HbA1c, Fasting insulin, C-peptide, Fructosamine | No | — |
| Renal/Endo | eGFR, Cystatin C, BUN/Cr ratio, Mg, Phos, UA protein, ACR | Yes (eGFR via CKD-EPI 2021) | eGFR adult |
| Vitamins | 25-OH Vit D, B12, Folate (serum & RBC), Vit A, Vit E | No | — |
| Hepatic add'l | LDH, Amylase, Lipase, Ammonia, AFP | Yes (AFP) | — |
| Tumor markers | PSA (free & total), CA 19-9, CA 125, CEA, CA 15-3 | Yes (PSA) | Age-adjusted PSA |
| Hematology add'l | Reticulocytes (abs & %), Haptoglobin, ESR, CRP, hs-CRP | No | ESR age-adjusted |
| Endocrine | Cortisol (AM), Testosterone (total/free), Estradiol, FSH, LH, Prolactin | Yes | — |
| Urine | Spec grav, pH, Protein, Glucose, Ketones, Blood, Nitrite, Leuk est, microalb | No | — |
| ABG | pH, pCO2, pO2, HCO3, Base excess, SpO2, Lactate | No | — |

**Clinical disclaimer:** these ranges are assembled from publicly available clinical references for use in a research tool (Parthenon). They are **not** FDA-cleared and are not intended for direct patient care. The `source_ref` and `notes` columns record provenance; the chart footnote displays the source to the reader.

### Artisan command

`php artisan labs:compute-reference-ranges`

Flags:

```
--source=synpuf          # single source_id or source key; omit for all sources
--min-n=30               # skip concepts with fewer than N observations (default 30)
--concepts=3000483,...   # optional comma-separated concept_id filter
--dry-run                # report counts without writing
```

Per-source SQL:

```sql
SELECT
  measurement_concept_id,
  unit_concept_id,
  percentile_cont(0.025) WITHIN GROUP (ORDER BY value_as_number) AS p025,
  percentile_cont(0.500) WITHIN GROUP (ORDER BY value_as_number) AS p500,
  percentile_cont(0.975) WITHIN GROUP (ORDER BY value_as_number) AS p975,
  COUNT(*) AS n
FROM {source_schema}.measurement
WHERE value_as_number IS NOT NULL
  AND unit_concept_id IS NOT NULL
GROUP BY measurement_concept_id, unit_concept_id
HAVING COUNT(*) >= :min_n;
```

Batch-upsert into `app.lab_reference_range_population` with `computed_at = now()`. Per-source processing so OMOP's 710M rows don't block SynPUF/IRSF/Pancreas. Safely re-runnable. Wrapped in per-source try/catch so one source's failure doesn't abort the rest (CLAUDE.md transaction-poisoning guidance).

### Deployment integration

- `LabReferenceRangeSeeder` wired into the main `DatabaseSeeder` so `./deploy.sh --db` picks it up on every migration run.
- `labs:compute-reference-ranges` is **not** run automatically by `deploy.sh` (too slow for OMOP). It is documented in the module devlog and run manually after a significant CDM data change, with `--source` flags to scope the work.

---

## 5. Service Layer

### `LabReferenceRangeService`

Location: `backend/app/Services/Analysis/LabReferenceRangeService.php`

```php
final class LabReferenceRangeService
{
    /** @var array<string, ?LabRangeDto> per-request memoization */
    private array $memo = [];

    public function __construct(
        private readonly DatabaseManager $db,
    ) {}

    /**
     * Resolve a reference range for one measurement context.
     *
     * @param int         $sourceId             app.sources.id
     * @param int         $measurementConceptId OMOP measurement_concept_id
     * @param int|null    $unitConceptId        OMOP unit_concept_id
     * @param string|null $personSex            'M' | 'F' | null
     * @param int|null    $personAgeYears       age at measurement
     */
    public function lookup(
        int $sourceId,
        int $measurementConceptId,
        ?int $unitConceptId,
        ?string $personSex,
        ?int $personAgeYears,
    ): ?LabRangeDto;

    /**
     * Bulk variant — one DB roundtrip for a full lab panel.
     *
     * @param list<array{concept_id:int,unit_concept_id:int|null}> $groups
     * @return array<string, ?LabRangeDto> keyed by "{conceptId}:{unitConceptId}"
     */
    public function lookupMany(
        int $sourceId,
        array $groups,
        ?string $personSex,
        ?int $personAgeYears,
    ): array;
}
```

### Lookup order (exact)

1. **Curated — sex-specific + age band match.**
   `curated WHERE concept_id = ? AND unit_concept_id = ? AND sex = personSex AND (age_low IS NULL OR personAge >= age_low) AND (age_high IS NULL OR personAge <= age_high)`.
   Prefer the narrowest matching band (see below).
2. **Curated — sex='A' (any) + age band match.** Same narrowness rule.
3. **Population** — `population WHERE source_id = ? AND concept_id = ? AND unit_concept_id = ?`.
4. **Null** — no range. Chart renders line only; Status = `Unknown`.

### Band narrowness rule (formal)

A band `(age_low, age_high)` is narrower than `(age_low', age_high')` when its numeric width is smaller, with `NULL` treated as `+∞` for upper bounds and `-∞` for lower bounds. Thus `(18, 49)` (width 31) beats `(18, NULL)` (width ∞) beats `(NULL, NULL)` (width ∞, both bounds open — lowest priority). Ties broken deterministically by preferring the row with the smaller `age_low` (older patient-friendly default).

### Edge cases

- `personSex` null (gender_concept_id = 8551 "Unknown") → skip step 1, go to step 2.
- `personAgeYears` null → match only curated rows where **both** `age_low IS NULL` and `age_high IS NULL`. Attempting to match age-banded rows without a known age would be guessing; prefer to fall through to an unbanded row or the population fallback.
- `unitConceptId` null → return null. We never mix units; an unranged measurement is clearer than a wrong range.
- Memoization key: `"{sourceId}:{conceptId}:{unitId}:{sex}:{age}"`.

### `LabRangeDto`

```php
final readonly class LabRangeDto
{
    public function __construct(
        public float $low,
        public float $high,
        public string $source,        // 'curated' | 'population'
        public string $sourceLabel,   // human-readable, used in chart footnote
        public ?string $sourceRef = null,  // curated: 'Mayo' etc.
        public ?int $nObservations = null, // population: row count
    ) {}
}
```

Example `sourceLabel` values:
- `"LOINC (F, 18+)"`
- `"LOINC (M, 1-17)"`
- `"SynPUF pop. P2.5–P97.5 (n=12,430)"`

### `LabStatusClassifier`

Location: `backend/app/Services/Analysis/LabStatusClassifier.php`

Pure function, no DB dependency:

```php
enum LabStatus: string
{
    case Low      = 'low';
    case Normal   = 'normal';
    case High     = 'high';
    case Critical = 'critical';
    case Unknown  = 'unknown';
}

final class LabStatusClassifier
{
    public static function classify(float $value, ?LabRangeDto $range): LabStatus
    {
        if ($range === null) {
            return LabStatus::Unknown;
        }

        $bandWidth = $range->high - $range->low;
        $criticalBuffer = $bandWidth * 2.0;

        if ($value < $range->low - $criticalBuffer || $value > $range->high + $criticalBuffer) {
            return LabStatus::Critical;
        }
        if ($value < $range->low)  return LabStatus::Low;
        if ($value > $range->high) return LabStatus::High;
        return LabStatus::Normal;
    }
}
```

The "Critical" heuristic — value more than 2× the band width outside the range — is a rough panic-flag approximation. It is intentionally conservative (a glucose of 500 mg/dL with range 70-100 triggers Critical; 200 does not). Tunable if clinical review finds it wrong.

---

## 6. API Contract

**Endpoint:** `GET /api/v1/sources/{source_id}/profiles/{person_id}` (existing)

**Change:** extend response with `labGroups` field. `clinicalEvents` stays unchanged for backward compat, but each measurement event in it gains `status` and `range` fields so the collapsed sparkline + status indicator can render without a second API call.

**New response fields:**

```json
{
  "person": { "...": "..." },
  "clinicalEvents": [
    {
      "occurrence_id": 123456,
      "concept_id": 3000963,
      "concept_name": "Hemoglobin [Mass/volume] in Blood",
      "domain": "measurement",
      "start_date": "2025-11-04",
      "value": 11.8,
      "unit": "g/dL",
      "range_low": 12.0,
      "range_high": 15.5,
      "status": "low",
      "range": {
        "low": 12.0,
        "high": 15.5,
        "source": "curated",
        "sourceLabel": "LOINC (F, 18+)",
        "sourceRef": "Mayo"
      }
    }
  ],
  "labGroups": [
    {
      "conceptId": 3000963,
      "conceptName": "Hemoglobin [Mass/volume] in Blood",
      "loincCode": "718-7",
      "unitConceptId": 8713,
      "unitName": "g/dL",
      "n": 14,
      "latestValue": 11.8,
      "latestDate": "2025-11-04",
      "trend": "down",
      "values": [
        { "date": "2025-11-04", "value": 11.8, "status": "low" },
        { "date": "2025-08-02", "value": 12.4, "status": "normal" }
      ],
      "range": {
        "low": 12.0,
        "high": 15.5,
        "source": "curated",
        "sourceLabel": "LOINC (F, 18+)",
        "sourceRef": "Mayo"
      }
    },
    {
      "conceptId": 3004501,
      "conceptName": "Glucose [Mass/volume] in Blood",
      "loincCode": "2339-0",
      "unitConceptId": 8840,
      "unitName": "mg/dL",
      "n": 28,
      "values": [ "..." ],
      "range": {
        "low": 65.0,
        "high": 142.0,
        "source": "population",
        "sourceLabel": "SynPUF pop. P2.5–P97.5",
        "nObservations": 12430
      }
    }
  ]
}
```

### Grouping logic

`PatientProfileService::getMeasurements()` already fetches the flat measurement list. After fetching, it:

1. Groups rows by `(concept_id, unit_concept_id)`.
2. Calls `LabReferenceRangeService::lookupMany()` **once** with all groups, plus the patient's sex and age — single DB roundtrip.
3. For each row, calls `LabStatusClassifier::classify()` using the group's range DTO.
4. Assembles both the enriched `clinicalEvents` (flat) and `labGroups` (grouped) from the same rows.

**Note on `clinicalEvents[].range`:** the `range` field carried on each measurement event is the **group's** computed reference range (the same DTO shared by all events in the same `(concept_id, unit_concept_id)` group), **not** the per-row `measurement.range_low` / `range_high` columns from OMOP (which are empty in every source except Pancreas, per §1). Duplicating the range on each event is redundant by design — it keeps the frontend's collapsed-row rendering path simple (one pass over `clinicalEvents`) without a second grouping or joined fetch.

No duplicate query. Memoization means even if the same `(concept, unit)` appears in multiple groups (it shouldn't, but defense in depth), only one lookup is done.

### OpenAPI + generated types

- Update `backend/openapi.yaml` with new schemas: `LabGroup`, `LabValue`, `LabRange`, `LabStatus` enum.
- Run `./deploy.sh --openapi` to regenerate `frontend/src/types/api.generated.ts`.
- `PatientProfile` schema gains an optional `labGroups: LabGroup[]` field.

---

## 7. Frontend Components

### `LabTrendChart.tsx` (new)

Location: `frontend/src/features/profiles/components/LabTrendChart.tsx`

Recharts `ComposedChart` with three stacked primitives: `CartesianGrid` → `ReferenceArea` (range band) → `Line` (values).

```tsx
type LabTrendChartProps = Pick<LabGroup, 'values' | 'range' | 'unitName'> & {
  conceptName: string;
  height?: number;          // default 180
};

export const LabTrendChart = ({
  values, range, unitName, conceptName, height = 180,
}: LabTrendChartProps) => {
  const data = useMemo(
    () => values.map(v => ({
      ts: new Date(v.date).getTime(),
      value: v.value,
      status: v.status,
    })),
    [values],
  );

  const domain = useMemo(() => {
    const vals = data.map(d => d.value);
    const lo = Math.min(...vals, range?.low ?? Infinity);
    const hi = Math.max(...vals, range?.high ?? -Infinity);
    const pad = (hi - lo) * 0.10 || Math.abs(hi) * 0.05 || 1;
    return [lo - pad, hi + pad] as const;
  }, [data, range]);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(ts: number) => format(ts, 'MMM yyyy')}
            stroke="#71717a"
            fontSize={11}
          />
          <YAxis
            domain={domain}
            stroke="#71717a"
            fontSize={11}
            label={{ value: unitName, angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }}
          />
          {range && (
            <ReferenceArea
              y1={range.low}
              y2={range.high}
              fill="#2DD4BF"           // teal from dark clinical theme
              fillOpacity={0.12}
              stroke="#2DD4BF"
              strokeOpacity={0.35}
              strokeDasharray="2 2"
              ifOverflow="extendDomain"
            />
          )}
          <Tooltip
            content={<LabTrendTooltip range={range} unitName={unitName} />}
            cursor={{ stroke: '#C9A227', strokeWidth: 1, strokeDasharray: '2 2' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#E4E4E7"
            strokeWidth={2}
            dot={(props) => <LabStatusDot {...props} />}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {range && (
        <div className="mt-1 flex items-center justify-between px-2 text-[11px] text-zinc-500">
          <span>
            Reference: <span className="text-zinc-400">{range.low}–{range.high} {unitName}</span>
          </span>
          <span className="italic">{range.sourceLabel}</span>
        </div>
      )}
    </div>
  );
};
```

### `LabStatusDot.tsx` (new)

Custom dot component colored by per-point status:

| Status    | Fill      | Stroke    | Radius |
|---|---|---|---|
| `low`     | `#3B82F6` | `#3B82F6` | 4      |
| `normal`  | `#A1A1AA` | `#A1A1AA` | 3      |
| `high`    | `#9B1B30` | `#9B1B30` | 4      |
| `critical`| `#9B1B30` | `#C9A227` (3px ring) | 5 |
| `unknown` | transparent | `#71717a` | 3 |

Gives the clinician a visual "this patient is Hgb-low and trending further down" read at a glance.

### `LabTrendTooltip.tsx` (new)

Custom tooltip (not Recharts default) — no `formatter` prop used, sidestepping the CLAUDE.md Recharts formatter union-type trap:

```
Nov 4, 2025
11.8 g/dL
↓ Low (below 12.0)
```

Dark card with gold accent border matching the theme palette.

### `LabValuesTable.tsx` (new)

Tiny component extracted from the existing `PatientLabPanel.tsx` lines 229-280. Renders the current Date/Value/Range/Status table columns. Keeping it as a separate component lets the "Show values" toggle display it on demand and keeps `PatientLabPanel.tsx` under the 800-line soft cap.

### `PatientLabPanel.tsx` (modified)

Expanded-row body changes from a `<table>` to:

```tsx
{expanded[group.conceptId] && (
  <div className="space-y-2 p-3 bg-zinc-900/40 rounded-md">
    <LabTrendChart
      conceptName={group.conceptName}
      unitName={group.unitName}
      values={group.values}
      range={group.range}
    />

    <button
      onClick={() => toggleValuesTable(group.conceptId)}
      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
    >
      <ChevronRight className={cn('h-3 w-3 transition-transform', showValues[group.conceptId] && 'rotate-90')} />
      {showValues[group.conceptId] ? 'Hide values' : 'Show values'}
    </button>

    {showValues[group.conceptId] && (
      <LabValuesTable values={group.values} unitName={group.unitName} range={group.range} />
    )}
  </div>
)}
```

Additionally:
- Collapsed-row sparkline (lines 62-75) and status indicator receive the new `group.range` / `value.status` data — the render code already exists; it just finally gets non-null inputs.
- Client-side grouping logic (`groupMeasurementsByConcept`, ~30 lines) is **removed** because the backend now groups.
- Consumes `profile.labGroups` directly instead of `events.filter(e => e.domain === 'measurement')`.

### Data plumbing

- `frontend/src/features/profiles/types.ts` — new types (preferably generated via OpenAPI codegen into `api.generated.ts`).
- `useProfiles.ts` `usePatientProfile()` hook — return type broadened to include `labGroups`. No new hook.

### File layout

```
frontend/src/features/profiles/
  components/
    LabTrendChart.tsx         (NEW ~160 lines)
    LabTrendTooltip.tsx       (NEW ~40 lines)
    LabStatusDot.tsx          (NEW ~30 lines)
    LabValuesTable.tsx        (NEW ~70 lines — extracted)
    PatientLabPanel.tsx       (MODIFIED — net shrinkage, grouping removed)
```

All new files under the 400-line typical / 800-line max per global coding-style rules.

---

## 8. Testing Strategy

### Backend — Pest

```
backend/tests/
  Unit/
    Services/Analysis/
      LabReferenceRangeServiceTest.php     (NEW)
      LabStatusClassifierTest.php          (NEW)
    Seeders/
      LabReferenceRangeSeederTest.php      (NEW)
  Feature/
    Console/
      ComputeReferenceRangesCommandTest.php (NEW)
    Api/V1/
      PatientProfileControllerTest.php     (MODIFIED)
```

**`LabReferenceRangeServiceTest`** — Pest + `RefreshDatabase`. Seeds curated and population rows covering:

1. Narrowest curated wins — `(M, 18, NULL)` and `(M, 18, 49)` both match; picks `(18, 49)`.
2. Sex specificity wins over `A` — `(F, 18, NULL)` beats `(A, 18, NULL)` for a female.
3. Age out of band falls through — 70yo male with only `(M, 18, 49)` → population.
4. Population fallback — no curated row, returns population DTO.
5. No data — returns `null`.
6. Null `unit_concept_id` → `null`.
7. `lookupMany` — 20 tuples in one call match 20 individual `lookup` calls.
8. Memoization — two identical `lookup` calls hit the DB once (query count assertion).

**`LabStatusClassifierTest`** — pure function, parametrized table: ~15 rows covering Low/Normal/High edge cases (inclusive bounds), Critical in both directions, Unknown when range is null.

**`LabReferenceRangeSeederTest`** — temp YAML fixture + minimal vocab fixture. Asserts:
1. LOINC codes resolve via `vocab.concept`.
2. UCUM units resolve via `vocab.concept`.
3. Sex/age rows upsert on the unique key (no duplicates on re-run).
4. Unresolvable LOINC throws a clear exception (fail-loud).
5. Idempotency — two runs, same final row count.

**`ComputeReferenceRangesCommandTest`** — seeds a small `measurement` fixture in a test schema (1000 Hgb values between 10 and 18 g/dL). Asserts:
1. P2.5 / P97.5 computed to ±0.1 tolerance.
2. `--min-n` skips concepts below threshold.
3. `--dry-run` reports without writing.
4. Re-run overwrites `computed_at`.
5. `--source=synpuf` only touches that source.

**`PatientProfileControllerTest`** additions:
1. Curated range case — response `labGroups[].range.source = 'curated'`, `sourceLabel` matches fixture.
2. Population fallback case — `source = 'population'`, `nObservations` populated.
3. No range available — `labGroups[].range` is null, `values` still populated.

### Frontend — Vitest

```
frontend/src/features/profiles/components/__tests__/
  LabTrendChart.test.tsx
  LabStatusDot.test.tsx
  LabValuesTable.test.tsx
  PatientLabPanel.test.tsx
```

**`LabTrendChart.test.tsx`** — RTL + jsdom. Asserts:
1. Line renders the expected dot count (`querySelectorAll('.recharts-line-dot')`).
2. Reference area present when `range` is set.
3. Reference area absent when `range` is null.
4. Footnote renders only when range is set.
5. `sourceLabel` renders verbatim.

Recharts + ResponsiveContainer requires a jsdom width shim — use existing frontend test pattern if one exists; otherwise set `clientWidth`/`clientHeight` in test setup.

**`LabStatusDot.test.tsx`** — parametrized: each status → expected `fill`, `stroke`, `r`. Explicit attribute assertions, no snapshot files.

**`LabValuesTable.test.tsx`** — headers present; status cells render correct text; range cell shows `low–high unit` when present, `—` when absent.

**`PatientLabPanel.test.tsx`** — smoke test: mount with mock `labGroups`, click row, assert chart mounts; click "Show values", assert table appears. Does not duplicate `LabTrendChart` assertions.

### Coverage target

- Backend: ≥90% on new service + classifier (small, pure-ish code).
- Frontend: ≥80% overall, acknowledging Recharts/jsdom limitations.

### Out of test scope

- Recharts internals (tooltip positioning, axis math).
- Visual regression / Playwright screenshots.
- Clinical accuracy of curated ranges (human review responsibility, not automated).
- Full E2E patient-profile journey (existing spec, if any, gets a light `labGroups` presence check; no new journey).

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OMOP population-percentile query is slow (710M rows, no index on `(concept, unit)` with `value_as_number IS NOT NULL`) | High | Medium — command is manual, not on deploy path | Per-source flag, progress output, optional partial index migration if intolerably slow |
| Vocab refresh invalidates LOINC concept_ids in YAML | Low | Medium | Seeder resolves via `concept_code` at load time; fails loudly on unresolvable codes |
| Recharts `ResponsiveContainer` width=0 in Vitest jsdom | High | Low — testing only | Use existing frontend test pattern; shim `clientWidth`/`clientHeight` if needed |
| Curated ranges clinically inaccurate for a specific population | Medium | Low — research tool, not EMR | `source_ref` + `notes` columns record provenance; chart footnote shows source; disclaimer in docs |
| Transaction poisoning if seeder or compute command hits a bad row | Medium | Medium | Seeder inside single transaction (all or nothing); compute command wraps per-source work in try/catch (memory: `feedback_schema_authority_laravel.md`, CLAUDE.md guidance) |
| Per-source population range surprises clinicians ("why is normal different for SynPUF vs IRSF?") | Medium | Low | Chart footnote explicitly shows `"SynPUF pop. P2.5–P97.5"` so the user knows which cohort is the denominator |

---

## 10. Acceptance Criteria

The design is delivered when **all** of the following hold:

**Data layer**
- [ ] `app.lab_reference_range_curated` migrated and present in test, dev, and prod.
- [ ] `app.lab_reference_range_population` migrated and present.
- [ ] `lab_reference_ranges.yaml` contains at least 150 distinct labs covering the 16 panels listed in §4.
- [ ] `LabReferenceRangeSeeder` runs idempotently and wires into `DatabaseSeeder`.
- [ ] `./deploy.sh --db` runs the seeder cleanly on a fresh clone.
- [ ] `php artisan labs:compute-reference-ranges --source=synpuf` writes rows to `app.lab_reference_range_population`.

**Service layer**
- [ ] `LabReferenceRangeService::lookup()` and `lookupMany()` implemented with the documented lookup order.
- [ ] `LabStatusClassifier::classify()` returns the correct enum for Low/Normal/High/Critical/Unknown.
- [ ] Pest tests passing at ≥90% coverage for the new files.
- [ ] PHPStan level 8 clean.
- [ ] Pint clean (Docker-parity).

**API layer**
- [ ] `GET /api/v1/sources/{source_id}/profiles/{person_id}` returns `labGroups` for a patient with measurements.
- [ ] Each `labGroup` has `range`, `values[].status`, and the expected fields from §6.
- [ ] `clinicalEvents` still present and unchanged for backward compat; measurement events in it gain `status` and `range`.
- [ ] `openapi.yaml` updated; `frontend/src/types/api.generated.ts` regenerated via `deploy.sh --openapi`.

**Frontend**
- [ ] Expanded row shows a Recharts line chart with a shaded teal range band.
- [ ] "Show values" toggle reveals the existing table beneath the chart.
- [ ] Collapsed row's sparkline shows the green reference band and the status indicator is populated.
- [ ] Chart footnote shows the range source (`"LOINC (F, 18+)"` or `"SynPUF pop. P2.5–P97.5"`).
- [ ] `LabStatusDot` colors match the scheme in §7.
- [ ] Vitest tests passing at ≥80% coverage for the new components.
- [ ] `npx vite build` and `npx tsc --noEmit` both clean.
- [ ] ESLint clean.

**End-to-end verification**
- [ ] A patient profile on SynPUF shows labs with population ranges.
- [ ] A patient profile on Pancreas shows labs with curated ranges where available, population fallback elsewhere.
- [ ] Chart visually matches the dark clinical theme (#0E0E11 base, #2DD4BF band, #C9A227 cursor).
- [ ] Pre-commit hook (Pint, PHPStan, tsc, ESLint, Vitest) passes on the final commit.

---

## 11. Open Questions

None at design time — all forks resolved during brainstorming:

- Data source strategy: **C (hybrid)**
- Curated table scope: **Tier 3 (comprehensive, sex + age stratified)**
- UI layout: **B (inline chart + "Show values" toggle)**
- Population fallback scope: **A (per-source, deploy-time)**
- Range source label in chart: **yes**
- Chart library: **Recharts** (`ReferenceArea` primitive)
- Unit handling: **strict `unit_concept_id` match, fall through to population on mismatch**

If any of these shift during implementation, update this spec and re-run the plan-check loop.
