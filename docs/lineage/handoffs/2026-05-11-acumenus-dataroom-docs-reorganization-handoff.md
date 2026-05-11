---
doc_type: handoff
status: active
date: 2026-05-11
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - scripts/docs/catalog_lineage_docs.py
related_prs: []
---

# Acumenus Data Room Docs Reorganization Handoff

**Audience:** agent maintaining `/home/smudoshi/Github/acumenus-dataroom`

**Source repo:** `/home/smudoshi/Github/Parthenon`

**Goal:** update the data-room application, engineering portal, and any
document-sync assumptions so they understand the reorganized Parthenon docs
lineage instead of treating old paths or stale plans as current guidance.

## What changed in Parthenon

The Parthenon docs cleanup is complete for now. The surviving developer-facing
Markdown corpus was reconciled into a lineage model that makes each document's
purpose and lifecycle explicit.

Canonical entry points:

- `docs/lineage/document-authoring-governance.md` defines the rules future
  agents must read before creating, moving, or materially rewriting Markdown or
  MDX documents.
- `docs/lineage/catalog.md` is the generated inventory of tracked Markdown and
  MDX documents, including lifecycle classification and frontmatter status.
- `docs/lineage/README.md` explains the taxonomy and frontmatter contract.
- `docs/lineage/plans/open/README.md` is the active WIP-plan backlog.
- `docs/lineage/plans/closed/` holds plans that have shipped or been
  superseded with evidence.
- `docs/lineage/reorganization-audit-2026-05-10.md` records the cleanup
  rationale, reviewed corpora, and keep/remove rules.

Important commits:

- `d5ab9581a docs: mark final open lineage backlog`
- `36024a740 docs: add document authoring governance`

## Current WIP semantics

The remaining files under `docs/lineage/plans/open/` are intentional WIP, not
cleanup leftovers. At handoff time, there are nine open implementation plans
plus `open/README.md`.

The open-plan README states why each plan remains open and what evidence would
close it. Data-room views should preserve that distinction:

- `status: open` means actionable WIP.
- `status: shipped` means historical closeout evidence.
- `status: superseded` must point at the replacement artifact.
- `status: historical` or `status: archived` should not be shown as current
  implementation guidance.

Do not infer stale work from age alone. Use frontmatter status and the open
backlog index.

## Why acumenus-dataroom needs attention

The data-room repo has its own docs-sync and engineering surfaces. If any of
them ingest, mirror, summarize, or deep-link Parthenon documentation, they
should now prefer the lineage catalog and lifecycle metadata instead of path
heuristics.

Known relevant dataroom surface:

- `/home/smudoshi/Github/acumenus-dataroom/docs/DOCS_SYNC.md`
- the engineering portal/reference surfaces that may expose repo docs, build
  metadata, Graphify views, screenshots, or document inventories
- any seed data, room template, checklist, or backoffice view that links to old
  Parthenon documentation paths

Old Parthenon paths such as `docs/superpowers/plans/`, top-level
`docs/architecture/`, and top-level `docs/handoffs/` are no longer canonical
for developer lineage. Do not recreate those locations in the data room.

## Recommended dataroom update

1. Inspect current dataroom references to Parthenon documentation.
   Search for `Parthenon`, `docs/superpowers`, `docs/architecture`,
   `docs/handoffs`, `docs/lineage`, and `catalog.md`.

2. If dataroom imports Parthenon repo docs, make
   `docs/lineage/catalog.md` the preferred source manifest.
   Parse frontmatter fields such as `doc_type`, `status`, `module`,
   `lineage_anchor`, `supersedes`, `superseded_by`, `related_code`, and
   `related_prs`.

3. Update UI grouping to lifecycle-aware buckets:
   active WIP, accepted decisions, shipped closeouts, active references,
   historical context, archived traceability.

4. Treat `docs/lineage/plans/open/README.md` as the current action backlog.
   Do not present every open-plan file as an independent untriaged problem
   without the README context.

5. If a sync or mirror process excludes archives, keep that default for normal
   investor-facing rooms, but provide an engineering-only way to inspect
   historical lineage when debugging project history.

6. Update old deep links or checklist references to point at the new canonical
   files listed in this handoff.

7. Preserve any daily-refresh behavior for engineering/reference surfaces that
   expose live Parthenon docs, Graphify output, screenshots, or build metadata.
   A stale developer portal will quickly misrepresent the lineage state.

## Validation checklist for the dataroom maintainer

Before considering the dataroom side updated:

- Parthenon doc links resolve to `docs/lineage/**` or `docs/site/docs/**`
  canonical homes.
- The data-room UI does not show shipped, superseded, historical, or archived
  docs as current WIP.
- The nine current open implementation plans are visible only as intentional
  WIP, ideally through the open-plan backlog index.
- The document-sync dry run still behaves as expected.
- Any engineering/reference portal refresh still runs on the intended cadence.
- Dataroom smoke checks pass after the change.

Suggested commands in `/home/smudoshi/Github/acumenus-dataroom` after making
changes:

```bash
npm run sync:docs -- --dry-run
npm run smoke:api
npm run smoke:workflows
```

Use the repo's current runbooks if those commands have changed.

## Boundaries

- Do not modify Parthenon WIP plans from the dataroom repo. Close or supersede
  them only in Parthenon with evidence.
- Do not stage unrelated dataroom worktree changes while updating references.
- Do not treat the Parthenon docs cleanup as a request to import every
  historical or archived document into investor-facing data-room spaces.
- Do not bypass the Parthenon document governance file for future docs changes.
