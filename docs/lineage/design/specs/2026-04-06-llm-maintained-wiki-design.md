# LLM-Maintained Wiki Engine — Design Spec

**Date:** 2026-04-06
**Status:** Draft
**Module:** Commons Wiki / AI Service

---

## 1. Overview

An LLM-maintained persistent wiki engine integrated into Parthenon. Instead of traditional RAG (re-derive knowledge on every query), the LLM incrementally builds and maintains a structured, interlinked collection of markdown files — a compounding knowledge artifact that gets richer with every source ingested and every question asked.

The wiki sits between raw sources (immutable inputs) and the user (who reads, queries, and directs). The LLM owns all writing: summarizing, cross-referencing, filing, flagging contradictions, and maintaining consistency. Users curate sources, ask questions, and direct analysis. The LLM does the bookkeeping.

### Key Differences from Existing Infrastructure

- **Parthenon Brain (ChromaDB):** Embedding-based retrieval over raw chunks. Good for semantic search, opaque to browse. No cross-references, no synthesis, no accumulated structure.
- **Commons Wiki (current):** Human-authored CRUD articles. No LLM maintenance, no auto-ingestion, no cross-referencing engine.
- **This system:** LLM-generated interlinked markdown pages with persistent index, chronological log, domain-specific schema, and automated maintenance. Complements both — does not replace them.

## 2. Architecture — Three Layers

### 2.1 Raw Sources (Immutable)

User-curated collection of input documents. The LLM reads from these but never modifies them. Sources include:

- **Internal Parthenon artifacts:** DQD reports, Achilles characterizations, cohort definitions, analysis results, Commons conversation threads
- **External documents:** research papers (PubMed), clinical guidelines, uploaded PDFs/markdown/plain text
- **Conversation extracts:** synthesized decisions and insights from Commons channel threads

Each source is serialized to a markdown file with YAML frontmatter and stored in `{workspace}/sources/`.

### 2.2 Wiki Pages (LLM-Generated)

A directory of interlinked markdown files maintained entirely by the LLM. Page types:

| Page Type | Purpose | Created When |
|---|---|---|
| **Source summary** | One per ingested source. Key takeaways, tags, metadata. Immutable after creation. | Ingest |
| **Entity page** | One per distinct entity (CDM source, drug class, condition group, cohort, study). Accumulates facts across sources. | Ingest (first mention) |
| **Concept page** | Abstract themes spanning entities (e.g., "data quality patterns", "cardiovascular risk modeling"). Synthesized from multiple sources. | Ingest (when pattern emerges) |
| **Comparison** | Side-by-side analysis of two or more entities/concepts. | Ingest (overlap detected) or Query |
| **Overview** | Single page synthesizing the entire wiki's scope. | Ingest (updated every time) |
| **Analysis** | Filed query results, investigations, findings worth preserving. | Query ("file this") |

All pages use:
- `[[wikilinks]]` for cross-references (Obsidian-native)
- YAML frontmatter: `type`, `tags`, `sources` (list of source slugs), `created`, `updated`, `source_count`
- `> [!contradiction]` callouts for flagged conflicts
- `> [!stale]` callouts for superseded claims

### 2.3 Schema (Configuration)

A `SCHEMA.md` file per workspace that tells the LLM how the wiki is structured, what conventions to follow, and what workflows to execute for each operation. This is the key configuration file — it makes the LLM a disciplined wiki maintainer rather than a generic chatbot.

**Global `SCHEMA.md`** at repo root defines:
1. Page type definitions with markdown templates
2. Frontmatter conventions
3. Cross-referencing rules
4. Workflows for each operation (ingest, query, lint, maintain)
5. Domain vocabulary (OMOP-specific terminology conventions)

**Per-workspace overrides:** Study wikis can add page types (e.g., "protocol summary"). Personal wikis can strip down to fewer page types. Workspace `SCHEMA.md` extends or narrows the global one.

## 3. Filesystem Layout

```
/data/wiki/                          <-- git repo root, Docker volume
|-- SCHEMA.md                        <-- global schema
|-- platform/                        <-- platform-wide wiki (main branch)
|   |-- index.md                     <-- content catalog with links + summaries
|   |-- log.md                       <-- chronological append-only activity log
|   |-- sources/                     <-- immutable raw inputs
|   |   |-- dqd_synpuf_2026-04-05.md
|   |   |-- achilles_acumenus_2026-04-01.md
|   |   +-- paper_pmid_12345678.md
|   +-- wiki/                        <-- LLM-generated interlinked pages
|       |-- overview.md
|       |-- entities/
|       |-- concepts/
|       |-- comparisons/
|       +-- analyses/
|-- studies/                         <-- per-study wikis (branches: study/{study-id})
|   +-- {study-id}/
|       |-- index.md
|       |-- log.md
|       |-- sources/
|       +-- wiki/
+-- personal/                        <-- per-user wikis (branches: personal/{user-id})
    +-- {user-id}/
        |-- index.md
        |-- log.md
        |-- sources/
        +-- wiki/
```

