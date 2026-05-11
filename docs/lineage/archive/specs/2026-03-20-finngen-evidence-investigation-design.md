# FinnGen Evidence Investigation — Design Specification

## Overview

**Product:** Redesign of the Parthenon FinnGen Workbench from a sequential 4-tab form UI into an **Evidence Investigation** platform — a persistent, question-driven workspace that combines clinical phenotyping, observational analytics, and genomic evidence into a unified **Evidence Dossier**.

**Problem:** The OHDSI ecosystem fragments the research workflow across 6+ tools (Atlas, ROMOP, HADES R packages, CO2 Shiny app, PheWeb, Open Targets). No single tool connects clinical phenotyping with genomic evidence. Researchers bounce between browser tabs, R consoles, and file exports. The current Parthenon FinnGen workbench inherits these problems: sequential tabs destroy state on switch, handoffs are fragile, results are buried in collapsed sections, and there is no persistent study-level context.

**Solution:** An **Evidence Investigation** — a named, persistent workspace where researchers work across four evidence domains (Phenotype, Clinical, Genomic, Synthesis) in a focus+context layout, accumulating findings into an exportable Evidence Dossier. This is the first platform in the OHDSI or genomics ecosystem to bridge clinical and genomic evidence in a single interface.

**Target persona:** Translational researchers (clinical researchers, epidemiologists, and biostatisticians) who work at the intersection of clinical observational data and population genomics. Both guided (AI-assisted) and expert (full parameter control) modes are supported.

---

## Architecture

### The Investigation Model

The unit of work is an **Investigation** — a first-class, persistent entity in the database.

**Properties:**
- `id`, `title`, `research_question` (free text)
- `owner_id` (user), `status` (draft | active | complete | archived)
- `phenotype_state`, `clinical_state`, `genomic_state`, `synthesis_state` (JSONB)
- `created_at`, `updated_at`, `completed_at`, `last_modified_by`

**Note:** Guided/expert mode is a **user preference** stored in `app.users.workbench_mode` (default: guided), not an investigation property. Any user viewing any investigation sees it through their own mode preference.

**Lifecycle:**
```
Draft → Active → Complete → Archived
```
- **Draft:** Research question framing, cohort building. No analyses run yet.
- **Active:** At least one analysis executed. Primary working state.
- **Complete:** Researcher marks dossier as final. Snapshot taken (parameters, results, pins frozen). Further edits create a new version.
- **Archived:** Cold storage. Searchable, not editable. Can be forked into a new Draft.

**Relationships:**
- Has many `evidence_pins` (findings pinned to the dossier)
- Has many `analysis_runs` (extends existing `finngen_runs` with `investigation_id` FK)
- Has many `investigation_versions` (snapshots on completion)
- Belongs to a user; optionally shared with collaborators (read-only or read-write)

### Entry Points

Every investigation starts with a **research question**. Two paths:

**Guided entry (default):**
1. Researcher types a question: "Does SGLT2 inhibition reduce CKD progression in T2DM?"
2. StudyAgent decomposes it into structured components: target population, exposure, comparator, outcomes, genes of interest
3. System pre-configures the Phenotype domain (suggested concept sets, cohort structure) and queues relevant Open Targets/GWAS Catalog queries for the Genomic domain
4. Researcher reviews, adjusts, and begins working

**Blank canvas entry:**
1. Researcher creates an investigation with just a title
2. All four domains start empty
3. Power users who know exactly what they want skip AI framing

Either path lands on the Evidence Board.

---

## Evidence Board Layout

### Focus + Context Model

The board uses a **focus + context** interaction model. One evidence domain has **focus** (expanded, full working interface) while the others show **context** (compact summary cards with live key metrics).

**Left rail** — vertical navigation:
```
┌──────────────┐
│ ◉ Phenotype  │  Clinical cohort definition & validation
│ ○ Clinical   │  Observational analytics
│ ○ Genomic    │  GWAS, colocalization, Open Targets
│ ○ Synthesis  │  Evidence Dossier assembly
├──────────────┤
│ ▸ Pinned (N) │  Evidence pins accumulated so far
│ ▸ Runs (N)   │  Active/recent analysis runs with status
└──────────────┘
```

