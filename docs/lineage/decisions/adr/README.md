---
doc_type: adr
status: active
date: 2026-05-10
owner: acumenus
module: docs
lineage_anchor: true
supersedes:
  - docs/adr/
  - docs/architecture/adr-*.md
superseded_by: null
related_code:
  - templates/tests/test_adrs.py
related_prs: []
---

# Architecture Decision Records

This directory is the canonical home for Parthenon ADRs. The ADR corpus was
consolidated here from two older locations:

- `docs/adr/`
- `docs/architecture/adr-*.md`

Historical plans and devlogs may still mention the old paths because they record
how work was executed at the time. New implementation work should link to this
directory.

## Current ADRs

| ADR | File |
|---|---|
| 0001 | `0001-node-sdk-design.md` |
| 0002 | `0002-orchestration-backend.md` |
| 0003 | `0003-template-manifest-format.md` |
| 0004 | `0004-phase-1-node-design.md` |
| 0005 | `0005-imaging-vocabulary-namespace.md` |
| 0006 | `0006-pro-instrument-framework.md` |
| 0007 | `0007-fhir-anonymizer-template.md` |
| 0008 | `0008-fhir-to-omop-architecture.md` |
| 0009 | `adr-0009-phase-2-ner-node-design.md` |
| 0010 | `adr-0010-mimic-iv-etl-strategy.md` |
| 0011 | `adr-0011-sdtm-to-omop-bridge.md` |
| 0012 | `adr-0012-scispacy-backend.md` |
| 0013 | `adr-0013-llettuce-eval-and-graduation.md` |
| 0014 | `adr-0014-artemis-regimen-extraction.md` |
| 0015 | `adr-0015-sql-file-reader.md` |
| 0016 | `adr-0016-claims-to-omop-cost-projection.md` |
| 0017 | `adr-0017-registry-to-omop-strategy.md` |
| 0018 | `adr-0018-lis-lab-to-omop-tiering.md` |
| 0019 | `adr-0019-concept-mapping-retrieve-rerank.md` |
| Legacy platform ADR 001 | `adr-001-single-database-schema-isolation.md` |
| Legacy platform ADR 002 | `adr-002-omop-cdm-read-only-pattern.md` |
| Legacy platform ADR 003 | `adr-003-laravel-sanctum-auth-flow.md` |
| Legacy platform ADR 004 | `adr-004-multi-source-achilles-execution.md` |
| Legacy platform ADR 005 | `adr-005-frontend-api-layer-tanstack-query.md` |
| Legacy platform ADR 006 | `adr-006-docker-compose-single-host.md` |
| Legacy platform ADR 007 | `adr-007-finngen-workbench-r-runtime.md` |
| Legacy platform ADR 008 | `adr-008-highsec-rbac-model.md` |

The mixed numbering is preserved for history. Future ADRs should use the
four-digit sequence.
