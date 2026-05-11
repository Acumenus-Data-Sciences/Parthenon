---
doc_type: reference
status: historical
date: 2026-05-11
owner: acumenus
module: docs
lineage_anchor: false
supersedes: []
superseded_by: docs/lineage/
related_code:
  - scripts/docs/catalog_lineage_docs.py
related_prs: []
---

# Development Log Transition

The developer lineage corpus has moved to `docs/lineage/`.

Use these canonical homes:

| Former corpus | Canonical home |
|---|---|
| `docs/devlog/modules/` | `docs/lineage/modules/` |
| `docs/devlog/phases/` | `docs/lineage/timeline/phases/` |
| `docs/devlog/releases/` | `docs/lineage/timeline/releases/` |
| `docs/devlog/process/` | `docs/lineage/operations/` |
| `docs/devlog/plans/` | `docs/lineage/archive/plans/` |
| `docs/devlog/specs/` | `docs/lineage/archive/specs/` |
| `docs/devlog/strategy/` | `docs/lineage/design/strategy/` |
| root dated `docs/devlog/2026-*.md` notes | `docs/lineage/timeline/sessions/2026/` |

The remaining files in this directory are short archived pointers for paths
that were duplicated elsewhere before the lineage cleanup.
