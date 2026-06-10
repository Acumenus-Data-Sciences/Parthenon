---
doc_type: operations
date: 2026-06-09
owner: acumenus
module: studies
related_adr: docs/lineage/decisions/adr/adr-0020-protocol-to-publication-pipeline.md
---
# Migration: `study_gates` (Clio gate ledger, ADR-0020 Phase 3)

## What

Adds the `app.study_gates` table — the ledger spine of the Clio scientific gate
layer. One row per `(study_id, stage, gate_key)` recording the evaluated
`metrics_json`, the `threshold_json` they were checked against, the resulting
`status` (`pending|passed|failed|overridden|approved`), the `decision`
(`auto|human`), and — for overrides — the mandatory `override_rationale` plus
`decided_by`/`decided_at`.

Migration: `backend/database/migrations/2026_06_09_110001_create_study_gates_table.php`

## Safety

- **Additive only** — a single new table with a `study_id` FK
  (`cascadeOnDelete`) and a nullable `decided_by` FK (`nullOnDelete`). No
  existing table is altered; `down()` is `dropIfExists('study_gates')`.
- **Inert by default** — the gate layer is governed by
  `config('studies.gating_enabled')` (env `STUDIES_GATING_ENABLED`, default
  `false`). With gating off, no gate is evaluated or enforced and estimation
  results are never blinded, so existing study behaviour is unchanged.

## Apply

```bash
./deploy.sh --db   # runs each pending migration via --path=…--force
```

## Why

Converts the diagnostics Parthenon already computes (DQD, cohort counts, PS
AUC / SMD / equipoise, empirical-calibration control counts) into enforced,
overridable, audited gates. This closes the study-114 failure mode where an
invalid estimation (propensity-score separation; an inert negative-control
panel) "completed" silently. See ADR-0020 for the full pipeline.
