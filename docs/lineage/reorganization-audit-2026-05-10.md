---
doc_type: lineage
status: active
date: 2026-05-10
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Documentation Lineage Reorganization Audit

Date: 2026-05-10

Scope: tracked and generated Markdown/MDX under `docs/`, with emphasis on keeping
developer-facing project lineage useful, searchable, and distinct from generated
Docusaurus artifacts.

## Executive finding

The docs tree is not one documentation corpus. It is at least six corpora mixed
under one directory:

1. Public Docusaurus user manual and API entry pages.
2. Public development blog posts and release notes.
3. Developer lineage: phase logs, module logs, process notes, session notes,
   runbooks, and implementation closeouts.
4. Design lineage: ADRs, architecture docs, specs, and active plans.
5. Operational/compliance artifacts.
6. Generated/local docs artifacts from Docusaurus, OpenAPI generation, build
   output, and dependencies.

The cleanup should not start by deleting files. It should first make each file
declare what role it plays, then consolidate duplicated sources, then move
historical material into a stable lineage/archive taxonomy.

## Inventory

Source-of-truth checks used:

- `git ls-files 'docs/**/*.md' 'docs/**/*.mdx'`
- `find docs -path 'docs/site/node_modules' -prune -o -path 'docs/site/build' -prune -o -path 'docs/site/.docusaurus' -prune -o -type f \( -name '*.md' -o -name '*.mdx' \)`
- `git ls-files -o -i --exclude-standard 'docs/**/*.md' 'docs/**/*.mdx'`
- `git status --ignored --short docs/site/docs/api`
- `sh docs/site/scripts/check-content-tree.sh`

### Corpus counts

| Corpus | Count | Notes |
|---|---:|---|
| Tracked Markdown/MDX | 869 | Canonical source set to reorganize. |
| Tracked Markdown/MDX lines | 397,064 | Several large plan/spec files dominate the corpus. |
| Non-generated Markdown/MDX visible on disk | 1,957 | Includes ignored generated API docs currently present locally. |
| Ignored Markdown/MDX | 3,420 | Mostly `docs/site` generated/build/dependency artifacts. |
| Ignored generated API MDX under `docs/site/docs/api` | 1,088 | Build artifacts from `docusaurus-plugin-openapi-docs`. |
| Tracked API docs under `docs/site/docs/api` | 1 | Only `index.mdx`; correct source behavior. |

`docs/site/scripts/check-content-tree.sh` currently passes.

## Tracked source catalogue

| Category | Count | Current paths | Proposed disposition |
|---|---:|---|---|
| Module lineage | 166 | `docs/devlog/modules/**` | Keep as lineage, but split by module with indexes and supersession metadata. |
| Active plans | 102 | `docs/superpowers/plans/**` | Keep only open/current plans in active lineage; close or archive completed plans. |
| Public Docusaurus source | 95 | `docs/site/docs/**` excluding generated API pages | Keep under `docs/site`; add backlinks to relevant lineage docs only where useful. |
| Legacy plans | 79 | `docs/devlog/plans/**` | Archive unless still referenced by current code or open roadmap. |
| Public dev blog | 70 | `docs/blog/**` | Keep curated public narrative; do not treat blog as canonical technical lineage. |
| Process lineage | 65 | `docs/devlog/process/**` | Keep operationally useful runbooks; move transient session notes to archive. |
| Loose devlog | 53 | `docs/devlog/*.md`, `docs/devlog/architecture/**`, `docs/devlog/releases/**` | Rehome into module/process/release lineage or archive. |
| Active specs | 49 | `docs/superpowers/specs/**` | Keep current specs with status and supersession links. |
| Legacy specs | 42 | `docs/devlog/specs/**` | Archive or merge into ADR/design docs. |
| Phase lineage | 31 | `docs/devlog/phases/**` | Keep as chronological project backbone. |
| ADRs | 27 | `docs/adr/**`, `docs/architecture/adr-*` | Consolidated into `docs/lineage/decisions/adr/` during this cleanup pass. |
| Docusaurus translations | 20 | `docs/site/i18n/**` | Keep under `docs/site`; not part of lineage. |
| Architecture docs | 18 | `docs/architecture/**` excluding ADRs | Keep active architecture docs; archive dated plans if superseded. |
| Abby seed/reference duplicates | 12 | `docs/abby-seed/**` | Convert to external/reference seed corpus or remove duplicate copies. |
| Compliance | 8 | `docs/compliance/**` | Keep separately as governance evidence, with owner/review cadence. |
| Handoffs | 7 | `docs/handoffs/**` | Keep active handoffs; archive consumed prompts. |
| Operations | 5 | `docs/ops/**` | Keep as runbooks/reports with review dates. |
| Strategy | 5 | `docs/devlog/strategy/**` | Promote to `docs/lineage/strategy` or archive if superseded by README/roadmap. |
| Research | 4 | `docs/research/**` | Keep reference/research bibliography, not operational lineage. |
| Demo | 2 | `docs/demo/**` | Keep; these are route-grounded product runbooks. |
| Poseidon | 2 | `docs/poseidon/**` | Rehome under module lineage if Poseidon remains in product scope. |
| IRSF/NHS | 2 | `docs/irsf-nhs/**` | Rehome under research/handoffs depending on current status. |
| Data dictionary | 1 | `docs/data-dictionary/app-schema.md` | Keep as generated or reviewed schema reference; add generation provenance. |

