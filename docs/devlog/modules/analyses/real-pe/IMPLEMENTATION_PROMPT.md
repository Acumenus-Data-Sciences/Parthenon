# Claude Code Implementation Prompt — REAL-PE Replication Study

**How to use this file:** paste the contents below into a Claude Code session, or invoke with `claude -p "$(cat docs/devlog/modules/analyses/real-pe/IMPLEMENTATION_PROMPT.md)"`. The prompt is self-contained and assumes no prior conversation context.

---

## Mission

Implement a complete replication of the REAL-PE study (Monteleone et al., *J Soc Cardiovasc Angiogr Interv*, 2024) inside Parthenon, targeting the Acumenus CDM. REAL-PE is a Truveta comparative safety analysis of ultrasound-assisted catheter-directed thrombolysis (USCDT, EKOS-class) versus percutaneous mechanical thrombectomy (MT, FlowTriever-class) for acute pulmonary embolism, with direct-from-lab derivation of ISTH and BARC 3b major-bleed endpoints. Deliver the replication as a first-class reproducible Study in the studies module, with PS-matched comparative analysis via HADES `CohortMethod` and a Central-Illustration-style results panel.

Read the existing scaffold before you touch anything: [`docs/devlog/modules/analyses/real-pe/README.md`](./README.md). The sub-folders `sql/` and `cohorts/` already contain working starting points — do not rewrite them from scratch; extend them.

## Why this work matters

Parthenon is positioned as a unified OHDSI outcomes-research platform. A clean replication of a published real-world-evidence study — end to end, from raw CDM to a publishable Central Illustration — is a credibility artifact for Series A diligence. Two requirements follow from that:

1. Every step must be *auditable and reproducible*. No manual data munging in notebooks; every transformation lives in a versioned Study artifact or migration.
2. Deviations from the source study must be *explicitly documented*, not silently absorbed.

## Source study summary (do not re-read the PDF)

- **Target**: USCDT (EKOS). **Comparator**: MT (FlowTriever). **Indication**: acute PE, inpatient.
- **Primary analysis window**: 2009-01 to 2023-05. **Contemporary window**: 2018-01 to 2023-05.
- **Inclusion**: PE diagnosis within 30 days before or 1 day after the index device procedure, inpatient encounter.
- **Outcomes**: ISTH major bleed, BARC 3b major bleed, intracranial hemorrhage, length of stay, 30-day all-cause readmission, in-hospital mortality.
- **Key methodological feature**: bleeding endpoints derived from *direct laboratory values* (hemoglobin delta from pre-procedure max to 0-7d post nadir) plus transfusion documentation, not just diagnosis codes.
- **Truveta result**: MT associated with higher major bleeding by multiple definitions; ICH more common with MT; LOS and mortality similar between arms.

## Architectural constraints (read the full CLAUDE.md at the repo root)

Observe these without exception:

1. **Database is a single `parthenon` Postgres** with schema isolation. CDM clinical tables live in `omop.*`; shared vocabulary in `vocab.*`; application tables in `app.*`; Achilles/DQD results in `results.*`. There is no `cdm` or `docker_pg` connection — use the `omop` connection (search_path = `omop,vocab,php`) for CDM queries and the default `pgsql` connection for app tables.
2. **HIGHSEC rules apply** (see `.claude/rules/HIGHSEC.spec.md`). Every new route gets `auth:sanctum` plus a `permission:` middleware. No model may set `$guarded = []`. No unauthenticated routes may return PHI or clinical data. Viewer role is the default for any new seed user.
3. **Auth system is frozen** (see `.claude/rules/auth-system.md`). Do not modify `AuthController`, `MainLayout`, `LoginPage`, or any Sanctum/Spatie wiring while doing this work.
4. **CdmModel subclasses are read-only**. Never add `create`/`update`/`delete` to anything in `backend/app/Models/Cdm/`.
5. **Run Pint and TypeScript checks after every edit**:
   ```bash
   docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
   cd frontend && npx tsc --noEmit && npx vite build
   ```
   CI uses `vite build`, which is stricter than `tsc --noEmit` — check both.
6. **DaimonType enum cases are UPPERCASE**: `DaimonType::CDM`, not `DaimonType::Cdm`.
7. **Event listeners and non-critical middleware must use nested transactions** (try/catch with `DB::beginTransaction`) so optional writes cannot poison the request transaction (`SQLSTATE[25P02]`).
8. **Recharts `Tooltip` formatter prop** always needs `as never`: `formatter={((value: number) => [`${value}`, '']) as never}`.
9. **Component props** use `Pick<T, ...>` rather than full types when only a subset of fields is needed.

