---
doc_type: plan
status: open
date: 2026-06-21
owner: acumenus
module: platform
lineage_anchor: false
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - docs/lineage/plans/open/2026-06-18-application-completion-plan.md
  - backend/app/Http/Controllers/Api/V1/FhirR4Controller.php
  - backend/app/Http/Controllers/Api/V1/SourceProfilerController.php
---

# Remaining-53 Collaborative Execution Plan

Companion to `2026-06-18-application-completion-plan.md` (now ~125/178 checked).
This plan turns the **53 still-open items** into a collaborative playbook: each
workstream states what exists, the concrete work, an explicit **[USER]** vs
**[CLAUDE]** split, the files/commands, the acceptance gate, and a recommended
order. Legend: **[USER]** = a decision, credential, hosted run, or visual sign-off
only you can give; **[CLAUDE]** = implementation I can do once unblocked.

> How we work each item: (1) you confirm the **[USER]** inputs at the top of a
> workstream; (2) I implement the **[CLAUDE]** steps with tests; (3) we verify
> against the acceptance gate; (4) I commit + check the box in the completion plan.
> Every code change runs the pre-commit gate (Pint, PHPStan L8, tsc, ESLint,
> Vitest, vite build) before it lands.

---

## Workstream 1 — Finish the two shipped-backend features (highest value, low risk)

Both backends shipped this session; only the UI / engine extension remains.

### 1a. Source Profiler comparison UI + delta extension (Phase 4)
- **State:** cross-source API `GET /scan-profiles/compare` + `CompareProfilesRequest`
  + `CrossSourceCompareTest` shipped (`a7b741ec9`). The diff engine
  (`ScanComparisonService`) already emits schema / row-count / null-rate / distinct
  deltas. Frontend placeholder at `SourceProfilerPage.tsx:481` is still empty.
- **[CLAUDE]** Build `frontend/src/features/etl/components/ScanComparisonView.tsx`
  (summary band + regressions/improvements/schema-changes tables + loading/empty/
  error states), `fetchCrossComparison` in `etl/api.ts`, `useCrossComparison` hook,
  and wire `SourceProfilerPage.tsx` (replace the no-op `onCompare`, add a
  "Compare against…" baseline selector for cross-entity picks). Add Vitest +
  i18n in `etlAqueductResources.ts`.
- **[CLAUDE]** Extend `ScanComparisonService` with **vocabulary** + **distribution**
  deltas (the two delta dimensions the audit found missing).
- **[USER]** Sign off on the comparison UX (the cross-entity baseline-picker
  interaction) after I post a screenshot/build.
- **Acceptance:** `SourceProfilerPage` shows a real diff for two profiles from
  different sources; `npm run build` + Vitest green; completion-plan Phase 4
  "Complete Source Profiler comparison" sub-items checked.

### 1b. FHIR export hardening: cancel + audit logging + retention (Phase 4)
- **State:** the export page + `$export` backend ship (`ba395805a`); the page
  polls + downloads. Three backend gaps remain.
- **[USER]** Decide the **download-retention window** (e.g. 7 days) and whether
  cancellation should hard-stop the job or mark it `cancelled` and let it finish.