## Exact duplicate files

These have identical content and should be collapsed to one canonical file plus
links or short pointers where the old path is still useful:

| Duplicate set | Recommended canonical location |
|---|---|
| `docs/abby-seed/blog/2026-03-14-abby-ohdsi-brain.md`, `docs/blog/2026-03-14-abby-ohdsi-brain.md` | `docs/blog/2026-03-14-abby-ohdsi-brain.md` |
| `docs/abby-seed/blog/2026-03-16-abby-2.0-memory-foundation.md`, `docs/blog/2026-03-16-abby-2.0-memory-foundation.md` | `docs/blog/2026-03-16-abby-2.0-memory-foundation.md` |
| `docs/abby-seed/blog/2026-03-16-abby-live-database.md`, `docs/blog/2026-03-16-abby-live-database.md` | `docs/blog/2026-03-16-abby-live-database.md` |
| `docs/abby-seed/commons/ABBY_COMPONENTS_README.md`, `docs/commons/ABBY_COMPONENTS_README.md`, `docs/commons/abby-components/README.md` | `docs/commons/abby-components/README.md` |
| `docs/abby-seed/commons/COMMONS_WORKSPACE_SPEC.md`, `docs/commons/COMMONS_WORKSPACE_SPEC.md` | `docs/commons/COMMONS_WORKSPACE_SPEC.md` or lineage module spec |
| `docs/abby-seed/devlog/process/abby-dedicated-ollama-2026-04-04.md`, `docs/devlog/process/abby-dedicated-ollama-2026-04-04.md` | `docs/devlog/process/abby-dedicated-ollama-2026-04-04.md` |
| `docs/devlog/grafana-dashboard-research.md`, `docs/research/grafana-dashboard-research.md` | `docs/research/grafana-dashboard-research.md` |
| `docs/devlog/grafana-log-dashboard-research.md`, `docs/research/grafana-log-dashboard-research.md` | `docs/research/grafana-log-dashboard-research.md` |
| `docs/devlog/grafana-styling-research.md`, `docs/research/grafana-styling-research.md` | `docs/research/grafana-styling-research.md` |
| `docs/architecture/compliance-remediation-plan.md`, `docs/compliance/compliance-remediation-plan.md` | `docs/compliance/compliance-remediation-plan.md` |
| `docs/devlog/parthenon-acropolis-integration-prompt.md`, `docs/handoffs/parthenon-acropolis-integration-prompt.md` | `docs/handoffs/parthenon-acropolis-integration-prompt.md` |

## Structural problems

### 1. ADRs are split and inconsistently numbered

There were ADRs in both `docs/adr/` and `docs/architecture/`. The `docs/adr`
series starts at `0001`, while `docs/architecture` has both `adr-001-*` and
`adr-0009-*` through `adr-0019-*`. These should become one sequence:

```text
docs/lineage/decisions/adr/
  0001-node-sdk-design.md
  0002-orchestration-backend.md
  ...
```

Every ADR should use one frontmatter contract:

```yaml
---
doc_type: adr
status: accepted
date: 2026-05-02
module: ingestion-templates
supersedes: []
superseded_by: null
related_code:
  - templates/runtime/nodes/base.py
---
```

### 2. Active and legacy plans are mixed

`docs/superpowers/plans` contains current execution plans and already completed
subplans. `docs/devlog/plans` contains older implementation plans, many of
which are superseded by module devlogs, blog posts, shipped code, or newer
superpowers specs.

Keep current plans in:

```text
docs/lineage/plans/open/
docs/lineage/plans/review/
```

Move completed or superseded plans to:

```text
docs/lineage/archive/plans/2026-q1/
docs/lineage/archive/plans/2026-q2/
```

Each archived plan should name the closeout devlog, PR, commit, or replacement
spec that superseded it.

### 3. Loose devlogs should be classified

`docs/devlog/*.md` mixes root session notes, phase notes, prompts, operator
runbooks, and closeouts. These are useful, but only if their role is explicit.

Suggested movement:

| Current pattern | Target |
|---|---|
| `docs/devlog/2026-*-*-*-closeout.md` | `docs/lineage/timeline/YYYY/MM/` |
| `docs/devlog/2026-*-authentik-sso-*.md` | `docs/lineage/modules/auth/` |
| `docs/devlog/2026-*-finngen-*.md` | `docs/lineage/modules/finngen/` |
| `docs/devlog/ARES-HOWTO.md` | `docs/lineage/modules/data-explorer/ares-runbook.md` or `docs/ops/` |
| `docs/devlog/*-prompt.md` | `docs/lineage/archive/prompts/` unless still active |
| `docs/devlog/releases/*` | `docs/lineage/releases/` |

### 4. Public docs contain stale active references

Several active public docs still referenced `github.com/sudoshi/Parthenon` or
Apache 2.0-era instructions. This is acceptable inside historical lineage only
when annotated as historical, but not in active install docs.

Status on 2026-05-10: active install docs, public install landing pages, and
public blog-facing repo/license references were reconciled to the source-only
Community installer path and the `Acumenus-Data-Sciences/Parthenon` repo. The
remaining `sudoshi/Parthenon` hits in public blog content are in v1.0.7 release
notes that explicitly document the historical org transfer.

High-priority active source examples remediated in this pass:

- `docs/site/docs/part1-getting-started/00b-installation.mdx`
- `docs/site/docs/install/community-installer-walkthrough.mdx`
- `docs/site/docs/install/no-telemetry.mdx`
- `docs/site/docs/install/verifying-signatures.mdx`
- `docs/blog/community-post.md`

The cleanup should distinguish:

- Historical blog/devlog posts: preserve old names with a `historical_note`.
- Active install/user docs: update canonical org/release URLs and current
  installer strategy.

### 5. `docs/abby-seed` is a duplicate/reference corpus

`docs/abby-seed` duplicates blog and Commons material and also contains external
reference notes (`clinvar`, `cohortmethod`, `hgvs`, OMOP CDM). It should not
remain as a peer of source docs.

Recommended target:

```text
docs/reference/abby-seed/
  README.md
  reference/
```

Remove duplicated blog/Commons copies after replacing them with links in the
seed README.

### 6. Generated docs are properly ignored but visually pollute local inventory

`docs/site/.gitignore` ignores `docs/api/**` but allows `docs/api/index.mdx`.
That is the right source-control model. For audits, commands must ignore:

- `docs/site/build/`
- `docs/site/.docusaurus/`
- `docs/site/node_modules/`
- `docs/site/docs/api/*.api.mdx`
- `docs/site/docs/api/*.json`

Add this to the future docs README so the next audit does not treat generated
OpenAPI pages as authored lineage.

## Proposed target tree

```text
docs/
  README.md
  site/                         # Docusaurus source, i18n, generated API entry
  blog/                         # public curated narrative and release posts
  lineage/
    README.md
    catalog.md                  # generated/maintained index of lineage docs
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
  ops/
  compliance/
  research/
  reference/
  demo/
```

This separates public docs from developer lineage while keeping both under
`docs/`.

## Required frontmatter contract

Every tracked Markdown/MDX file outside generated Docusaurus API output should
eventually carry enough metadata to answer why it exists.