## Phase plan

Execute phases in order. Each phase has a gate — do not proceed to the next phase until the current phase's acceptance criteria pass.

### Phase 0 — Feasibility (blocking gate)

**Goal**: determine whether Acumenus CDM has enough USCDT and MT cases to support native replication.

1. Run `docs/devlog/modules/analyses/real-pe/sql/01_feasibility_counts.sql` against the Acumenus CDM:
   ```bash
   docker compose exec -T postgres psql -U parthenon -d parthenon \
     -v ON_ERROR_STOP=1 \
     -f docs/devlog/modules/analyses/real-pe/sql/01_feasibility_counts.sql \
     | tee docs/devlog/modules/analyses/real-pe/reports/01_feasibility_$(date +%Y%m%d).txt
   ```
2. Evaluate the step-3 eligible counts (PE + inpatient + procedure + temporal window) per arm:
   - **> 100 per arm**: proceed with native Acumenus-only replication.
   - **30-100 per arm**: pool Acumenus with SynPUF by generating cohorts against both sources and federating results in Phase 4. Document the pooling rationale in the study README.
   - **< 30 per arm**: pivot to a methods demonstration — use Eunomia or MIMIC-IV (inpatient schema) as the corpus, and rename the Study title to reflect that it is a methodological feasibility study rather than a population-level replication. Get explicit user sign-off before proceeding.
3. Also confirm hemoglobin measurement coverage: at least one of LOINC `718-7`, `30350-3`, `30351-1`, `20509-6` must have > 50% of cohort-eligible persons with a numeric `value_as_number`. If not, the outcome derivation cannot be run and this replication is not feasible on Acumenus without an ETL fix — escalate.

**Gate**: counts recorded in the `reports/` subfolder; replication-path decision documented in the study README (Acumenus-only, pooled, or demo-only).

### Phase 1 — Concept hydration and cohort seeding

**Goal**: turn the four cohort JSON templates into seeded `app.cohort_definitions` with correct standard concept_ids.

1. Run `docs/devlog/modules/analyses/real-pe/sql/00_hydrate_concept_ids.sql` and capture the results.
2. For each file in `docs/devlog/modules/analyses/real-pe/cohorts/`, replace `"CONCEPT_ID": 0` with the resolved standard `concept_id`. If a source code is non-standard, use the mapped-to standard concept_id from the second query in the hydration script. Preserve `includeDescendants` and `includeMapped` flags exactly.
3. **Do not fabricate concept_ids.** If a code does not resolve to a standard concept in the vocab build, leave it at 0 and add a `"hydration_status": "unresolved"` attribute at the top-level of the cohort JSON with the concept_code and vocabulary_id, then remove that concept from the ConceptSet items list (not the JSON attribute) so that cohort generation does not fail on a zero concept_id.
4. Copy the hydrated files to `backend/database/fixtures/designs/cohort_definitions/` with the same filenames and give each one a unique `id` that does not collide with existing fixtures (check max id in the folder). Set `is_public` to `false`, `author_id` to the system/superadmin user id, and `domain` to `"cardiovascular"`, `quality_tier` to `"draft"`.
5. Add a seeder at `backend/database/seeders/RealPeReplicationSeeder.php` that loads the four fixtures through the existing cohort definition fixture loader pattern (look for how `Study 3` CKD fixtures are loaded as a reference). Register the seeder in `DatabaseSeeder.php` behind an `APP_ENV=local` or feature-flag guard so it does not run in production by default.
6. Generate each cohort against the Acumenus source:
   ```bash
   docker compose exec -T php php artisan cohort:generate --cohort-id={id} --source=acumenus
   ```
   Confirm the generated `app.cohort` row counts fall within ±15% of the Phase 0 feasibility counts. Investigate any larger discrepancy before moving on.

**Gate**: four cohorts seeded, hydrated, and generated successfully against the Acumenus source. Row counts logged in `reports/02_cohort_counts_$(date +%Y%m%d).txt`.

### Phase 2 — Custom outcome derivation

**Goal**: produce the ISTH and BARC 3b major-bleed outcome flags that Circe cannot express.

