---
doc_type: reference
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

# Document Authoring Governance

Read this file before creating, moving, or materially rewriting tracked
Markdown or MDX documents in this repository. The goal is to keep the docs
useful for developers who need to understand project lineage, not to preserve
unowned notes indefinitely.

## Admission rule

A new document must have a clear durable purpose. It should fit exactly one of
these roles:

- active implementation plan
- shipped closeout or phase record
- ADR or decision record
- architecture, design, or spec reference
- operational runbook or handoff
- user-facing docs-site page
- research, compliance, demo, or blog artifact with an explicit audience
- archive item retained for traceability with a clear status

Do not add scratch notes, duplicated summaries, temporary prompts, pasted chat
transcripts, or "notes for later" unless they have ownership, lifecycle status,
and a closure condition.

## Required frontmatter

Every new tracked Markdown or MDX file outside generated API output must start
with the lifecycle frontmatter described in `docs/lineage/README.md`. The
minimum contract is:

```yaml
---
doc_type: lineage | plan | spec | adr | runbook | handoff | public-doc | blog | compliance | research | reference | demo
status: open | active | accepted | shipped | superseded | historical | archived
date: YYYY-MM-DD
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
```

Use `lineage_anchor: true` only when the file should help future developers
trace decisions, implementation history, module behavior, or active work. Public
user docs, generated API docs, and translations may be useful without being
lineage anchors.

## Canonical homes

Place documents where their lifecycle is obvious:

- Active WIP plans belong in `docs/lineage/plans/open/`.
- Shipped or superseded plans belong in `docs/lineage/plans/closed/`.
- ADRs belong in `docs/lineage/decisions/adr/`.
- Architecture and specs belong under `docs/lineage/design/`.
- Module histories belong under `docs/lineage/modules/`.
- Phase, release, and session records belong under `docs/lineage/timeline/`.
- Operational handoffs and runbooks belong under `docs/lineage/handoffs/` or
  `docs/lineage/operations/`.
- User-facing docs-site pages belong under `docs/site/docs/`.

If a document does not fit a canonical home, reconsider whether it should exist.

## WIP rules

WIP is allowed, but it must be honest. A plan in `docs/lineage/plans/open/`
must state:

- what is still unmet
- what evidence would close it
- what code, ADR, release, issue, or PR it relates to
- whether it is blocked by another plan or external dependency

Keep `docs/lineage/plans/open/README.md` current whenever the open-plan backlog
changes.

## Closure rules

When work ships, close the documentation in the same change that records the
evidence:

- Move completed plans from `docs/lineage/plans/open/` to
  `docs/lineage/plans/closed/`.
- Set `status: shipped` for completed work.
- Set `status: superseded` and fill `superseded_by` when a newer artifact
  replaces the document.
- Link related code, ADRs, release notes, PRs, or closeout records.
- Leave historical context only when it still helps explain current behavior or
  a past decision.

## Review checklist

Before committing a new or moved document, verify:

- The file has one clear audience.
- The file has one canonical home.
- The lifecycle frontmatter is complete and accurate.
- The document is not duplicating an existing canonical source.
- WIP includes a closure condition.
- Shipped or superseded work links to evidence.
- The generated catalog reflects the new state.

## Required checks

Run these after adding, moving, or reclassifying documentation:

```bash
python3 scripts/docs/catalog_lineage_docs.py --write-catalog
python3 scripts/docs/catalog_lineage_docs.py --check-frontmatter
sh docs/site/scripts/check-content-tree.sh
sh docs/site/scripts/check-public-docs-current.sh
```

If code files were also changed, follow `AGENTS.md` and run:

```bash
graphify update .
```