**Main area:**
```
┌─────────────────────────────────────────────────────────────┐
│  CONTEXT BAR (always visible, horizontal)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Phenotype │ │Clinical  │ │Genomic   │ │Synthesis │       │
│  │T2DM cohrt│ │3 analyses│ │12 loci   │ │4/8 pinned│       │
│  │n=59,226  │ │HR 0.72** │ │2 coloc.  │ │sections  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  FOCUS PANEL (expanded, scrollable)          │ EVIDENCE     │
│                                              │ SIDEBAR      │
│  [Full working interface for active domain]  │ (collapsible)│
│                                              │              │
│                                              │ Pinned finds │
│                                              │ Cross-links  │
│                                              │ Run status   │
└──────────────────────────────────────────────┴──────────────┘
```

**Key behaviors:**

1. **Context cards are clickable** — click to switch focus. Transition is instant; all domains maintain state in memory.
2. **Context cards are live** — they update as background analyses complete.
3. **Evidence Sidebar** (right edge, collapsible) shows pinned findings from all domains and cross-domain links.
4. **Split view** — any two domains can be viewed side by side for cross-referencing. Activated by dragging a context card into the focus area or keyboard shortcut. This enables the killer feature: clinical evidence next to genomic evidence for the same target.

### Progressive Disclosure

**Guided mode** (user preference, not investigation property):
- StudyAgent suggests next steps when entering each domain
- Configuration drawers show essential parameters; advanced collapsed
- Validation warnings use plain language
- Dossier sections have explanatory tooltips

**Expert mode:**
- All parameters exposed by default
- Raw SQL/JSON preview available for every analysis
- Full HADES parameter control
- Run comparison diffs show parameter-level deltas
- API response inspector for debugging

---

## Evidence Domain: Phenotype

Replaces current ROMOPAPI tab + Cohort Ops tab. Three sub-views within the domain:

### Concept Explorer

**Purpose:** Visual OMOP vocabulary exploration with live patient counts. Replaces ROMOPAPI's form-submit-results pattern.

**Interface:**
- Type-ahead search against OMOP vocabulary — type a term, see a filterable hierarchical concept tree with patient counts per concept
- Concept set builder: select concepts, include/exclude descendants, see real-time count updates
- Schema density heatmap: which OMOP domains have data for the selected population (condition, drug, measurement, procedure) with temporal coverage bars
- Domain filter and standard/non-standard concept toggle

### Cohort Builder

**Purpose:** Visual cohort assembly with immediate feedback. Replaces Cohort Ops' modal-based operation builder.

**Interface:**
- Inclusion/exclusion criteria as draggable cards
- Set operations rendered as Venn diagram — drag two cohorts together, pick union/intersect/subtract, see result count immediately
- Matching panel: configure propensity score matching with live covariate balance preview (love plot updates as caliper is adjusted)
- Attrition funnel renders live as criteria are added
- Import from: Parthenon cohort library, Atlas JSON, file upload, OHDSI Phenotype Library (1,100+ validated phenotypes)

### Phenotype Validation

**Purpose:** CodeWAS/TimeCodeWAS enrichment analysis for cohort QC and discovery. Replaces CO2's analysis module pattern.

**Interface:**
- CodeWAS: one-click enrichment between case/control cohorts. Interactive volcano plot (significance vs. effect size) — click any point for code detail, prevalence comparison, and "Pin to Dossier" action
- TimeCodeWAS: temporal heatmap of code enrichments across time windows relative to index date. Drag-select a window to see which codes peak there
- Cohort overlap matrix: visualize overlap between defined cohorts
- Automated validation checklist with QC flags (overlap warnings, bimodal distributions, unexpected code patterns)

### What changes from current implementation

