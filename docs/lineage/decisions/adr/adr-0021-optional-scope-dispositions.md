---
doc_type: adr
status: accepted
date: 2026-06-21
owner: acumenus
module: platform
lineage_anchor: true
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - templates/runtime/orchestration/airflow_backend.py
  - templates/runtime/orchestration/dagster_backend.py
  - templates/runtime/orchestration/temporal_backend.py
  - frontend/src/features/data-sources/components/add-source-steps/DatabaseStep.tsx
  - frontend/src/features/publish/components/ExportControls.tsx
---

# ADR-0021 — Dispositions for optional / "coming soon" product scope

## Context

The 2026-06-18 application-completion audit
(`docs/lineage/plans/open/2026-06-18-application-completion-plan.md`, Phase 9)
flagged several surfaces that read as unfinished *core* product promises rather
than deliberate scope:

- **Cloud warehouse connectors** (BigQuery, Redshift, Snowflake, Databricks,
  Cloud Spanner) rendered as a "Coming Soon" grid in the add-source wizard, with
  no implementation behind them.
- **Airflow / Dagster / Temporal** orchestration backends shipped as
  `NotImplementedError` "Phase 0 stub"s (Prefect is the implemented default).
- **DOCX / XLSX** publish-export controls shown with "Coming soon" badges and no
  backend.

Phase 9's acceptance is that every deferred optional surface becomes either a
closed decision record or a committed plan — not an indefinite placeholder.

## Decision (2026-06-21)

| Surface | Disposition | Rationale |
|---|---|---|
| Cloud warehouse connectors | **Enterprise-only** | Keep visible but gate behind an enterprise tier rather than implying imminent community availability. They remain a real roadmap commitment, scoped to Enterprise. |
| Airflow / Dagster / Temporal backends | **Developer-extension examples** | Prefect is the shipped orchestration backend. The other three are intentional extension points demonstrating the portable `OrchestrationBackend` seam — not core product promises. Relabeled accordingly (this ADR's commit). |
| DOCX / XLSX publish export | **Implement** | These are reasonable, bounded additions to the existing publish-export path; build the backends and wire the controls. |

## Consequences / status

- **Orchestration (done in this commit):** the three backend modules and their
  test were relabeled from "Phase 0 stub" to "developer-extension example"
  (docstrings + `NotImplementedError` messages + `test_orchestration_stubs.py`
  match). Prefect remains the only `available` selectable backend. This closes
  the Phase 9 C2 question and supersedes the "Phase 0 stub" framing of ADR-0002.
- **Connectors:** marked enterprise-only here. The add-source wizard still labels
  them "Coming Soon"; the visible relabel to an **Enterprise** tier badge is a
  tracked frontend follow-up (the `dataSourceIngestionResources.ts` strings recur
  across locales/sections and warrant a focused, careful i18n change rather than
  a blind sweep). No connector is selectable in the community build.
- **DOCX / XLSX (shipped):** DOCX was already live in the reachable export UI
  (`ExportPanel` → `/publish/export` → `DocxExporter`). XLSX now ships too: a new
  `XlsxExporter` (PhpSpreadsheet) wired into `PublicationService`, allowed by
  `PublicationExportRequest`, and surfaced as an "Excel Workbook" option in
  `ExportPanel`. The "coming soon" DOCX/XLSX badges flagged by the audit lived
  only in `ExportControls`, which is orphaned dead code (referenced only by its
  test, never rendered) — left in place but noted as non-reachable.

## Closure trigger

This ADR is the decision record Phase 9 requires for connectors and orchestration.
It closes when the connector enterprise relabel lands in the wizard and the
DOCX/XLSX export backends ship (at which point Phase 5's export-reconciliation
item also closes).