1. Promote `docs/devlog/modules/analyses/real-pe/sql/02_isth_barc_outcomes.sql` into a proper Parthenon SqlRender template. Target location: `backend/resources/sql/templates/real_pe/isth_barc_outcomes.sql`. Replace the psql bind syntax (`:target_cohort_id`) with SqlRender `@variable` syntax.
2. Create a new Laravel job at `backend/app/Jobs/RealPeOutcomesJob.php` that:
   - Accepts target/comparator/bleed-dx cohort IDs and a source ID.
   - Resolves hemoglobin and transfusion concept_id arrays at runtime by querying `vocab.concept` for the LOINC and CPT codes in the template header.
   - Renders the SQL template with SqlRender, executes it on the `omop` connection, and persists the final `tmp_realpe_outcomes` into `results.real_pe_outcomes` (create a new migration for this table; schema matches the temp table in the template).
   - Dispatches via Horizon on the `analyses` queue.
   - Uses a nested DB transaction and catches exceptions so a failure here cannot poison a parent request transaction.
3. Create the results table migration at `backend/database/migrations/{timestamp}_create_real_pe_outcomes_table.php`. Columns: `person_id bigint`, `cohort_id bigint`, `index_date date`, `hgb_preindex_max numeric(5,2)`, `hgb_postindex_nadir numeric(5,2)`, `hgb_drop numeric(5,2)`, `hgb_drop_gte_2 boolean`, `hgb_drop_gte_5 boolean`, `received_transfusion boolean`, `has_bleed_dx boolean`, `isth_major_bleed boolean`, `barc_3b_major_bleed boolean`, `source_id bigint`, `created_at timestamptz`. Compound primary key `(source_id, cohort_id, person_id, index_date)`. Index on `cohort_id`.
4. Expose a thin API endpoint to run the job: `POST /api/v1/studies/{study}/analyses/real-pe-outcomes/execute`. Follow the three-layer HIGHSEC pattern: `auth:sanctum` + `permission:studies.execute` + controller-level `$this->authorize('execute', $study)`.
5. Add a Pest feature test at `backend/tests/Feature/RealPe/OutcomesJobTest.php` that seeds a tiny fixture dataset into Eunomia (or a dedicated test source) and asserts expected ISTH / BARC 3b counts. Use the existing test-db pattern — do **not** mock the database; REAL-PE's value is the integration across tables.

**Gate**: `php artisan queue:work` runs the job cleanly; `results.real_pe_outcomes` populated; the 2×2 contingency counts in the SQL output reasonably approximate the Truveta proportions (ISTH ~12% USCDT, ~17% MT within ±5 percentage points, assuming sufficient n).

### Phase 3 — Baseline characterization (Table 1 equivalent)

**Goal**: reproduce REAL-PE Table 1 — demographics, medical history, preceding anticoagulant use, split by cohort.

1. Reuse the existing `Characterization` model and characterization fixture pattern. Place the fixture at `backend/database/fixtures/designs/characterizations/real-pe-baseline-characterization.json`.
2. Covariates required (all present in standard OHDSI FeatureExtraction):
   - Age bands at index, `>=60` flag
   - Sex
   - Race/ethnicity (white, black, other, Hispanic/Latino)
   - Condition history ever-before-index: cancer, CKD, COPD, CAD, HTN, DVT, ischemic stroke, MI, DM, prior major bleed, prior hemorrhagic stroke
   - Drug exposure within 30d before index: DOACs, VKAs, unfractionated heparin, LMWH
3. Run characterization via the analyses execution pipeline. Confirm output rows populate `results.feature_extraction_*` (or the equivalent characterization result tables used by the results-explorer).

**Gate**: a characterization table can be rendered side-by-side for the two cohorts, matching the structure of REAL-PE Table 1.

### Phase 4 — PS-matched comparative analysis (HADES CohortMethod)

**Goal**: produce a propensity-score-matched comparative effectiveness analysis of MT vs USCDT for each outcome.

1. Use the existing `EstimationAnalysis` model and fixture pattern (see `backend/database/fixtures/designs/estimation_analyses/s7-simvastatin-vs-atorvastatin-*` for reference). Place the fixture at `backend/database/fixtures/designs/estimation_analyses/real-pe-mt-vs-uscdt-ps-matched.json`.
2. Analysis settings:
   - Target: MT cohort; Comparator: USCDT cohort. (Truveta presents the same direction — MT as the "new" therapy under scrutiny.)
   - Outcomes: ISTH major bleed, BARC 3b major bleed, ICH, 30-day readmission, in-hospital death. The four bleed outcomes are in `results.real_pe_outcomes`; the latter two are derivable from `visit_occurrence` and `death`.
   - Study window: 1-day risk start, 7-day risk end (matches REAL-PE adverse-event reporting window).
   - PS model covariates: the Phase 3 baseline characterization covariate set.
   - Matching: 1:1 greedy nearest-neighbor, caliper 0.2 standard deviations of the logit PS. Confirm balance via SMD < 0.1 across all covariates; re-estimate PS if not.