| Current | New |
|---------|-----|
| ROMOPAPI form → submit → wait → read collapsed results | Concept Explorer with type-ahead search and live counts |
| Cohort Ops modal with 20+ params in a single pane | Visual Venn diagram builder with live attrition funnel |
| CodeWAS as a CO2 module dropdown option | Inline phenotype validation with interactive volcano/heatmap |
| State lost on tab switch | Persistent investigation state, server-saved |
| Handoff button appears only after successful preview | Cross-domain links automatic via concept resolution |

---

## Evidence Domain: Clinical

Replaces current HADES Extras tab + CO2 Analysis tab.

### Analysis Gallery

**Purpose:** Discoverable, card-based analysis launcher. Replaces CO2's module key dropdown.

**Layout:** Grid of analysis cards in three groups:

**Characterize:**
- Baseline demographics & comorbidity profiles
- Drug utilization patterns
- Temporal characterization (condition timeline)
- Care site variation

**Compare:**
- Comparative effectiveness (CohortMethod — PS matching, stratification, weighting)
- Self-controlled case series
- Incidence rate comparison
- Negative control calibration

**Predict:**
- Patient-level prediction (LASSO logistic, gradient boosting, deep learning)
- Risk stratification
- Model validation

Each card shows: analysis type icon, name, one-line description, estimated run time, prerequisites (e.g., "Requires target + comparator cohorts").

### Configuration Drawer

Clicking an analysis card opens a **drawer** (slides from right, gallery stays visible behind):
- Essential parameters visible; advanced parameters in collapsible section
- Pre-filled from investigation research question (guided mode) or blank (expert mode)
- Source selector (CDM data source)
- "Run" button starts a Horizon queue job

### Live Execution Status

```
Comparative Effectiveness — SGLT2i vs DPP4i → CKD Progression
Status: Running · Step 3/7 · Fitting propensity model
Elapsed: 2m 14s · Est. remaining: ~4m
[View logs] [Cancel]
```

Runs appear in the left rail Runs panel and the Clinical context card. Completion triggers a toast notification (not a modal).

### Results Display

Results render inline as pinnable cards:
- Hazard ratio with 95% CI and forest plot
- Kaplan-Meier curves (interactive — hover for time-point details)
- Propensity score distribution (mirrored histogram)
- Covariate balance love plot
- Negative control calibration plot
- Each result card has a "Pin to Dossier" action

### Run History

First-class panel (not a collapsed section):
- All analysis runs for this investigation with status, parameters, timestamps
- "Compare" action to diff two runs side by side (parameter deltas + result deltas)
- "Replay" action to re-execute with identical parameters
- "Fork" action to create a new run with modified parameters

### What changes from current implementation

| Current | New |
|---------|-----|
| HADES Extras tab (SQL rendering) + CO2 tab (module dropdown) | Unified analysis gallery with card-based discovery |
| Sequential: must go through ROMOPAPI → HADES → Cohort Ops → CO2 | Direct access — pick any analysis, cohort auto-linked from investigation |
| Results in collapsed sections below the form | Inline pinnable result cards |
| No progress indication beyond a spinner | Live step-by-step execution status |
| Run history buried at bottom of each tab | First-class Runs panel in left rail |
| Handoff context as untyped Record<string, unknown> | Typed investigation state with automatic cross-domain linking |

---

## Evidence Domain: Genomic

Entirely new — nothing in the current workbench provides this.

### Public API Integrations

**Open Targets** (GraphQL API):
- Query by gene symbol or disease name
- Display: associated studies with L2G scores, known drug targets, tractability assessment, safety signals
- Cross-link: for any gene, show "known drugs targeting this gene" alongside clinical evidence from Parthenon for those drugs' indications
- Data source: Open Targets Platform GraphQL (`api.platform.opentargets.org`)

**GWAS Catalog** (REST API):
- Search by trait or gene
- Display: associated loci, effect sizes, population frequencies, linked publications
- Data source: NHGRI-EBI GWAS Catalog REST API

