---
doc_type: lineage
status: active
date: 2026-05-10
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - scripts/docs/catalog_lineage_docs.py
related_prs: []
---

# Developer Lineage

This directory is the target home for documentation whose purpose is to help a
developer understand how Parthenon became what it is: decisions, shipped phases,
module histories, implementation handoffs, active plans, and archived plans.

Agents and contributors must read
`docs/lineage/document-authoring-governance.md` before creating, moving, or
materially rewriting tracked Markdown or MDX documents.

The goal is not to preserve every scratch note forever. The goal is to make each
surviving Markdown file answer at least one of these questions:

- What decision was made?
- What shipped?
- What code or operational behavior does this document explain?
- What plan is still open?
- What historical plan was superseded, and by what?
- What should a future developer read before changing a module?

## Target Taxonomy

```text
docs/lineage/
  catalog.md
  frontmatter-baseline.txt
  timeline/
    phases/
    releases/
    sessions/
  modules/
    abby-ai/
    analyses/
    auth/
    commons/
    data-explorer/
    fhir/
    finngen/
    genomics/
    gis/
    heor/
    imaging/
    ingestion/
    poseidon/
    morpheus/
    publish/
    solr/
    ux/
  decisions/
    adr/
  design/
    architecture/
    specs/
  plans/
    open/
    review/
    closed/
  handoffs/
  operations/
  archive/
    prompts/
    plans/
    specs/
```

Most developer lineage has now been moved out of `docs/devlog`,
`docs/superpowers`, `docs/handoffs`, and the old top-level
`docs/architecture` root. Keep using phased passes for future cleanup so link
changes, Docusaurus builds, and Git history remain reviewable.

## Canonical Homes

| Corpus | Canonical path |
|---|---|
| ADRs | `docs/lineage/decisions/adr/` |
| Module histories | `docs/lineage/modules/` |
| Phase records | `docs/lineage/timeline/phases/` |
| Release records | `docs/lineage/timeline/releases/` |
| Dated session notes | `docs/lineage/timeline/sessions/` |
| Current/recent plans | `docs/lineage/plans/open/` |
| Current/recent design specs | `docs/lineage/design/specs/` |
| Legacy plans/specs | `docs/lineage/archive/` |
| Operations/process notes | `docs/lineage/operations/` |
| Handoffs | `docs/lineage/handoffs/` |

## Frontmatter Contract

New tracked Markdown/MDX files outside generated API output must start with:

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

Use `lineage_anchor: true` only for documents that should be part of the
developer lineage. Public user docs, translations, and generated API docs do not
need to be lineage anchors.

## Lifecycle Rules

- `status: open` means the document can still drive implementation.
- `status: active` means the document is current reference material.
- `status: accepted` is for ADRs and settled decisions.
- `status: shipped` means it records what landed.
- `status: superseded` must include `superseded_by`.
- `status: historical` preserves context but should not be treated as current
  implementation guidance.
- `status: archived` is retained for traceability only.

## Catalog

Regenerate the catalogue after doc movement or classification work:

```bash
python3 scripts/docs/catalog_lineage_docs.py --write-catalog
```

Check that new docs are classified, placed under an approved corpus, and carry
valid lifecycle metadata:

```bash
python3 scripts/docs/catalog_lineage_docs.py --check-frontmatter
```