### Git Branching Strategy

- `main` — platform wiki
- `study/{study-id}` — study-scoped wikis
- `personal/{user-id}` — personal research wikis

`SCHEMA.md` at repo root is shared across all branches (kept in sync via merge from main).

**Workspace lifecycle:** Creating a new study or personal workspace (via `POST /wiki/workspaces` with `wiki.manage` permission) causes the AI service to create the git branch, initialize `index.md`, `log.md`, and the directory structure. Deleting a workspace deletes the branch.

### Docker Volume Mapping

```yaml
python-ai:
  volumes:
    - wiki-data:/data/wiki
```

Host bind mount (or symlink) for developer access via Obsidian.

## 4. Operations

### 4.1 Ingest

Triggered by: Abby command, CLI, auto-ingest event from Laravel.

**Flow:**
1. Source file lands in `{workspace}/sources/` (caller writes it — CLI copies a file, Laravel serializes an artifact to markdown)
2. AI service reads the source + workspace `SCHEMA.md` + `index.md`
3. Ollama extracts: entities mentioned, concepts identified, key facts (structured list output)
4. For each entity/concept: checks if a wiki page exists. If yes, reads existing page + new facts, produces updated version. If no, creates new page.
5. Updates `overview.md` with revised synthesis
6. Updates `index.md` — adds source summary entry, updates entries for all touched pages
7. Appends to `log.md`: `## [2026-04-05T14:30:00Z] ingest | {source_title}` with pages touched
8. Git commits atomically: `wiki: ingest {source_title}`

**Decomposition for 8B model** (5-8 LLM calls per ingest):
1. Source -> extract entities, concepts, facts (structured list)
2. Per entity: existing page + new facts -> updated page
3. Per concept: same pattern
4. Current overview + change summary -> updated overview
5. Index + new/changed page list -> updated index entries

### 4.2 Query

Triggered by: Abby chat, Commons wiki UI search, CLI.

**Flow:**
1. User asks a question
2. AI service reads `index.md`, identifies relevant pages (keyword match + Ollama relevance scoring)
3. Reads top-N relevant pages (configurable, default 5)
4. Ollama generates answer with `[[wikilinks]]` citations
5. Optional: user says "file this" and the answer becomes an Analysis page (mini-ingest: update index, overview, commit)

**Decomposition** (2-3 LLM calls):
1. Index + question -> relevant page slugs (structured list)
2. Relevant pages + question -> answer with citations
3. (Optional) Schema + answer -> formatted Analysis page

### 4.3 Lint

Triggered by: user command, scheduled job, or after N ingests.

**Flow:**
1. AI service reads `index.md` and iterates wiki pages in batches (~10 pages per batch)
2. Per batch, Ollama checks for:
   - **Contradictions** — conflicting claims across pages
   - **Stale content** — pages not updated by recent sources that should have been
   - **Orphans** — pages with zero inbound `[[wikilinks]]`
   - **Missing pages** — `[[wikilinks]]` pointing to non-existent pages
   - **Gaps** — concepts referenced but lacking their own page
3. Produces lint report (markdown) and optionally auto-fixes
4. Commits fixes: `wiki: lint {workspace} - N issues fixed`

**Decomposition** (2 LLM calls per batch of ~10 pages):
1. Batch of pages -> issue list
2. Per fixable issue: affected page -> corrected version

### 4.4 Maintain

Background housekeeping, triggered periodically or on-demand:

- **Reindex** — rebuild `index.md` from filesystem scan (recovery if index drifts)
- **Compact** — merge thin entity pages that should be consolidated
- **Prune** — archive pages not referenced or updated in N days (move to `wiki/_archive/`)

## 5. Indexing and Logging

### index.md

Content-oriented catalog. Every page listed with: link, one-line summary, page type, source count, last updated date. Organized by category (entities, concepts, sources, comparisons, analyses).

The LLM reads `index.md` first when handling any operation to find relevant pages, then drills into them. This avoids embedding-based search at moderate scale (~100 sources, ~hundreds of pages).

For large wikis where the full index exceeds the model's effective context, the engine greps the index by keyword to extract a filtered section rather than reading the whole file.