**Risteys** (FinnGen public data):
- Query by FinnGen endpoint code
- Display: Finnish prevalence, age/sex distributions, pre-computed CodeWAS enrichments
- Provides population-level context regardless of the researcher's own data source
- Data source: Risteys API (`risteys.finngen.fi`)

### GWAS Summary Stats Import

- File upload: TSV/CSV with chr, pos, ref, alt, beta, se, p columns
- Auto-detect column mapping with preview and manual override
- Generates:
  - Interactive Manhattan plot (zoomable, click peaks for locus detail)
  - QQ plot with genomic inflation factor (lambda)
  - Top loci table sorted by significance
  - Locus zoom: click any significant locus → regional association plot with LD coloring, gene track overlay, recombination rate

### Colocalization & Fine-mapping Results Import

- Upload colocalization results (H4 posterior probabilities per gene/tissue pair)
- Upload fine-mapping credible sets (posterior inclusion probabilities per variant)
- Display:
  - Colocalization evidence matrix (genes × tissues, colored by H4.PP)
  - Credible set viewer with variant annotations (coding/regulatory, MAF, consequence)

### Cross-Domain Linking

When viewing a GWAS locus:
- System resolves the nearest gene → queries Phenotype domain for cohorts involving that gene's associated conditions
- Shows "Clinical evidence in your data" alongside the genetic signal
- "Build cohort for this gene's phenotype" action creates a new cohort in Phenotype pre-populated with relevant concept sets

From Clinical Evidence domain:
- Viewing a comparative effectiveness result for Drug X → "Genomic context" panel shows Drug X's target genes, their GWAS associations, and colocalization evidence linking targets to the studied outcome

---

## Evidence Domain: Synthesis (Evidence Dossier)

The concrete deliverable — the endpoint of every investigation.

### Structure

The dossier has predefined sections, each populated by pinned findings:

1. **Research Question** — auto-filled from investigation creation
2. **Phenotype Definition** — cohort criteria, concept sets, attrition funnel, CodeWAS validation highlights
3. **Population Characteristics** — baseline demographics, key comorbidities, temporal patterns
4. **Clinical Evidence** — comparative effectiveness estimates, incidence rates, prediction model performance
5. **Genomic Evidence** — GWAS signals, colocalization hits, drug target assessment, Open Targets context
6. **Evidence Synthesis** — triangulation assessment (researcher-authored, template pre-populated with cross-references between clinical and genomic findings)
7. **Limitations & Caveats** — auto-generated from QC flags (cohort overlap, calibration issues, genomic inflation)
8. **Methods** — auto-generated from analysis parameters, software versions, data source details, OMOP vocabulary version

### Interaction

Each section shows pinned findings as editable cards. The researcher can:
- Reorder pins within a section via drag-and-drop
- Add narrative text between pins (rich text editor)
- Flag a finding as "key" (appears in executive summary)
- Remove pins no longer relevant
- Add manual findings not captured by automated analysis

### Export Options

- **PDF** — formatted research report with figures, tables, and narrative
- **Structured JSON** — machine-readable evidence package for evidence registries or institutional review
- **Shareable link** — read-only view accessible to collaborators without Parthenon accounts
- **OHDSI Study Package** — Strategus-compatible JSON specification for multi-site replication

---

## Cross-Domain Linking Engine

A lightweight concept resolution layer that enables cross-referencing between domains without a knowledge graph.

**Mechanism:**
- Every entity (concept sets, cohort definitions, genes, drugs, outcomes) is tagged with OMOP concept IDs and/or gene symbols
- When Domain A produces a finding involving concept/gene X, the system checks whether other domains have entities involving X
- Cross-links appear as badges on findings: "🔗 2 genomic links" — click to expand related findings

**Resolution sources:**
- OMOP concept IDs (direct match between Phenotype/Clinical and vocabulary)
- Gene symbols (match between Genomic evidence and drug/condition concepts via Open Targets gene-disease associations)
- ATC drug codes → gene targets (via Open Targets drug-target mapping)

**Implementation:** Query-time resolution against the investigation's own entities. No pre-computed graph. Scales to thousands of entities per investigation without performance concern.

