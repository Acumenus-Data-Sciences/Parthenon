---
doc_type: reference
status: active
date: 2026-05-11
owner: acumenus
module: docs
lineage_anchor: true
supersedes:
  - docs/superpowers/plans/
superseded_by: null
related_code:
  - scripts/docs/catalog_lineage_docs.py
related_prs: []
---

# Plan Lineage

This directory holds implementation plans that are still useful to developers.

| Path | Purpose |
|---|---|
| `open/` | Current or recently active implementation plans that may still drive work. |
| `review/` | Plans awaiting closure, supersession, or acceptance review. |
| `closed/` | Plans with an explicit closeout or replacement document. |

The first reorganization pass moved the former `docs/superpowers/plans/` corpus
to `open/`. Future cleanup should close or archive individual plans only after
linking each one to the shipped module log, ADR, commit, or successor spec.