### log.md

Chronological append-only record. Each entry:
```markdown
## [2026-04-05T14:30:00Z] ingest | DQD Report - SynPUF
- Source: sources/dqd_synpuf_2026-04-05.md
- Pages created: entities/synpuf-source.md, concepts/data-quality-patterns.md
- Pages updated: overview.md, entities/synpuf-source.md
- Summary: SynPUF DQD run shows 12 new plausibility failures in drug_exposure dates.
```

Parseable with: `grep "^## \[" log.md | tail -5` for the last 5 entries.

## 6. Source Serialization Adapters

When Parthenon internal artifacts are ingested, they are serialized to markdown by adapters. Two parallel implementations: PHP serializers in Laravel (for event-driven auto-ingest) and Python adapters in the AI service (for CLI/manual ingest).

### Adapter Types

| Adapter | Source | Output |
|---|---|---|
| **DQD Report** | DQD run results | Check results by category, failure counts, top issues, comparison to previous run |
| **Achilles Characterization** | Achilles results | Domain summaries, top concepts by frequency, temporal trends, data density |
| **Cohort Definition** | Cohort expression JSON | Human-readable criteria, concept sets, record counts, linked studies |
| **Analysis Result** | Completed analysis | Parameters, key results (effect estimates, CIs, diagnostics), data sources |
| **Conversation** | Commons channel thread | Key decisions, action items, insights extracted by Ollama (synthesis, not transcript) |
| **External Document** | Uploaded file | Markdown pass-through, PDF text extraction via pdfplumber, plain text wrapping |

### Frontmatter Format

```yaml
---
source_type: dqd_report | achilles | cohort | analysis | conversation | external
source_id: "{parthenon_entity_id}"
title: "DQD Report - SynPUF 2026-04-05"
ingested: "2026-04-05T14:30:00Z"
tags: [data-quality, synpuf]
---
```

### Auto-Ingest Pipeline

For workspaces with auto-ingest enabled:
1. Laravel event fires (e.g., `DqdReportCompleted`)
2. Queue job serializes artifact to markdown via PHP serializer
3. Writes file to `{workspace}/sources/{slug}.md` on the wiki volume
4. Calls `POST /wiki/ingest` on the AI service with workspace path and source filename

## 7. Ollama Prompt Engineering for 8B Models

### Design Principles

1. **Single-task prompts only.** Never "read this source and update the wiki." Instead: decomposed steps where each LLM call has one clear input and one clear output.

2. **Schema in every prompt.** Every prompt includes the relevant `SCHEMA.md` excerpt — page type definition, frontmatter format, conventions. The model follows instructions in context, not memorized conventions.

3. **Structured output via templates.** Prompts include a markdown template the model fills in:
   ```
   Produce an updated entity page in this exact format:
   ---
   type: entity
   tags: [...]
   sources: [...]
   ...
   ---
   # {Entity Name}
   ## Summary
   {2-3 sentence overview}
   ## Key Facts
   {bulleted facts with [[source_slug]] citations}
   ## Cross-References
   {[[wikilinks]] to related pages}
   ```

4. **Small context windows.** Each prompt: schema excerpt (~500 tokens) + source/page being processed (~1000-2000 tokens) + instruction (~200 tokens). Well within 8B context limits.

### Model Selection

- Default: `ii-medical:8b-q8` (clinical/biomedical wikis)
- Fallback: `llama3.1:8b` (general-purpose, non-medical topics)
- Configurable per workspace in `SCHEMA.md` metadata

### Error Handling

- Malformed output: retry once with stricter prompt including example output
- Retry failure: source marked "pending review" in log, user notified, no partial wiki updates
- Rate limiting: ingest operations queued one-at-a-time per workspace; queries can run concurrently (read-only)

## 8. AI Service Integration

New routers added to the existing FastAPI service at `ai/app/routers/wiki.py`.

### Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/wiki/ingest` | `wiki.ingest` | Ingest a source into a workspace |
| `POST` | `/wiki/query` | `wiki.view` | Query a workspace |
| `POST` | `/wiki/lint` | `wiki.lint` | Lint a workspace |
| `POST` | `/wiki/maintain` | `wiki.manage` | Run maintenance operations |
| `GET` | `/wiki/workspaces` | `wiki.view` | List all workspaces |
| `GET` | `/wiki/pages` | `wiki.view` | List pages in a workspace (from index.md) |
| `GET` | `/wiki/pages/{slug}` | `wiki.view` | Read a specific page |
| `GET` | `/wiki/log` | `wiki.view` | Read workspace log |
| `GET` | `/wiki/sources` | `wiki.view` | List sources in a workspace |
| `POST` | `/wiki/file-answer` | `wiki.ingest` | File a query answer as a wiki page |