---

## State Management

### Server-Persisted Investigation State

**Departure from current architecture:** The current workbench stores all state in React component state, which is destroyed on tab switch. The new architecture persists investigation state server-side.

- Each domain's state saves automatically on meaningful actions (cohort defined, analysis started, finding pinned)
- Opening an investigation restores all four domains to their last saved state
- No work loss on browser refresh, tab close, or device switch

### Database Schema Additions

```
app.investigations
  id (bigint PK),
  title (varchar 255),
  research_question (text, nullable),
  status (varchar: draft | active | complete | archived),
  owner_id (FK app.users),
  phenotype_state (jsonb, default '{}'),
  clinical_state (jsonb, default '{}'),
  genomic_state (jsonb, default '{}'),
  synthesis_state (jsonb, default '{}'),
  created_at, updated_at, completed_at (nullable),
  last_modified_by (FK app.users, nullable)

app.evidence_pins
  id (bigint PK),
  investigation_id (FK app.investigations, cascade delete),
  domain (varchar: phenotype | clinical | genomic),
  section (varchar: phenotype_definition | population | clinical_evidence |
           genomic_evidence | synthesis | limitations | methods),
  finding_type (varchar: cohort_summary | hazard_ratio | incidence_rate |
                kaplan_meier | codewas_hit | gwas_locus | colocalization |
                open_targets_association | prediction_model | custom),
  finding_payload (jsonb),
  concept_ids (integer[], default '{}'),    -- OMOP concept IDs for cross-linking
  gene_symbols (varchar[], default '{}'),   -- Gene symbols for cross-linking
  sort_order (integer, default 0),
  is_key_finding (boolean, default false),
  narrative_before (text, nullable),
  narrative_after (text, nullable),
  created_at, updated_at

app.investigation_versions
  id (bigint PK),
  investigation_id (FK app.investigations),
  version_number (integer),
  snapshot (jsonb),  -- full investigation + pins + run references
  created_at, created_by (FK app.users)

-- Existing table extended:
app.finngen_runs + investigation_id (FK app.investigations, nullable for backward compat)

-- User preference:
app.users + workbench_mode (varchar: guided | expert, default 'guided')
```

**Note on existing `finngen_runs`:** Existing records remain with `investigation_id = null`. No retroactive migration — users can manually associate legacy runs with new investigations via a "Link to Investigation" action.

### Domain State Shapes (TypeScript)

These define the JSONB contents for each domain state column:

```typescript
interface PhenotypeState {
  concept_sets: Array<{
    id: string;
    name: string;
    concepts: Array<{ concept_id: number; include_descendants: boolean; is_excluded: boolean }>;
  }>;
  cohort_definition: object | null;        // OHDSI cohort definition JSON
  selected_cohort_ids: number[];           // Parthenon cohort IDs
  primary_cohort_id: number | null;
  matching_config: {
    enabled: boolean;
    strategy: string;
    covariates: string[];
    ratio: number;
    caliper: number;
  } | null;
  import_mode: 'parthenon' | 'atlas' | 'file' | 'json' | 'phenotype_library';
  codewas_config: { control_cohort_id: number | null; time_windows: number[] } | null;
  last_codewas_run_id: number | null;
}

interface ClinicalState {
  queued_analyses: Array<{
    analysis_type: string;
    config: Record<string, unknown>;
    run_id: number | null;
    status: 'configured' | 'queued' | 'running' | 'complete' | 'failed';
  }>;
  selected_source_id: number | null;
  comparison_run_ids: [number, number] | null;  // for run diffing
}

interface GenomicState {
  open_targets_queries: Array<{ query_type: 'gene' | 'disease'; term: string; cached_at: string | null }>;
  gwas_catalog_queries: Array<{ query_type: 'trait' | 'gene'; term: string; cached_at: string | null }>;
  uploaded_gwas: Array<{
    file_name: string;
    column_mapping: Record<string, string>;
    upload_id: string;
    top_loci_count: number;
    lambda_gc: number | null;
  }>;
  uploaded_coloc: Array<{ file_name: string; upload_id: string }>;
  uploaded_finemap: Array<{ file_name: string; upload_id: string }>;
}

interface SynthesisState {
  section_order: string[];                 // ordered section keys
  section_narratives: Record<string, string>;  // section key → rich text
  export_history: Array<{ format: string; exported_at: string; exported_by: number }>;
}
```