- **[CLAUDE]** Add `DELETE /fhir/$export/{id}` (cancel) → new `cancelled` status +
  a mid-run check in `RunFhirExportJob`; emit an **audit-log** entry on
  start/cancel/download (the app's audit-logging middleware/service); a scheduled
  **retention prune** of expired export files + a `expires_at` column. Add the
  cancellation + retention feature tests (`FhirBulkExportApiTest`).
- **Acceptance:** cancel/audit/retention tested; completion-plan Phase 4
  "Define export request shape … audit logging and download retention" +
  "… cancellation …" sub-items checked.

---

## Workstream 2 — Connector "Enterprise" UI relabel (Phase 4/9, decided, i18n-gated)

- **State:** ADR-0021 decided **enterprise-only**; the wizard still shows
  "Coming Soon" because the `dataSourceIngestionResources.ts` strings recur across
  ~11 locale blocks and a blind sweep is risky.
- **[USER]** Confirm the badge copy ("Enterprise" / "Enterprise tier") and whether
  to localize it or keep the English tier name in all locales.
- **[CLAUDE]** Add `enterprise` / `enterpriseShort` keys to all locale blocks
  (carefully, block-by-block) and switch `DatabaseStep.tsx` from the coming-soon
  group to an Enterprise-tier badge.
- **Acceptance:** wizard shows an Enterprise tier (not "coming soon"); i18n parity
  test green; completion-plan "Optional surfaces no longer look like unfinished
  core product promises" checked.

---

## Workstream 3 — The 8 ingestion-template Phase-4 plans (separate committed plans)

Each is its own `plans/open/2026-05-07-…` plan; most are ML/research efforts, not
quick slices. Recommend tackling in this order; **[USER]** picks scope per item.

| Plan | Nature | First step |
|---|---|---|
| Cross-encoder rerank ship/hold | **decision** | [USER] ship vs hold → [CLAUDE] record + wire/remove |
| Quarterly upstream-diff workflows | small | [CLAUDE] adjust the existing weekly crons to the quarterly spec |
| Reviewer UI timed test | medium | [CLAUDE] add the timed reviewer test against seeded data |
| Auto-approval calibration | medium | [USER] threshold policy → [CLAUDE] calibration + tests |
| Llettuce reevaluation | research | [USER]+[CLAUDE] run the eval harness (sidecar) |
| FHIR Bulk Data reader | feature | [CLAUDE] `FhirBulkClaimsReader` + streaming manifest |
| BGE-base per-vocabulary LoRA | **ML training** | [USER] GPU/time budget → [CLAUDE] training run |
| Federated mapping spike | **hold-final** | blocked on Hive Networks (ADR-0021) |

- **Acceptance:** each plan moves to `plans/closed/` with its own closeout, or is
  explicitly re-scoped; completion-plan Phase 4 template sub-items checked as they close.

---

## Workstream 4 — Signed release packaging (Phase 8, needs release infra)

- **State:** the signing CI (`build-rust-installer-gui.yml`) exists (macOS
  notarize, Windows trusted-signing, Linux deb/rpm/AppImage, SLSA) but has never
  produced attached signed assets — it only runs on `release` events with secrets.
- **[USER]** Provide/confirm the signing secrets (Apple notarization creds, Windows
  trusted-signing, GPG) in repo secrets, and cut a tagged release.
- **[CLAUDE]** Verify the release workflow end-to-end on a pre-release tag, capture
  signature-verification output, and write the release-evidence closeout.
- **Acceptance:** a release has signed, independently-verifiable macOS/Windows/Linux
  assets; completion-plan Phase 8 release items checked.

---

## Workstream 5 — Hosted-smoke / environment-dependent gates (Phase 6/4)

These need a running sidecar or seeded data; best done against hosted staging.

- **FinnGen/genomics E2E readiness** — **[USER]** confirm hosted FinnGen source is
  seeded (`php artisan finngen:setup-source`); **[CLAUDE]** turn the `test.skip`
  readiness gates into seeded fixtures or explicit prerequisites.
- **PACS/Orthanc hosted smoke** — **[USER]** confirm Orthanc creds; **[CLAUDE]** add
  a hosted smoke proving credentials/stats-refresh/study-browser (kept separate
  from the mocked Laravel PACS-auth unit test).
- **Local-model CE validation** — **[USER]** run the local-model agent backend with
  a model loaded; **[CLAUDE]** validate behavior + record a scoped follow-up only
  for remaining work.
- **MIMIC/testcontainer seeding + ARTEMIS v0.2.0 artifacts** — **[CLAUDE]** make the
  testcontainer vocab seed reproducible and run the ARTEMIS workflow to materialize
  the v0.2.0 patterns.
- **Acceptance:** the corresponding env-bound skips become passing fixtures or
  documented hosted-only checks; completion-plan Phase 6 readiness items checked.

---

## Workstream 6 — Frontend quality (Phase 7, runtime-QA gated)

- **Index chunk reduction** — **[CLAUDE]** add `rollup-plugin-visualizer`, analyze
  the ~5.9 MB eager index chunk, and propose a conservative vendor split + a
  bundle-size gate; **[USER]** browser-smoke-test the built app (a vendor split can
  cause init-order errors invisible to `vite build`).
- **33 lint warnings** — **[CLAUDE]** work them per-case (22 `set-state-in-effect`
  are behavior-sensitive — each needs a focused review + test).
- **Responsive screenshots** — **[USER]+[CLAUDE]** capture/verify key layouts.
- **Acceptance:** `npm run lint` at zero (or documented accepted exceptions);
  documented bundle thresholds; completion-plan Phase 7 items checked.

---

## Workstream 7 — The live prod gate (Phase 3, operator-scheduled)

- **State:** protocol-to-publication P0–P6 shipped + offline/dry-walk green; the
  only blocker to closing that plan is the live run.
- **[USER]** Schedule a maintenance window for the study-114 `execute=true`
  orchestration (~90 min of prod analytics on the shared PG).
- **[CLAUDE]** Drive the run, confirm the S5 halt with estimates blinded against
  real analytics, then move the protocol-to-publication plan to `plans/closed/`.
- **Acceptance:** study-114 live gated re-run passes; protocol-to-publication plan
  closed.

---

## Recommended sequence

1. **Workstream 1** (finish the two shipped backends — highest value, I can start
   immediately on 1a's UI and the profiler delta extension).
2. **Workstream 2** (connector relabel — quick once copy is confirmed).
3. **Workstream 6** lint burn-down (incremental, low coordination).
4. **Workstream 5** hosted gates + **Workstream 4** signed releases (need your
   infra/creds).
5. **Workstream 3** template plans (scope each with you).
6. **Workstream 7** live prod gate (schedule when convenient).

Each completed item gets checked off in
`2026-06-18-application-completion-plan.md` with evidence, the same way the first
125 were.