### Core Engine Module

`ai/app/wiki/engine.py` — the wiki engine core:
- Reads `SCHEMA.md` for conventions and workflows
- Reads/writes markdown files on the wiki volume
- Decomposes operations into single-task Ollama prompts
- Manages git commits (atomic, per-operation)
- Maintains `index.md` and `log.md`

Supporting modules:
- `ai/app/wiki/adapters/` — source serialization adapters (DQD, Achilles, cohort, analysis, conversation, external)
- `ai/app/wiki/prompts.py` — prompt templates for each operation step
- `ai/app/wiki/git_ops.py` — git operations (commit, branch management)
- `ai/app/wiki/index.py` — index.md parsing, updating, and keyword search

## 9. Laravel Backend Integration

### WikiController

New controller at `backend/app/Http/Controllers/Api/V1/WikiController.php`. Proxy to AI service with auth + RBAC.

### Routes

```php
Route::prefix('wiki')->middleware(['auth:sanctum'])->group(function () {
    Route::get('workspaces', [WikiController::class, 'workspaces'])->middleware('permission:wiki.view');
    Route::get('pages', [WikiController::class, 'pages'])->middleware('permission:wiki.view');
    Route::get('pages/{slug}', [WikiController::class, 'page'])->middleware('permission:wiki.view');
    Route::get('log', [WikiController::class, 'log'])->middleware('permission:wiki.view');
    Route::get('sources', [WikiController::class, 'sources'])->middleware('permission:wiki.view');
    Route::post('ingest', [WikiController::class, 'ingest'])->middleware('permission:wiki.ingest');
    Route::post('query', [WikiController::class, 'query'])->middleware('permission:wiki.view');
    Route::post('lint', [WikiController::class, 'lint'])->middleware('permission:wiki.lint');
    Route::post('maintain', [WikiController::class, 'maintain'])->middleware('permission:wiki.manage');
    Route::post('file-answer', [WikiController::class, 'fileAnswer'])->middleware('permission:wiki.ingest');
});
```

### Event Listeners for Auto-Ingest

| Event | Adapter | Target |
|---|---|---|
| `DqdReportCompleted` | DQD Report serializer | Platform wiki (or study wiki if study-linked) |
| `AchillesRunCompleted` | Achilles serializer | Platform wiki |
| `CohortCreated` | Cohort serializer | Study wiki (if study-linked) or platform |
| `AnalysisExecuted` | Analysis serializer | Study wiki |

Each listener: serialize to markdown -> write to `sources/` -> call `POST /wiki/ingest`. Dispatched as queue jobs via Horizon.

### Abby Integration

New intent handlers in Abby's router:
- `wiki:ingest` — "ingest this paper into my CKD wiki"
- `wiki:query` — "what do we know about drug exposure gaps?"
- `wiki:lint` — "lint the cardiovascular wiki"

Abby detects wiki intents and delegates to wiki engine endpoints. Responses rendered as formatted markdown in the chat.

## 10. Frontend — Commons Wiki Subpage

The LLM-maintained wiki replaces the existing Commons wiki subpage. Same URL structure within Commons, enhanced functionality.

### Routes

```
/commons/wiki                              -> Wiki browser (platform workspace default)
/commons/wiki?workspace=study:{id}         -> Study-scoped workspace
/commons/wiki?workspace=personal:{id}      -> Personal workspace
/commons/wiki/{slug}                       -> Page view within active workspace
```

### Components (in `frontend/src/features/commons/`)

