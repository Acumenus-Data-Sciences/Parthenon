---
doc_type: reference
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

# Documentation Map

This directory holds several different documentation corpora. Treating all of
them as one bucket is what made the tree hard to use. The current rule is:
every Markdown/MDX file should be useful because it has an explicit role.

## Primary Corpora

| Path | Purpose | Notes |
|---|---|---|
| `docs/site/` | Docusaurus source for the public user manual, install pages, i18n docs, and API entry page. | Generated API pages, build output, `.docusaurus`, and `node_modules` are ignored artifacts. |
| `docs/blog/` | Public development blog and release narrative. | Useful for chronology and external messaging, but not canonical implementation lineage. |
| `docs/lineage/` | Developer-facing project lineage catalogue and canonical history. | Module logs, phases, sessions, plans, specs, ADRs, handoffs, and operations notes live here. |
| `docs/devlog/` | Historical transition area. | Retained only for the transition index; developer lineage now lives under `docs/lineage/`. |
| `docs/superpowers/` | Historical transition area. | Former plans/specs moved to `docs/lineage/plans/open/` and `docs/lineage/design/specs/`. |
| `docs/lineage/decisions/adr/` and `docs/lineage/design/architecture/` | Architecture decisions and technical design. | ADRs are consolidated under lineage decisions; non-ADR design lineage lives under `docs/lineage/design/`. |
| `docs/ops/` | Operator runbooks and infrastructure reports. | Keep review dates and validation commands current. |
| `docs/compliance/` | Governance, audit, security, incident, and recovery documentation. | Keep owner and review cadence explicit. |
| `docs/research/` | Background research and external landscape notes. | Reference material, not source-of-truth implementation state. |
| `docs/reference/` | Curated reference corpora used by internal tools, retrieval tests, or domain background. | Keep small and link to canonical blog, Commons, lineage, or public docs instead of duplicating them. |
| `docs/demo/` | Presenter and product walkthrough runbooks. | Route-grounded and intentionally durable. |

`docs/commons/` is retained for Commons prototype assets such as diagrams,
mockups, and TypeScript sketches. Markdown lineage for Commons lives under
`docs/lineage/modules/commons/`.

## Generated Or Local Artifacts

Do not treat these as authored lineage:

- `docs/site/build/`
- `docs/site/.docusaurus/`
- `docs/site/node_modules/`
- `docs/site/docs/api/*.api.mdx`
- `docs/site/docs/api/*.json`

`docs/site/docs/api/index.mdx` is the tracked API landing page. The detailed
OpenAPI MDX/JSON files are generated locally by Docusaurus/OpenAPI tooling.

## Current First-Pass Artifacts

- `docs/lineage/reorganization-audit-2026-05-10.md` captures the initial audit,
  duplicate sets, proposed target tree, and phased consolidation plan.
- `docs/lineage/catalog.md` is generated from the current Markdown/MDX corpus.
- `docs/lineage/frontmatter-baseline.txt` is retained as a zero-debt guard for
  files that predate the lineage frontmatter contract.
- `docs/devlog/README.md`, `docs/superpowers/README.md`, and
  `docs/lineage/handoffs/README.md` are transition pointers for old top-level homes.

## Validation

Run this before adding or moving docs:

```bash
python3 scripts/docs/catalog_lineage_docs.py --check-frontmatter
sh docs/site/scripts/check-content-tree.sh
```

The lineage check allows existing baseline debt but fails if a new Markdown/MDX
file is unclassified, lands outside an approved documentation home, uses an
invalid lifecycle value, marks itself `superseded` without a successor, or uses
`doc_type: public-doc` outside `docs/site/`.