### API Contract

All endpoints under `/api/v1/investigations`, Sanctum-authenticated.

**Investigation CRUD:**
```
GET    /investigations                    → paginated list (filter: status, owner)
POST   /investigations                    → create (body: { title, research_question? })
GET    /investigations/{id}               → full investigation with latest state
PATCH  /investigations/{id}               → update title, research_question, status
DELETE /investigations/{id}               → soft delete (archive)
```

**Domain State:**
```
PATCH  /investigations/{id}/state/{domain} → save domain state (body: domain state JSON)
                                            domain = phenotype | clinical | genomic | synthesis
                                            Validates against domain state shape
                                            Returns: { saved_at, domain }
```

**Evidence Pins:**
```
GET    /investigations/{id}/pins           → all pins for investigation
POST   /investigations/{id}/pins           → create pin (body: { domain, section, finding_type,
                                            finding_payload, concept_ids?, gene_symbols? })
PATCH  /investigations/{id}/pins/{pinId}   → update (reorder, toggle key, edit narrative)
DELETE /investigations/{id}/pins/{pinId}   → remove pin
```

**Cross-Domain Links:**
```
GET    /investigations/{id}/cross-links    → resolved cross-links based on concept_ids
                                            and gene_symbols across all pins
```

**Analysis Runs (extends existing):**
```
POST   /investigations/{id}/runs           → start analysis (body: { service_name, config })
GET    /investigations/{id}/runs           → runs for this investigation
                                            (supplements existing /study-agent/finngen/runs)
```

**Genomic Evidence (new):**
```
POST   /investigations/{id}/genomic/query-opentargets  → server-side proxy to Open Targets
POST   /investigations/{id}/genomic/query-gwas-catalog → server-side proxy to GWAS Catalog
POST   /investigations/{id}/genomic/query-risteys      → server-side proxy to Risteys
POST   /investigations/{id}/genomic/upload-gwas        → GWAS summary stats file upload
POST   /investigations/{id}/genomic/upload-coloc       → colocalization results upload
POST   /investigations/{id}/genomic/upload-finemap     → fine-mapping results upload
```

**Export:**
```
GET    /investigations/{id}/export/pdf     → generate and download PDF dossier
GET    /investigations/{id}/export/json    → structured JSON evidence package
POST   /investigations/{id}/export/share   → create shareable link
GET    /investigations/{id}/export/strategus → OHDSI Strategus study package
```

**Versioning:**
```
POST   /investigations/{id}/versions       → snapshot current state as new version
GET    /investigations/{id}/versions       → list versions
GET    /investigations/{id}/versions/{v}   → retrieve specific version snapshot
```

### Background Execution

All analyses run as Horizon queue jobs (existing Laravel infrastructure):
- Job dispatched on "Run" click
- Progress reported via Laravel Echo/Reverb websocket (already deployed)
- Left rail Runs panel shows live status
- Completion triggers context card update + toast notification
- Auto-pin suggestion for statistically significant results

---

## What Carries Forward from Current Implementation