| Component | Purpose |
|---|---|
| **WikiWorkspaceSelector** | Dropdown: Platform / Study (lists user's studies) / Personal |
| **WikiPageTree** | Grouped by page type from index.md. Collapsible sections, badge counts, search filter. Replaces flat article list. |
| **WikiPageView** | Markdown renderer with wikilink resolution, callout styling (contradiction=crimson, stale=gold), frontmatter metadata chips. |
| **WikiIngestPanel** | Slide-out for manual ingestion. File upload or select from recent Parthenon artifacts. Progress indicator during LLM processing. |
| **WikiQueryPanel** | Conversational query scoped to active workspace. "File this" button to persist answers as wiki pages. |
| **WikiLintReport** | Lint results grouped by issue type. Per-issue fix buttons. |
| **WikiGraph** | Force-directed graph of page interconnections via `react-force-graph-2d`. Pages as nodes, wikilinks as edges. Click to navigate. |
| **WikiActivityFeed** | Rendered log.md as a timeline. Filterable by operation type. |

### State & Hooks

- **useWikiStore** (Zustand) — active workspace, active page slug, page tree cache, search term
- **useWikiPages** (TanStack Query) — fetches page list from index
- **useWikiPage** (TanStack Query) — fetches single page content
- **useWikiIngest** (TanStack Query mutation) — triggers ingestion
- **useWikiQuery** (TanStack Query mutation) — runs a wiki query
- **useWikiLint** (TanStack Query mutation) — triggers lint

### Design

Dark clinical theme consistent with rest of Commons:
- Content area: #151519 background for markdown readability
- Wikilinks: teal (#2DD4BF) inline links
- Contradiction callouts: crimson (#9B1B30) left border + subtle background
- Stale callouts: gold (#C9A227) left border
- Source count badges: muted gray chips
- Graph view: teal nodes, gray edges, crimson orphan nodes

## 11. RBAC Permissions

New permission domain: `wiki`.

| Permission | Roles | Controls |
|---|---|---|
| `wiki.view` | viewer, researcher, data-steward, admin, super-admin | Browse pages, read index/log, run queries |
| `wiki.ingest` | researcher, data-steward, admin, super-admin | Add sources and trigger ingestion |
| `wiki.lint` | researcher, admin, super-admin | Run lint and apply fixes |
| `wiki.manage` | admin, super-admin | Create/delete workspaces, configure auto-ingest, manage schemas |

### Workspace Access Rules

- **Platform wiki:** Readable by anyone with `wiki.view`. Ingestible by anyone with `wiki.ingest`.
- **Study wikis:** Scoped to study team membership (via `study_members`). Members get `wiki.view` + `wiki.ingest`. Study PI gets `wiki.manage`.
- **Personal wikis:** Only the owning user. All operations permitted. No sharing.

### Route Middleware

All Laravel wiki routes: `auth:sanctum` + appropriate `permission:wiki.*` middleware. Controller-level ownership checks for study/personal workspace access.

## 12. Data Flow Diagram

```
SOURCE INPUTS
  DQD | Achilles | Cohorts | External PDFs | Commons Conversations
                              |
                              v
                    LARAVEL BACKEND
                    - Event listeners (auto-ingest)
                    - PHP serializers -> markdown files -> sources/ dir
                    - WikiController (proxy + RBAC)
                              |
                              v
                    AI SERVICE (FastAPI)
                    - /wiki/* routers
                    - Wiki Engine Core:
                      1. Read SCHEMA.md
                      2. Read index.md (find relevant pages)
                      3. Decomposed Ollama calls (single-task prompts)
                      4. Read/write wiki pages
                      5. Git commit atomically
                      6. Append to log.md
                              |
                    +---------+---------+
                    |                   |
                    v                   v
              Ollama (local)     Filesystem /data/wiki/
              ii-medical:8b      (git repo)
                              |
                              v
                    USER INTERFACES
                    - Commons Wiki UI (end users)
                    - Abby Chat (power users)
                    - CLI + Obsidian (developers)
```

## 13. Relationship to Existing Systems

| System | Relationship | Status |
|---|---|---|
| **ChromaDB Brain** | Complementary. Brain handles embedding-based RAG for Abby. Wiki handles structured, interlinked knowledge. No overlap. | Unchanged |
| **Commons Wiki (current)** | Replaced. Current CRUD wiki becomes the LLM-maintained wiki. Existing wiki tables (`commons_wiki_articles`, `commons_wiki_revisions`) are deprecated — data lives in filesystem markdown. | Deprecated |
| **Institutional Knowledge** | Complementary. Institutional knowledge capture (cohort patterns, corrections) feeds into the wiki as a source type. The wiki provides richer synthesis. | Enhanced |
| **Solr** | Not used by wiki engine. Wiki uses index.md for page discovery. Solr continues for vocabulary/cohort/analysis search. | Unchanged |

## 14. Future Enhancements (Out of Scope)

- **ChromaDB per-workspace collection**: If index-based retrieval becomes insufficient at scale, add embedding search as an enhancement layer.
- **Multi-model routing**: Route complex operations to larger models (Claude API) while keeping simple operations on local 8B. Deferred per user preference for local-only.
- **Collaborative editing**: Multiple users editing the same wiki page simultaneously. Deferred — the LLM is the sole writer, users direct it.
- **Cross-workspace synthesis**: Query across platform + study + personal wikis in a single operation. Requires branch-aware search.
- **Export**: Generate slide decks (Marp), reports, or formatted documents from wiki content.

## 15. Open Questions

None — all questions resolved during design review.