3. Add **negative-control outcomes** for empirical calibration (this is a methodological improvement over Truveta). Use a small set of conditions with no plausible mechanism from PE treatment: ingrown toenail, insect bite, otitis externa, cerumen impaction. Eight to ten controls is enough. Report calibrated and uncalibrated HRs/ORs.
4. Execute via the R-runtime Plumber API (`r-runtime/plumber_api.R`). The runtime takes ~60s to cold-start — tolerate that in your job orchestration.
5. Persist results into the existing estimation results tables.

**Gate**: point estimates with 95% CIs exist for all five outcomes, both calibrated and uncalibrated. Covariate balance SMDs are all < 0.1 after matching.

### Phase 5 — Results-explorer rendering

**Goal**: build a dedicated results page that reproduces REAL-PE's Central Illustration and Tables 1-3 in the Parthenon UI.

1. Add a new route under the studies feature: `/frontend/src/features/studies/pages/RealPeResultsPage.tsx`.
2. Components to build (all under `/frontend/src/features/studies/components/real-pe/`):
   - `BleedingIncidencePanel.tsx` — six rows (transfusion 7d, Hgb drop >2, Hgb drop >5, major bleed dx, ISTH, BARC 3b) × two columns (USCDT, MT) × two era tabs (primary, contemporary). Include p-values from chi-square.
   - `AdverseEventsTable.tsx` — in-hospital death, ischemic stroke, ICH, 30-day readmission (REAL-PE Table 2).
   - `RegressionForestPlot.tsx` — horizontal forest plot of ORs from the PS analysis (REAL-PE Table 3).
   - `BaselineCharacteristicsTable.tsx` — Phase 3 characterization rendered with SMDs.
3. Data flow: TanStack Query hooks under `/frontend/src/features/studies/api/realPe.ts`. Zod-validate all responses. No raw `fetch` or `useEffect`.
4. Styling: dark clinical theme — `#0E0E11` base, `#9B1B30` crimson for MT, `#C9A227` gold for USCDT, `#2DD4BF` teal for p-values or emphasis.
5. Recharts tooltips use `formatter={(...) as never}`. Component props use `Pick<...>`.
6. Route is wired behind `auth:sanctum` + `permission:studies.view`.
7. Run `npx vite build` to verify; the build is stricter than `tsc --noEmit`.

**Gate**: the page renders the four panels with live data from the Acumenus source (or pooled source). Pint, PHPStan, `tsc`, `vite build`, and Vitest all pass.

### Phase 6 — Wrap as a formal Study

**Goal**: the replication is addressable as a single Study entity in the studies module, versioned and exportable.

1. Create a Study fixture at `backend/database/fixtures/studies/real-pe-replication.json` that references the four cohorts, one characterization, and one estimation analysis created in prior phases.
2. Populate `StudyArtifact` entries pointing at the SQL template, the cohort fixtures, and the R analysis package (if generated).
3. Use the existing Study export endpoint to produce a Strategus-compatible package. Verify the package round-trips — a fresh `php artisan study:import` on a clean source should recreate the full analysis.

**Gate**: the Study is listed in the studies module, can be executed end-to-end from the UI, and can be exported as a Strategus JSON bundle.

### Phase 7 — Devlog, tests, and CI

1. Append a phase-by-phase completion log to `docs/devlog/modules/analyses/real-pe/IMPLEMENTATION_LOG.md` with dates, row counts, and any deviations or escalations.
2. Confirm full local CI passes:
   ```bash
   make lint
   make test
   ```
3. Run `./deploy.sh --openapi` so the generated TypeScript types reflect any new API routes.
4. Ensure the pre-commit hook passes on all new files (the hook runs Pint, PHPStan, `tsc`, ESLint on staged frontend files, and Vitest `--changed`).

## Subagent guidance

If you spawn subagents to parallelize work (e.g. an Explore agent to survey the studies module, a general-purpose agent to build the frontend panel), **always include Pint and `tsc` check commands in the spawned agent's prompt** so they return verified code rather than unchecked drafts. Do not commit anything a subagent produced without re-running Pint and `tsc --noEmit` + `vite build` yourself.

## What to verify before declaring done