| Current Component | Fate |
|---|---|
| `FinnGenRun` model + `finngen_runs` table | Extended with `investigation_id` FK |
| `FinnGenWorkbenchService` | Refactored into domain services: `PhenotypeService`, `ClinicalEvidenceService`, `GenomicEvidenceService` |
| `FinnGenExternalAdapterService` | Preserved — still allows external compute backends per domain |
| `FinnGenRunService` (persistence, export, replay) | Preserved, linked to investigations |
| StudyAgent integration (phenotype search, cohort lint, intent split) | Powers Guided mode question decomposition + Phenotype validation |
| `workbenchShared.tsx` components (KeyValueGrid, RecordTable, ProgressRow, CodeBlock, etc.) | Promoted to `frontend/src/features/workbench/components/shared/` — used across all domains |
| Run history / RunInspectorView / RunComparisonPanel | Becomes the Runs panel in left rail + inline run history per domain |
| Cross-tab handoff callbacks | Replaced by investigation state + concept resolution cross-links |
| Service registry pattern | Preserved for extensibility — domains register available analyses as services |
| WorkbenchLauncherPage (just built) | Extended with "Recent Investigations" section below toolset cards |
| Community Workbench SDK demo | Preserved — documents how third-party tools can register as analysis providers |

---

## Build Phases

### Phase 1a: Foundation + Evidence Board Shell
- Investigation model (database migrations, Eloquent model, API CRUD endpoints, Form Requests)
- Evidence Board shell: left rail navigation, context bar with 4 domain cards, focus panel container, collapsible evidence sidebar
- Concept Explorer (Phenotype domain sub-view 1): type-ahead vocabulary search, concept hierarchy browser, patient counts, concept set builder
- Evidence pin model (database + API + frontend pin/unpin interaction)
- Basic Synthesis domain shell (section list with pins rendered, no export yet)
- WorkbenchLauncherPage extended with "Recent Investigations" section
- Visualization library selection and integration (D3 for custom charts + Recharts for standard statistical plots)

### Phase 1b: Cohort Building + Phenotype Validation
- Cohort Builder (Phenotype domain sub-view 2): visual set operations, matching configuration, attrition funnel, import from Parthenon/Atlas/file/Phenotype Library
- Phenotype Validation (Phenotype domain sub-view 3): CodeWAS with interactive volcano plot, TimeCodeWAS with temporal heatmap, validation checklist
- Guided mode entry: StudyAgent question decomposition → pre-configured investigation
- Auto-save implementation with debounce strategy (see Non-Functional Requirements)

### Phase 2: Clinical Evidence Domain
- Analysis gallery with card-based launcher
- Configuration drawers with guided/expert parameter control
- Background execution with Horizon + Reverb live status
- Inline result cards (HR, KM curves, PS distributions, love plots, calibration)
- Run history panel with compare/replay/fork

### Phase 3: Genomic Evidence Domain
- Open Targets GraphQL integration (server-side proxy with response caching)
- GWAS Catalog REST integration (server-side proxy with response caching)
- Risteys API integration (server-side proxy with response caching)
- GWAS summary stats file upload + Manhattan/QQ/locus zoom visualization
- Cross-domain linking engine (concept/gene resolution using `evidence_pins.concept_ids` and `gene_symbols` arrays)
- Note: colocalization and fine-mapping import deferred to Phase 4 (Genomic domain MVP ships without them)

### Phase 4: Synthesis + Polish
- Evidence Dossier assembly (section management, narrative editing, key finding flags)
- Export pipeline (PDF, JSON, shareable link, OHDSI Study Package)
- Colocalization and fine-mapping result import
- Split view for side-by-side cross-referencing
- Investigation versioning and collaboration (sharing, forking)
- Progressive disclosure polish (guided mode prompts, tooltips, plain-language warnings)

---

## Non-Functional Requirements

### External API Calls

All external API calls (Open Targets, GWAS Catalog, Risteys) are **server-side proxied** through Laravel. The browser never calls external APIs directly. This ensures:
- Rate limiting on outbound calls (configurable per-provider, default 10 req/min)
- Response caching in Redis (TTL: 24h for Open Targets/GWAS Catalog, 7d for Risteys)
- Response validation before passing to frontend (treat external data as untrusted)
- No CORS issues or API key exposure

### File Upload Security

GWAS summary stats, colocalization, and fine-mapping uploads:
- Max file size: 500MB (configurable via `INVESTIGATION_MAX_UPLOAD_MB`)
- Allowed formats: `.tsv`, `.csv`, `.gz` (gzipped TSV/CSV)
- Server-side column structure validation before processing
- Files stored in `storage/app/investigations/{id}/uploads/` (not public)
- Virus/malware scanning via ClamAV if available (graceful skip if not)
- Column mapping validated against expected schema (chr, pos, ref, alt, beta/or, se, p minimum)

