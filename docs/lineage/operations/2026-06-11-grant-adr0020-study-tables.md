---
doc_type: runbook
status: active
date: 2026-06-11
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_06_11_120000_grant_adr0020_study_tables_to_parthenon_app.php
related_prs: []
related_adr: docs/lineage/decisions/adr/adr-0020-protocol-to-publication-pipeline.md
---
# Migration: grant ADR-0020 study tables to `parthenon_app`

## What

Grants runtime DML privileges (`SELECT, INSERT, UPDATE, DELETE, REFERENCES,
TRIGGER` + sequence `USAGE`) on nine `app.*` tables that were created by
`parthenon_migrator` without ever GRANTing the runtime role:

`study_gates`, `study_packages`, `study_design_agent_sessions`,
`agent_sessions`, `consent_decisions`, `note_nlp_audit`,
`parthenon_concept_map`, `parthenon_mapping_review_queue`,
`unmapped_concepts_queue`.

Migration: `backend/database/migrations/2026_06_11_120000_grant_adr0020_study_tables_to_parthenon_app.php`

## Why

Surfaced 2026-06-11 during the first production Abby protocol-to-publication run
(Hypertension v4). `POST /studies/{study}/gates/evaluate` and
`POST /studies/{study}/package` both returned HTTP 500 with
`SQLSTATE[42501]: permission denied for table study_gates / study_packages`.
An audit of `app.*` found nine tables in the same state — created with DDL but
no runtime GRANT. Per HIGHSEC §4.1 / `project_parthenon_pg_roles`,
`parthenon_migrator` owns DDL and `parthenon_app` holds runtime DML only, so
each table needs an explicit GRANT.

## Safety

- **Additive only** — GRANTs to an existing role on existing tables. No schema
  change, no data change. Each grant is guarded by `pg_roles` + table-existence
  checks and is idempotent; `down()` REVOKEs symmetrically.
- Sequence grants are guarded by `relkind='S'` existence (tables without an
  `_id_seq` are skipped).

## Apply

```bash
./deploy.sh --db   # runs each pending migration via --path=…--force
```

Already applied to the live host DB on 2026-06-11 via `--path`; this migration
makes the grants reproducible on fresh deploys.
