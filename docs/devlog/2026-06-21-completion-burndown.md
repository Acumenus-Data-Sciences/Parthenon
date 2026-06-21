---
doc_type: lineage
status: historical
date: 2026-06-21
owner: acumenus
module: platform
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - docs/lineage/plans/open/2026-06-18-application-completion-plan.md
  - docs/lineage/plans/open/2026-06-21-remaining-53-collaborative-execution-plan.md
related_prs: []
---

# Devlog — Production-Readiness Completion Burn-down (2026-06-21)

A multi-pass burn-down of the application-completion plan
(`2026-06-18-application-completion-plan.md`), moving it from **76 → 125 of 178**
checklist items, all evidence-linked. Work was scoped with read-only agent swarms
and each code change passed the pre-commit gate (Pint, PHPStan L8, tsc, ESLint,
Vitest, vite build) before landing.

## What shipped

**Protocol-to-publication (ADR-0020) closeout.** Reconciled the plan against the
A1–A5/Gate-B work via an 11-section evidence audit (each newly-done claim
adversarially re-verified, several by re-running the cited tests). Checked off the
full P0–P6 block + HADES sidecar verification + sidecar contract tests + the
`r_not_implemented` decision + the phenotype-validation backlog; shipped the
per-phase closeout `modules/studies/2026-06-21-protocol-to-publication-closeout.md`.

**Operability (Gate B / Phase 8).**
- `php artisan sidecars:readiness` — probes darkstar/python-ai/redis/orthanc/
  hecate/fhir-to-cdm/templates + (added this session) anonymizer + scispacy, with
  `--json` + non-zero exit for promotion gates.
- DR-restore drill + runbook, environment promotion-gates + readiness-matrix doc,
  test skip-inventory (every skipped cluster classified; the one bug-masking skip
  resolved), and a timestamped validation-gate archive.

**Features.**
- **FHIR bulk-export page** (`administration/FhirExportPage`) wired to the existing
  tested `$export` backend — create / poll / download NDJSON.
- **XLSX manuscript export** (`XlsxExporter`) + confirmed DOCX already live; removed
  the orphaned `ExportControls` dead code.
- **Source Profiler cross-source comparison API** (`GET /scan-profiles/compare`).
- **i18n 401 localization** — fixed the locale-propagation defect feeding the
  unauthenticated 401 (the only bug-masking skip), un-skipped its test.
- **Sidecar UI diagnostics** — estimation/prediction results surface the backend's
  actionable package-naming message.
- **Minimal CDM fixture** — the read-path `CdmModel` tests now execute.
- **Abby data-interrogation backend tests** (auth/permission/provenance).

**Decisions (ADR-0021).** Cloud connectors → enterprise-only; Airflow/Dagster/
Temporal → developer-extension examples (relabeled in code); DOCX/XLSX → implement;
federated mapping → hold-final. Plus the `php artisan test` → `composer test`
bounded-alias decision (Phase 1).

## Process notes

- Two read-only scoping swarms (audit of all 11 sections; implementation-scoping of
  8 candidate items) drove efficient, evidence-based implementation.
- Caught and cleanly reverted a self-inflicted git mis-add (an `git add <dir>` swept
  an untracked WIP doc into a commit) — untracked it, preserved the working copy,
  CI unaffected. Lesson recorded: stage specific files, not directories.
- An ineffective conservative chunk-split was tried and reverted rather than shipped
  (lucide was already a separate chunk; the 5.9 MB eager index was unchanged) — the
  real reduction needs bundle analysis + browser smoke-test.

## What remains

The 53 still-open items are categorized in the completion plan's status block and
turned into a collaborative playbook:
`2026-06-21-remaining-53-collaborative-execution-plan.md` — large FE features with
shipped backends, separate committed ML/release plans, hosted-smoke/environment
gates, runtime-QA-gated frontend perf, advisory lint, and the operator-scheduled
study-114 live gate. None is forgotten; each has a named owner and acceptance gate.