### Auto-Save Strategy

Domain state saves on **discrete actions**, not continuous typing:
- Concept set created/modified/deleted
- Cohort definition saved
- Analysis configuration applied
- Matching parameters confirmed
- File upload completed
- Pin created/moved/deleted

Implementation: frontend dispatches `PATCH /investigations/{id}/state/{domain}` with a 2-second debounce after the last discrete action. Optimistic UI — the save indicator shows "Saving..." then "Saved" without blocking interaction. Conflict resolution: last-write-wins (single-user investigations); for shared investigations, warn on concurrent edit.

### Error Handling

**Analysis run failures:** Failed Horizon jobs set `status = 'failed'` on the run record. The Runs panel shows a red status badge with an expandable error message. The domain context card shows "1 failed" in amber. The user can retry or view logs.

**External API failures:** Timeout (10s default) → show "Service unavailable" with a retry button. Rate limited → show "Rate limited, retrying in Ns" with automatic exponential backoff (max 3 retries). Invalid response → log, show "Unexpected response from {service}" with a "Report issue" action.

**File upload failures:** Validation errors → show specific column mapping issues inline. Processing errors → show error with the ability to re-upload.

**State save failures:** Retry 3 times with backoff. If all fail, show persistent "Unsaved changes" warning in the context bar. The user can manually trigger save or export state as JSON.

### Authorization

- **Creating investigations:** Any authenticated user (role: researcher, analyst, or admin)
- **Viewing/editing:** Owner by default. Sharing adds users with `read` or `read_write` permission via `app.investigation_collaborators` join table
- **Deleting/archiving:** Owner or admin only
- **Analysis execution:** Inherits user's existing OMOP source access permissions (already enforced by Sanctum + Source model)
- **Export:** Owner and read_write collaborators. Shareable link generates a time-limited, read-only token

### Accessibility

- All drag-and-drop interactions have keyboard alternatives (arrow keys for reorder, Enter to move)
- Charts include alt text with key metric summaries
- Color is never the sole differentiator — all status indicators include text labels and/or icons
- Focus management: switching domains via left rail moves focus to the focus panel header
- This is a **desktop-first** interface. No mobile layout is planned; minimum supported viewport is 1280px

### Performance Budgets

- GWAS summary stats file: up to 500MB, ~25M rows. Processing is a Horizon job, not synchronous
- Evidence pins per investigation: soft limit 200 (warn at 150). UI renders as virtualized list
- JSONB state columns: expected <100KB per domain for typical investigations
- Manhattan plot: rendered client-side with D3 canvas (not SVG) for datasets >1M variants
- Context bar updates: debounced to 1/second maximum to prevent render thrashing during batch analysis completion

### Visualization Libraries

- **D3.js** — Manhattan plots, locus zoom, volcano plots, temporal heatmaps (custom genomic/clinical visualizations requiring precise control)
- **Recharts** — Kaplan-Meier curves, forest plots, bar charts, progress indicators (standard statistical plots with React integration)
- **No additional charting frameworks** to avoid bundle bloat. Custom components for Venn diagrams and love plots built on D3.

---

## Success Criteria

1. A researcher can go from research question to exportable Evidence Dossier without leaving Parthenon
2. Clinical and genomic evidence are viewable side-by-side with automatic cross-linking
3. No state is lost on navigation — investigation persists across sessions and devices
4. Both guided (AI-assisted) and expert (full parameter) workflows are supported
5. The Evidence Dossier is the first artifact in the OHDSI/genomics ecosystem that combines clinical observational evidence with genomic evidence in a structured, exportable format
6. Analysis execution shows real-time progress (not just a spinner)
7. The platform handles the full phenotype-to-evidence pipeline: concept exploration → cohort building → validation → clinical analytics → genomic context → evidence synthesis