Minimum contract:

```yaml
---
doc_type: lineage | plan | spec | adr | runbook | handoff | public-doc | blog | compliance | research | reference | demo
status: open | active | accepted | shipped | superseded | historical | archived
date: 2026-05-10
owner: acumenus
module: ingestion | studies | auth | docs | platform | null
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
```

Rules:

- `status: open` means the doc can drive future implementation.
- `status: shipped` means the doc is historical evidence of what landed.
- `status: superseded` must name `superseded_by`.
- `doc_type: public-doc` stays in `docs/site`.
- Generated OpenAPI pages do not get this contract; the generator owns them.

## Consolidation plan

### Pass 1: safe indexing, no moves

1. Add `docs/README.md` explaining the docs corpora.
2. Add `docs/lineage/README.md` with the target taxonomy.
3. Add `docs/lineage/catalog.md` with the tracked corpus grouped by current
   category and intended target.
4. Add a validation script that fails on new Markdown files without
   frontmatter outside `docs/site/docs/api`.

This pass should be low-risk and does not break links.

### Pass 2: exact duplicate removal

1. Remove duplicated `docs/abby-seed/blog` copies in favor of `docs/blog`.
2. Remove duplicated `docs/commons` copies in favor of one Commons source.
3. Move duplicated Grafana research docs to `docs/research` only.
4. Move duplicated compliance remediation to `docs/compliance` only.
5. Replace old duplicate paths with short pointer files only where existing
   links need a transition period.

### Pass 3: ADR normalization

1. Move all ADRs to `docs/lineage/decisions/adr`. Completed in this cleanup pass.
2. Renumber only if necessary; otherwise preserve old numbers and add aliases
   in `docs/lineage/decisions/adr/README.md`.
3. Normalize `Status`, `Date`, `Context`, `Decision`, `Consequences`, and
   `Supersession` sections.

### Pass 4: plan/spec lifecycle cleanup

1. Mark each `docs/superpowers/plans` file as `open`, `shipped`, or
   `superseded`.
2. Mark each `docs/devlog/plans` and `docs/devlog/specs` file as historical
   unless it has no replacement.
3. Move shipped/superseded docs into `docs/lineage/archive`.
4. For every open plan, add `related_code`, `related_tests`, and `exit_state`.

### Pass 5: public docs stale-reference fix

Status: completed 2026-05-10 for active install docs, public install pages, and
current public blog-facing references.

1. Update active Docusaurus install docs from `sudoshi/Parthenon` to
   `Acumenus-Data-Sciences/Parthenon`.
2. Update current license language where public docs still claim Apache 2.0.
3. Preserve old URLs inside historical blog/devlog posts only with a short
   historical note when needed.
4. Rebuild/deploy docs via the repo docs deploy path when shipping public docs.

### Pass 6: CI guard

Status: completed 2026-05-11. The public-docs current-state guard now runs in
the Docusaurus build path and in `.github/workflows/license-guard.yml`. It
blocks stale `sudoshi/Parthenon` references in active public docs and installer
surfaces, stale public Apache 2.0 claims, and regressions that make the active
installer docs read like native binary/package release instructions.

`python3 scripts/docs/catalog_lineage_docs.py --check-frontmatter` now runs in
CI as the `docs-lineage-contract` job and blocks:

- New Markdown/MDX files outside approved roots unless intentionally archived.
- New Markdown/MDX files that lack frontmatter classification.
- Missing required contract keys on lineage/governance docs outside the
  grandfathered baseline.
- `superseded` docs without a `superseded_by` successor.
- `doc_type: public-doc` outside `docs/site`.
- Active non-public developer docs that still reference
  `github.com/sudoshi/Parthenon` or `ghcr.io/sudoshi/parthenon`.

## Suggested file-level decisions

## Migration checkpoints

### 2026-05-10: ADR and duplicate baseline

- Consolidated ADRs under `docs/lineage/decisions/adr/`.
- Added `docs/README.md`, `docs/lineage/README.md`,
  `docs/lineage/catalog.md`, and `docs/lineage/frontmatter-baseline.txt`.
- Collapsed exact duplicate Markdown files into canonical docs plus archived
  pointer stubs where retaining the old path was useful.

