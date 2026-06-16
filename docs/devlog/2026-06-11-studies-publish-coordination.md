---
doc_type: lineage
status: archived
date: 2026-06-11
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Studies + Publish coordination (2026-06-11)

A coordinated pass that (1) fixed the Studies detail page so every tab populates
from real data, and (2) wired the Studies "Manuscript" composer and the
`/publish` workspace into one coherent, OHDSI-standard publication flow.

## Part 1 — Studies tabs populate from real data

The Hypertension v4 analytics were complete (4 completed executions, gates,
synthesis, packages) but the tabs were empty: results live in
`analysis_executions.result_json` (morph-keyed), while the UI read the empty
`study_results`/`study_executions` tables, and the `ManuscriptComposer` was
unreachable.

- **StudyResultProjector** + **AnalysisExecutionObserver** project completed
  executions into curated `study_results` rows (savepoint-guarded);
  `studies:backfill-results` for existing studies. (`255c6634d`)
- **attachLatestExecutions** on `/analyses` and `/show` so the Analyses tab and
  manuscript gate see real execution status (was "Not executed"). (`255c6634d`)
- Typed Results renderer (effect_estimate / incidence_rate / characterization)
  replaced a `String(val)` grid that printed `[object Object]`. (`255c6634d`)
- **Per-contrast study-diagnostics gate**: `evaluateEstimationGates` clobbered a
  single `default` gate row per contrast, so one unbalanceable contrast failed
  the whole study and blinded a clean one. New `evaluateStudyEstimationGates`
  passes when ≥1 contrast clears; the rest are blinded individually. HTN v4's
  normotensive contrast is now publishable; the delay-strata one stays
  withheld. (`f69165ea2`)

Lineage: `docs/lineage/operations/2026-06-11-study-results-projection.md`.

## Part 2 — Coordinated Studies ↔ Publish (P1–P5)

Two publication pipelines (the deterministic, gate-aware composer; the free-form
`/publish` WYSIWYG) shared only the export sink, and the one link between them
was broken (`/publish?studyId=` dropped its query string on redirect).

- **P1 foundation** — gold `.btn-publish` "publishing" accent; shared
  `components/manuscript` primitives (section renderer, author byline, export
  menu, one `downloadBlob`); canonical `ManuscriptDocument` type. (`107c501eb`)
- **P2 bridge** — `ManuscriptDraftFactory` + `POST /studies/{study}/manuscript/draft`
  seed a study-linked, gate-aware `/publish` draft from the composed manuscript
  (idempotent via `publication_drafts.source`); "Open in Publisher" opens the
  pre-filled draft; "Back to study" return link. (`107c501eb`)
  Lineage: `docs/lineage/operations/2026-06-11-manuscript-publisher-bridge.md`.
- **P3 re-integration** (functional orphans surfaced, none deleted):
  - OHDSI **report-bundle import/export** UI (was built, unreachable). (`f70e4e01a`)
  - **PNG/SVG figure export** restored client-side. (`45767cd2b`)
  - DocumentPreview renders composer `###` subheadings. (`9aae6b74e`)
  - "From studies" tab → rich study-first picker (status/type badges, completed
    counts, select-all, open-study); `ResultsSummarySection` typed metrics in the
    editor's structured view across all 7 OHDSI analysis types. (`55a771f9f`)
  - Tokenized the agent panel + gold publishing surfaces. (`0e1a203cf`)
- **P4 tabs** — 14 flat Studies tabs grouped by OHDSI lifecycle: Design →
  Execute → Evidence → Manage; `progress` folded into Analyses; design-tab
  height fixed. (`10d029022`)
- **P5 polish** — shared `AgentCopilotShell` (de-dupes the two copilots);
  privacy-safe study JSON export (names, not emails). (`c9bb8c92d`)

## Deferred (own focused PRs)

- Split the 1,095-line `useStudies.ts` (maintainability; not attempted here to
  avoid risk across ~40 hooks).
- Delete the ~4,000-LOC v1 Design layer (reachable only via `?wb=v1`).
- Full i18n of the remaining hardcoded `/publish` strings (10-locale parity).

## Net

The flow Studies → Manuscript → **Open in Publisher** → edit (study-first picker,
typed structured view, AI narrative) → export docx/pdf/figures/PNG/SVG or an
OHDSI sharing bundle → **Back to study** now reads as one gold-accented
publishing identity, distinct from the teal Studies workspace.