- `make test` green.
- `make lint` green.
- Feasibility counts logged and replication-path decision documented.
- Four cohorts generated against Acumenus with counts within ±15% of feasibility numbers.
- `results.real_pe_outcomes` populated; spot-check ten rows by hand.
- Baseline characterization table renders with SMDs.
- PS-matched point estimates exist for all five outcomes, both calibrated and uncalibrated.
- UI page loads without console errors; all four panels populated.
- Study fixture round-trips through `study:export` / `study:import`.
- Pre-commit hook passes on a representative touched file.
- `IMPLEMENTATION_LOG.md` records actual numbers, not hopeful placeholders.

## What NOT to do

- Do not modify `backend/app/Http/Controllers/Api/V1/AuthController.php`, `frontend/src/features/auth/**`, `frontend/src/components/layout/MainLayout.tsx`, or `frontend/src/stores/authStore.ts`. These are protected by `.claude/rules/auth-system.md`.
- Do not set `$guarded = []` on any model.
- Do not create any route that returns cohort or CDM data without both `auth:sanctum` and a `permission:` middleware.
- Do not mock the database in integration tests.
- Do not hardcode CPT/LOINC concept_ids — always resolve through `vocab.concept` at runtime or seed time.
- Do not commit with `--no-verify` unless the pre-commit hook is clearly broken and unrelated to your change.
- Do not edit `frontend/src/types/api.generated.ts` manually; run `./deploy.sh --openapi` instead.
- Do not push to remote or force-push without explicit instruction.
- If any phase gate fails, stop and surface the failure rather than papering over it to move forward.

## Escalation triggers

Stop and ask the user if any of the following occur:

- Phase 0 feasibility suggests the replication must pivot to a demo-only corpus.
- The Acumenus ETL does not preserve UDI *and* no CPT-level separation between EKOS and FlowTriever is possible — in which case the replication is about procedure class, not specific device, and the study title and conclusions must be reframed.
- Hemoglobin measurement coverage is below 50% of eligible cohort members — the ISTH/BARC 3b outcomes become unreliable and alternative endpoint definitions must be negotiated.
- PS-matched covariate balance cannot achieve SMD < 0.1 despite re-specification.
- Any phase surfaces a HIGHSEC violation in existing code — file an issue but do not fix it as part of this work; it's out of scope.

## Commit conventions

Use conventional commits, branch `feature/real-pe-replication`:

- `feat(real-pe): add feasibility SQL and cohort scaffolds`
- `feat(real-pe): custom outcome derivation job and results table`
- `feat(real-pe): baseline characterization fixture`
- `feat(real-pe): PS-matched CohortMethod analysis`
- `feat(real-pe): results-explorer panels`
- `feat(real-pe): wrap as formal Study with Strategus export`
- `docs(real-pe): implementation log`

Each commit should pass the pre-commit hook cleanly. Do not batch-amend; create a new commit if the hook fails.

---

## Reference artifacts already in the repo

- Scaffold entry point: `docs/devlog/modules/analyses/real-pe/README.md`
- Feasibility SQL: `docs/devlog/modules/analyses/real-pe/sql/01_feasibility_counts.sql`
- Concept hydration SQL: `docs/devlog/modules/analyses/real-pe/sql/00_hydrate_concept_ids.sql`
- Outcome derivation SQL template: `docs/devlog/modules/analyses/real-pe/sql/02_isth_barc_outcomes.sql`
- USCDT target cohort JSON: `docs/devlog/modules/analyses/real-pe/cohorts/01-uscdt-target.json`
- MT comparator cohort JSON: `docs/devlog/modules/analyses/real-pe/cohorts/02-mt-comparator.json`
- ISTH bleed dx-component cohort JSON: `docs/devlog/modules/analyses/real-pe/cohorts/03-isth-major-bleed-dx-component.json`
- ICH outcome cohort JSON: `docs/devlog/modules/analyses/real-pe/cohorts/04-intracranial-hemorrhage.json`
- Existing cohort fixture patterns to emulate: `backend/database/fixtures/designs/cohort_definitions/ckd-1-3-new-user-nsaid-initiators-ibuprofen-or-naproxen.json`
- Existing estimation fixture patterns to emulate: `backend/database/fixtures/designs/estimation_analyses/s7-simvastatin-vs-atorvastatin-*.json`
- Existing characterization fixture patterns to emulate: `backend/database/fixtures/designs/characterizations/study-5-baseline-characterization-post-mi-clopidogrel-vs-aspirin-initiators.json`

Follow the scaffold, observe the gates, and document what you did in `IMPLEMENTATION_LOG.md` as you go.