### 2026-05-11: Lineage corpus rehome

- Moved module histories to `docs/lineage/modules/`.
- Moved phase, release, and dated session records to `docs/lineage/timeline/`.
- Moved current/recent plans to `docs/lineage/plans/open/`.
- Moved current/recent specs and strategy docs to `docs/lineage/design/`.
- Moved legacy plans/specs and prompt notes to `docs/lineage/archive/`.
- Moved process/runbook notes to `docs/lineage/operations/`.
- Moved handoffs to `docs/lineage/handoffs/`.
- Left transition READMEs in `docs/devlog/`, `docs/superpowers/`, and
  `docs/handoffs/` so old top-level directory names remain explainable.

### 2026-05-11: Baseline reduction

- Classified canonical `docs/ops/`, `docs/compliance/`, `docs/demo/`, and
  `docs/research/` files with lineage frontmatter.
- Classified the remaining small non-lineage-root baseline set in
  `docs/architecture/`, `docs/abby-seed/`, `docs/commons/`, `docs/blog/`,
  `docs/data-dictionary/`, `docs/irsf-nhs/`, and `docs/poseidon/`.
- Marked files that still live in legacy roots as `historical` or `archived`
  until they are either rehomed to canonical lineage/reference paths or left as
  explicit legacy context.
- Classified ADRs under `docs/lineage/decisions/adr/` as accepted decision
  records and linked each to the most relevant code or runtime surface.
- Classified handoffs under `docs/lineage/handoffs/` and linked each transfer
  note to the implementation surfaces it handed off.
- Classified timeline records under `docs/lineage/timeline/`; phase and
  release records are marked `shipped`, while dated session notes are retained
  as historical lineage.
- Classified the first 50 remaining design records under `docs/lineage/design/`
  as historical design lineage, plans, or handoffs based on their filenames.
- Classified the first 50 remaining archived plan records under
  `docs/lineage/archive/plans/` as archived plans, specs, or compliance notes
  based on their filenames.

Immediate keep:

These lists preserve the original audit recommendations. The migration
checkpoints above record the actual canonical paths after rehoming.

- `docs/site/docs/**` authored user manual pages
- `docs/site/i18n/**`
- `docs/site/docs/api/index.mdx`
- `docs/devlog/phases/**`
- `docs/adr/**`
- current `docs/architecture/adr-*`
- current `docs/superpowers/specs/2026-05-*`
- current `docs/superpowers/plans/2026-05-*`
- `docs/ops/**`
- `docs/compliance/**`
- `docs/demo/**`
- `docs/data-dictionary/app-schema.md`

Immediate consolidate:

- exact duplicates listed above
- `docs/devlog/grafana-*.md` into `docs/research`
- `docs/architecture/compliance-remediation-plan.md` into `docs/compliance`
- `docs/devlog/parthenon-acropolis-integration-prompt.md` into
  `docs/handoffs`
- `docs/commons/ABBY_COMPONENTS_README.md` and
  `docs/commons/abby-components/README.md`

Immediate archive:

- superseded installer package plans that assume binary assets no longer used
- old `sudoshi/Parthenon` release instructions unless explicitly historical
- `docs/devlog/plans/**` items that have shipped module closeouts
- `docs/devlog/specs/**` items replaced by ADRs or `docs/superpowers/specs`

Do not track as lineage:

- generated OpenAPI MDX/JSON
- Docusaurus build output
- `.docusaurus`
- `node_modules`

## Verification checklist for the actual move

Before moving files:

```bash
git status --short docs
git ls-files 'docs/**/*.md' 'docs/**/*.mdx' | wc -l
git ls-files -o -i --exclude-standard 'docs/**/*.md' 'docs/**/*.mdx' | wc -l
sh docs/site/scripts/check-content-tree.sh
```

After moving files:

```bash
rg -n 'sudoshi/Parthenon|Apache 2\.0|Apache-2\.0' docs/site/docs docs/blog
git ls-files -c -i --exclude-standard 'docs/**/*.md' 'docs/**/*.mdx'
sh docs/site/scripts/check-content-tree.sh
```

If public Docusaurus docs are changed and shipped, use the repo docs deploy
path. If frontend public install assets are changed, use `./deploy.sh --frontend`
per repository instructions.
