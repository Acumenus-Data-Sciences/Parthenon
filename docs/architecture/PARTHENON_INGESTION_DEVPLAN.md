# Parthenon — D2E-Style Ingestion Patterns Development Plan

> **For Claude Code.** This is an executable, agentic dev plan. Each task is self-contained with paths, acceptance criteria, and references. You can pick up any task from `## Backlog` and execute it without re-reading the whole document — task headers carry their own context.
>
> **Source memo:** `Parthenon_Ingestion_Patterns_Memo.docx` (companion document — read for strategic rationale). This file is the implementation contract.
>
> **Goal:** Ship 14 D2E-parity ingestion templates plus 4 Parthenon-only differentiators on top of a new template-registry / node-SDK / orchestration platform. Across roughly three quarters with one platform engineer + 1–2 ETL engineers.

---

## Table of Contents

1. [Conventions & Ground Rules](#1-conventions--ground-rules)
2. [Repository Layout (Assumed)](#2-repository-layout-assumed)
3. [Architecture Overview](#3-architecture-overview)
4. [Task Backlog by Phase](#4-task-backlog-by-phase)
   - [Phase 0 — Foundations](#phase-0--foundations-q1-10-weeks)
   - [Phase 1 — Source-format breadth](#phase-1--source-format-breadth-q2-12-weeks)
   - [Phase 2 — Reference data, NLP, domain](#phase-2--reference-data-nlp-domain-enrichment-q3-12-weeks)
   - [Phase 3 — Differentiators](#phase-3--parthenon-only-differentiators-q4)
5. [Cross-Cutting Concerns](#5-cross-cutting-concerns)
6. [Testing Strategy](#6-testing-strategy)
7. [Documentation Requirements](#7-documentation-requirements)
8. [Definition of Done (per template)](#8-definition-of-done-per-template)
9. [Open Questions for Human Review](#9-open-questions-for-human-review)
10. [Reference Material](#10-reference-material)

---

## 1. Conventions & Ground Rules

### 1.1 Branch and PR conventions
- Branch names: `feat/<phase>-<task-id>-<short-slug>` — e.g. `feat/p0-T-001-node-sdk-skeleton`.
- PR titles: `[<task-id>] <one-line description>` — must reference the task ID in this plan.
- One task = one PR where reasonable. Tasks marked `(L — large)` may be split into 2–4 PRs but the splits should be checkpointed in the task body.
- Every PR must include: passing CI, updated docs, ADR if architecturally significant (see §1.4).

### 1.2 Code style
- **Python:** `ruff` + `black` (line length 100), `mypy --strict` for new modules, `pytest` for tests.
- **TypeScript:** existing project ESLint/Prettier config, no relaxations.
- **R:** `lintr` defaults, `renv` lockfile pinned.
- **SQL:** `sqlfluff` with the existing project dialect config; one statement per file in the `migrations/` directory.
- **YAML:** 2-space indent, schema-validated against the manifest schema (§Phase 0 Task T-003).

### 1.3 Commit conventions
Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`). Scope is the package (`feat(parthenon-nodes): add csv-reader node`).

### 1.4 ADRs (Architecture Decision Records)
Architecturally significant decisions land in `docs/adr/NNNN-title.md` using the [MADR](https://adr.github.io/madr/) template. The platform-abstraction tasks (T-001, T-002, T-003) each require an ADR. Rule of thumb: if a future engineer would ask "why did we pick X?", write the ADR.

### 1.5 Crimson brand color
For any new Parthenon-branded UI element, accent color is **crimson `#9B1B30`** (not navy). Light variant `#F4DADF`. This is a project-wide convention.

### 1.6 What you (Claude Code) should NOT do without explicit approval
- Do not modify the existing PHP/Laravel API surface — additions only, breaking changes go through human review.
- Do not change the database schema of the existing Parthenon catalog without an approved migration ADR.
- Do not introduce a new top-level language (e.g., Go, Java) — work within Python/TypeScript/R/Rust/SQL/YAML.
- Do not commit credentials, UMLS API keys, PhysioNet credentials, or signed Athena bundles. Use `.env` + secrets manager references only.
- Do not push directly to `main`. PRs only.

---

## 2. Repository Layout (Assumed)

> **HUMAN: please confirm or correct this layout before Claude Code starts work.** The plan assumes a monorepo with these top-level directories. If the actual repo differs, update the paths in §4 task descriptions as needed.

```
parthenon/
├── apps/
│   ├── web/                        # TypeScript/React front-end (existing)
│   ├── api/                        # PHP/Laravel API (existing)
│   └── ingestion-ui/               # NEW — dataflow UI (TS) — Phase 0 T-004
├── packages/
│   ├── parthenon-nodes/            # NEW — Python node SDK — Phase 0 T-001
│   ├── parthenon-cdm/              # NEW — typed OMOP CDM bindings — Phase 0 T-005
│   ├── parthenon-templates/        # NEW — manifest registry — Phase 0 T-003
│   └── parthenon-orchestration/    # NEW — Prefect adapter — Phase 0 T-002
├── templates/                      # NEW — YAML template manifests — all phases
│   ├── _shared/                    #   reusable sub-graphs and partials
│   ├── hello_cdm/
│   ├── nodes_test/
│   ├── load_athena_vocabulary/
│   ├── load_synpuf/
│   ├── fhir_to_omop/
│   └── … (one directory per template)
├── services/
│   ├── analytics-r/                # existing R footprint — extend, don't fork
│   └── perf-rust/                  # NEW or existing Rust — Phase 1+
├── migrations/                     # SQL migrations
├── docs/
│   ├── adr/                        # architecture decision records
│   ├── templates/                  # per-template authoring guide
│   └── api/                        # node SDK reference
├── tests/
│   ├── e2e/                        # full template runs against fixture sources
│   ├── integration/                # node SDK + orchestration
│   └── fixtures/                   # tiny FHIR bundles, DICOM files, SDTM samples
└── .github/workflows/              # CI
```

### Key monorepo decisions to confirm
- **Python tooling:** `uv` workspace (recommended) or `poetry` with path dependencies. ADR T-001 will pick.
- **Node tooling:** assume `pnpm` workspace (matches typical TS monorepo with 327K LoC).
- **R tooling:** `renv` per analytics package, `pak` for installation.

---

## 3. Architecture Overview

Three platform abstractions, layered:

```
┌────────────────────────────────────────────────────────────────┐
│  Dataflow UI (apps/ingestion-ui)                              │
│  - Template chooser, parameter forms, run inspector           │
└──────────────────────────┬─────────────────────────────────────┘
                           │ REST/GraphQL
┌──────────────────────────▼─────────────────────────────────────┐
│  Template Registry (packages/parthenon-templates)             │
│  - YAML manifests in templates/, validated on commit          │
│  - Materializes manifests into a node graph + parameter form  │
└──────────────────────────┬─────────────────────────────────────┘
                           │ materialized flow
┌──────────────────────────▼─────────────────────────────────────┐
│  Orchestration Adapter (packages/parthenon-orchestration)     │
│  - Default backend: Prefect 3.x                                │
│  - Pluggable interface (Temporal / Dagster / Airflow swap-ins)│
└──────────────────────────┬─────────────────────────────────────┘
                           │ runs nodes
┌──────────────────────────▼─────────────────────────────────────┐
│  Node SDK (packages/parthenon-nodes)                          │
│  - Typed nodes: r, python, sql, csv, db-reader/writer,        │
│    fhir-resource, dicom-metadata, sdtm-domain, vocab-loader,  │
│    concept-mapper, anonymizer, ner                             │
└────────────────────────────────────────────────────────────────┘
```

### Data flow for a single template execution
1. User selects template in UI.
2. UI calls registry → returns manifest + parameter schema.
3. UI renders form, user fills parameters, submits.
4. Registry validates parameters, materializes the node graph, hands flow to orchestration adapter.
5. Adapter submits to Prefect (or alternative backend); each node runs in its declared environment.
6. Nodes emit typed artifacts → Parthenon storage adapter (S3 / GCS / Azure Blob / on-prem).
7. Post-condition tests run; results land in Parthenon catalog with provenance.
8. UI shows run inspector with logs, artifacts, and links to the resulting OMOP dataset.

---

## 4. Task Backlog by Phase

### Task ID legend
- `T-NNN` — sequential. Phase prefix in §4 headers, not in IDs (so a task can move phases without renumbering).
- **Effort:** S = ≤2 weeks · M = 3–5 weeks · L = 6+ weeks (consider splitting).
- **Status:** `TODO` · `IN PROGRESS` · `BLOCKED` · `DONE`.
- **Depends on:** task IDs that must be DONE first.

---

### Phase 0 — Foundations (Q1, ~10 weeks)

> **Goal:** Land the three platform abstractions and prove them with the four "trivial" templates (hello_cdm, nodes_test, load_athena_vocabulary, load_synpuf). Nothing else in the plan unblocks until these are merged.

#### T-001 · Node SDK skeleton
**Effort:** M · **Status:** TODO · **Depends on:** none · **Owner:** platform

**What to build**
- New package: `packages/parthenon-nodes/` (Python).
- Define the `Node` abstract base class with: `name`, `version`, `inputs` (dict of typed schemas), `outputs` (dict of typed schemas), `parameters` (Pydantic model), `requirements` (env spec), `resources` (CPU/memory hints), `execute(ctx, inputs, params) -> outputs`.
- Implement the eight bootstrap nodes (mirrors D2E "Nodes Test"):
  - `RNode` — runs an R script in a sandboxed kernel via `subprocess` + `Rscript`. Stdout/stderr captured to artifacts.
  - `PythonNode` — runs arbitrary Python in a subprocess with the declared environment.
  - `SqlNode` — executes parameterized SQL against a configured connection (SQLAlchemy engine factory).
  - `CsvReaderNode` — reads CSV with header inference and dtype hints (Polars by default, Pandas option).
  - `DbReaderNode` / `DbWriterNode` — typed table I/O via SQLAlchemy.
  - `Py2TableNode` — Pandas/Polars dataframe → database table.
  - `GenericFileNode` — Parquet/Avro/JSON/binary file ingest.
- Schema enforcement via Pandera (preferred for dataframes) + Pydantic (for params).
- Local dev runner: `parthenon-nodes run <node-class> --params params.json` for hands-on testing.

**Acceptance criteria**
- [ ] Package installable via `uv pip install -e packages/parthenon-nodes`.
- [ ] All 8 nodes pass their unit tests with >90% line coverage.
- [ ] Each node has a docstring example that doctest runs green.
- [ ] `mypy --strict packages/parthenon-nodes` passes.
- [ ] ADR `docs/adr/0001-node-sdk-design.md` covering: dataframe library choice (Polars vs Pandas), schema library choice (Pandera vs Patito), and subprocess vs in-process execution.

**Files to create (initial)**
```
packages/parthenon-nodes/
├── pyproject.toml
├── src/parthenon_nodes/
│   ├── __init__.py
│   ├── base.py               # Node ABC, NodeContext, NodeResult
│   ├── schemas.py            # Pandera + Pydantic schema utilities
│   ├── runner.py             # local dev runner CLI
│   └── nodes/
│       ├── r_node.py
│       ├── python_node.py
│       ├── sql_node.py
│       ├── csv_reader.py
│       ├── db_reader.py
│       ├── db_writer.py
│       ├── py2table.py
│       └── generic_file.py
└── tests/
    ├── unit/
    └── fixtures/
```

**References:** D2E "Nodes Test" template; Prefect Tasks API; Pandera DataFrameModel docs.

**Subtasks**
- [ ] Initialize package + tooling.
- [ ] Implement `Node` ABC + `NodeContext` (logger, secrets accessor, artifact writer, db connection factory).
- [ ] Implement each bootstrap node.
- [ ] Build local dev runner CLI.
- [ ] Tests + fixtures.
- [ ] ADR.

---

#### T-002 · Orchestration adapter (Prefect default)
**Effort:** M · **Status:** TODO · **Depends on:** T-001 · **Owner:** platform

**What to build**
- New package: `packages/parthenon-orchestration/`.
- Pluggable interface `OrchestrationBackend` with methods: `submit(flow_spec) -> RunHandle`, `get_status(run_id)`, `get_logs(run_id)`, `cancel(run_id)`, `list_artifacts(run_id)`.
- Default implementation: `PrefectBackend` using Prefect 3.x. Map a Parthenon node graph to a Prefect flow with one Prefect `task` per node, dependencies wired by node-output → node-input edges.
- Stub implementations: `TemporalBackend`, `DagsterBackend`, `AirflowBackend` (interface only, NotImplementedError bodies — proves the interface is real).
- Artifact handling: Parthenon storage adapter writes to S3/GCS/Azure Blob/on-prem; Prefect artifacts carry pointers, not blobs. (D2E moved to this pattern in the [Prefect artifacts PR](https://github.com/OHDSI/d2e/pull/237).)

**Acceptance criteria**
- [ ] A 3-node hello-world flow runs end-to-end on Prefect 3.x and produces artifacts in the configured storage backend.
- [ ] Run metadata persisted to the Parthenon catalog DB.
- [ ] Backend selectable via config (env var `PARTHENON_ORCHESTRATION_BACKEND=prefect`).
- [ ] ADR `docs/adr/0002-orchestration-backend.md` covering: Prefect vs Temporal vs Dagster, why Prefect default, swap path.

**Files to create**
```
packages/parthenon-orchestration/
├── src/parthenon_orchestration/
│   ├── interface.py             # OrchestrationBackend ABC
│   ├── flow_spec.py             # serializable node graph
│   ├── prefect_backend.py
│   ├── temporal_backend.py      # stub
│   ├── dagster_backend.py       # stub
│   └── airflow_backend.py       # stub
└── tests/
```

**References:** Prefect 3.x flow API, OHDSI/d2e PR #237 (Prefect artifacts pattern).

---

#### T-003 · Template manifest schema + registry
**Effort:** M · **Status:** TODO · **Depends on:** T-001, T-002 · **Owner:** platform

**What to build**
- New package: `packages/parthenon-templates/`.
- YAML schema for template manifests (validated by JSON Schema + Pydantic).
- Required manifest fields:
  ```yaml
  apiVersion: parthenon.io/v1
  kind: Template
  metadata:
    id: load_synpuf
    name: "Load CMS SynPUF 1K dataset into the database"
    version: 0.1.0
    category: reference-dataset
    tags: [synpuf, cms, demo]
    cdm_versions: ["5.3", "5.4"]
    author: "Parthenon Project"
  spec:
    parameters:        # JSON Schema for the UI form
      target_schema:
        type: string
        description: "Target OMOP schema name"
        default: "synpuf"
    requires:
      vocabularies: [snomed, rxnorm, loinc]
      cdm_initialized: true
    nodes:             # the DAG
      - id: fetch
        type: parthenon.nodes.GenericFileNode
        params: { url: "ftp://ftp.ohdsi.org/synpuf/1k/" }
      - id: load
        type: parthenon.nodes.DbWriterNode
        inputs: { data: fetch.output }
        params: { schema: "${parameters.target_schema}" }
    post_conditions:
      - kind: row_count
        table: person
        min: 1000
      - kind: dqd_check
        check: "person_yob_in_range"
  ```
- Registry CRUD endpoints (HTTP) for: list templates, get manifest, validate manifest, materialize flow with given parameters.
- Pre-commit hook + CI step that validates every manifest in `templates/` against the schema.
- Versioning: manifests are SemVer; the registry exposes all published versions; users pin or use `latest` (with a warning).

**Acceptance criteria**
- [ ] Schema published at `packages/parthenon-templates/schema/template.v1.json`.
- [ ] Registry can load all manifests from `templates/`, validate them, and materialize a flow when given valid parameters.
- [ ] Invalid manifest in `templates/_test_invalid/` is rejected with a clear error message.
- [ ] CI fails when any committed manifest doesn't validate.
- [ ] ADR `docs/adr/0003-template-manifest-format.md` covering: YAML schema choices, versioning policy, third-party manifest signing posture (deferred but documented).

**Files to create**
```
packages/parthenon-templates/
├── schema/
│   └── template.v1.json
├── src/parthenon_templates/
│   ├── manifest.py        # Pydantic model + loader
│   ├── registry.py        # in-memory + filesystem-backed registry
│   ├── materializer.py    # manifest + params → FlowSpec
│   └── api.py             # HTTP endpoints (FastAPI)
└── tests/
```

---

#### T-004 · Dataflow UI (template chooser parity with D2E)
**Effort:** M · **Status:** TODO · **Depends on:** T-003 · **Owner:** front-end

**What to build**
- New app: `apps/ingestion-ui/` (TypeScript). May be a new route in the existing `apps/web/` if that better fits Parthenon's UI conventions — confirm with the front-end lead.
- Pages:
  1. **Templates list** — searchable, filterable by category and tag.
  2. **New dataflow** — name, comment, template (optional) — matches D2E's UX so prospects who've used D2E feel at home.
  3. **Parameter form** — auto-generated from the template's JSON Schema (use `@rjsf/core` or equivalent).
  4. **Run inspector** — DAG visualization, per-node logs, artifact list, status.
- Crimson accent (`#9B1B30`) per project convention.
- Responsive at the same breakpoints as the rest of the Parthenon web app.

**Acceptance criteria**
- [ ] User can list templates, create a new dataflow from a template, fill parameters, submit, and watch it run.
- [ ] Visual parity with D2E "New dataflow" dialog (template chooser dropdown is the must-match element).
- [ ] Run inspector shows real Prefect-run state via the orchestration adapter API.
- [ ] Storybook coverage for all new components.
- [ ] E2E Playwright test: full happy path on the `hello_cdm` template.

**Reference image:** see `docs/screenshots/d2e_new_dataflow.png` (the screenshot that motivated this work).

---

#### T-005 · `parthenon-cdm` Python package
**Effort:** S · **Status:** TODO · **Depends on:** none (parallel with T-001) · **Owner:** ETL

**What to build**
- Wrapper around `pyomop` providing typed builders for OMOP CDM v5.3, v5.4, and the Oncology Extension.
- `Schema` factory that emits SQLAlchemy metadata for a given CDM version.
- DDL migration scripts in `migrations/` for each supported version.
- Idempotent `bootstrap()` function that creates schema + indexes + constraints.

**Acceptance criteria**
- [ ] `parthenon_cdm.bootstrap(version="5.4", schema="omop", engine=engine)` creates a complete v5.4 CDM in PostgreSQL.
- [ ] Same works for v5.3.
- [ ] Oncology Extension tables (`EPISODE`, `EPISODE_EVENT`, etc.) selectable as an option.
- [ ] Tested against PostgreSQL 14, 15, 16 in CI.

---

#### T-006 · Template: `hello_cdm`
**Effort:** S · **Status:** TODO · **Depends on:** T-001, T-002, T-003, T-005 · **Owner:** ETL

**What to build**
- Template directory: `templates/hello_cdm/`.
- Manifest: bootstraps a tiny CDM in a target schema, inserts one PERSON row, queries it back.
- Documentation: this is the canonical "the framework works" demo. It is what we point developers at first.

**Acceptance criteria**
- [ ] Template appears in the UI dropdown.
- [ ] Runs end-to-end in <30 seconds against a Postgres 16 instance.
- [ ] Post-conditions assert: schema exists, PERSON has 1 row, query returns it.

---

#### T-007 · Template: `nodes_test`
**Effort:** S · **Status:** TODO · **Depends on:** T-001, T-002, T-003 · **Owner:** ETL

**What to build**
- Template that exercises every node type in the SDK. This is the integration smoke test that runs on every release.
- Each node gets a tiny representative invocation; outputs are asserted against expected fixtures.

**Acceptance criteria**
- [ ] Runs in CI on every push to `main`.
- [ ] If any node breaks the contract, this template's run fails before any source-format template is touched.

---

#### T-008 · Template: `load_athena_vocabulary`
**Effort:** M · **Status:** TODO · **Depends on:** T-005, T-006 · **Owner:** ETL

**What to build**
- Loader for an Athena vocabulary bundle (CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR, VOCABULARY, DOMAIN, CONCEPT_SYNONYM, DRUG_STRENGTH).
- Handles CPT4 separately via the OHDSI `cpt4.jar` loader (requires UMLS API key — read from secrets manager, never logged).
- Idempotent re-loading: re-running on the same bundle is a no-op.
- Version pinning: stores the bundle's reference timestamp in a `vocabulary_load` audit table.
- **Differentiator feature:** vocabulary diff — given two bundle paths, surface added/removed/changed concepts. Defer the full UI; provide CLI + JSON output now.

**Acceptance criteria**
- [ ] Loads a real Athena bundle (test fixture: a stripped-down 100MB bundle with SNOMED, RxNorm, LOINC).
- [ ] CPT4 step gated on `UMLS_API_KEY` env var; gracefully skipped with a warning if absent.
- [ ] Re-running is a no-op (verified by row-count parity).
- [ ] `parthenon-vocab diff <bundle_a> <bundle_b>` produces JSON output.

**References:** Athena (athena.ohdsi.org) bundle format; OHDSI `cpt4.jar`.

---

#### T-009 · Template: `load_synpuf` (1K and 100K)
**Effort:** S · **Status:** TODO · **Depends on:** T-005, T-008 · **Owner:** ETL

**What to build**
- Fetches OHDSI-hosted CDM-shaped SynPUF files (1K or 100K, parameterized).
- Loads them into a target schema after vocabulary is present.
- Wires up an Achilles-style summary as a post-condition.

**Acceptance criteria**
- [ ] `load_synpuf` template runs end-to-end and produces a working OMOP dataset queryable from ATLAS or equivalent.
- [ ] Demo time: SE can stand up a populated OMOP env in <20 minutes with this + T-008.

**References:** OHDSI ETL-CMS; Christophe Lambert SynPUF→OMOP work; OHDSI FTP at `ftp://ftp.ohdsi.org/synpuf/`.

---

### Phase 1 — Source-format breadth (Q2, ~12 weeks)

> **Goal:** Hit D2E parity on the highest-customer-pull source formats: FHIR, DICOM, and PRO instruments. By end of phase, customers can ingest FHIR EHR data, DICOM metadata, and EQ-5D-5L questionnaires.

#### T-010 · New nodes: `fhir-resource`, `dicom-metadata`, `anonymizer`
**Effort:** M · **Status:** TODO · **Depends on:** T-001 · **Owner:** ETL platform

**What to build**
- `FhirResourceNode` — reads FHIR via either `$export` NDJSON (Bulk Data API) or resource-by-resource search. Uses `fhir.resources` Python lib for typed parsing. Supports profile selection (US Core, mCODE, IPS, German MII).
- `DicomMetadataNode` — streams metadata only via `pydicom`. Supports both filesystem and DICOMweb (QIDO-RS / WADO-RS) sources. **Pixel data stays in PACS/VNA — never copied.**
- `AnonymizerNode` — pluggable backend interface. Implementations: Microsoft FHIR Anonymizer (.NET shell-out), Parthenon native redactor v0 (config-driven, Python).

**Acceptance criteria**
- [ ] Each node has a unit test against a fixture (small FHIR bundle, a single DICOM file, an anonymization config).
- [ ] FHIR bulk-export path tested against a HAPI FHIR test server in CI.
- [ ] Memory profile: FHIR node streams; doesn't load entire bundle into memory.

**References:** HL7 FHIR Bulk Data IG; pydicom; Microsoft FHIR Anonymizer.

---

#### T-011 · Template: `qr_eq5d5l_to_measurement`
**Effort:** S · **Status:** TODO · **Depends on:** T-010 · **Owner:** ETL

**What to build**
- Template that takes FHIR `QuestionnaireResponse` resources for EQ-5D-5L, projects each item to an OMOP MEASUREMENT row (one per dimension per administration), plus EQ-VAS as a separate MEASUREMENT, plus the derived utility index as a third.
- Uses an EQ-5D-5L value-set lookup table shipped with the template (CC0 / EuroQol non-commercial-use note in the README).
- **Pattern to extract:** abstract a `pro_instrument` shared sub-graph in `templates/_shared/pro_base.yaml` so PHQ-9, GAD-7, PROMIS, KCCQ-12 templates can inherit it later.

**Acceptance criteria**
- [ ] Template runs against fixture FHIR bundles in `tests/fixtures/eq5d5l/`.
- [ ] Output passes DQD-equivalent checks: all measurement_concept_ids are valid, value_as_number ranges within instrument bounds.
- [ ] Reusable `_shared/pro_base.yaml` is exercised by at least 2 instruments (EQ-5D-5L now, scaffolded EQ-5D-3L for proof).

**References:** EQ-5D-5L instrument; EuroQol value sets; FHIR QuestionnaireResponse resource.

**Licensing note:** EQ-5D requires registration with EuroQol for use. Document this in the template README — Parthenon ships the *mapping logic* and a *placeholder value set*; customer must obtain their EuroQol value set themselves.

---

#### T-012 · Template: `etl_dicom_metadata`
**Effort:** M · **Status:** TODO · **Depends on:** T-010 · **Owner:** ETL

**What to build**
- Template that ingests DICOM metadata only (no pixels) and projects to the OMOP imaging extension.
- Uses the JAMIA reference implementation (Nagy et al., 2025) as the mapping source: 5,183 DICOM attributes + 3,628 coded values as custom OMOP concepts.
- Source backends: filesystem (recursive directory scan) + DICOMweb (QIDO-RS for metadata, no WADO-RS retrieval needed for this template).

**Acceptance criteria**
- [ ] Ingests a fixture DICOM directory (~50 files, 3 modalities) and produces correct imaging-extension rows.
- [ ] All custom concepts resolve to a concept_id present in the imaging vocabulary load (T-013).
- [ ] DICOMweb path tested against a dcm4chee test instance in CI.

**Reference:** Nagy et al., "Breaking data silos: incorporating the DICOM imaging standard into the OMOP CDM," JAMIA 2025; `paulnagy/DICOM2OMOP` repo.

---

#### T-013 · Template: `load_imaging_vocabulary`
**Effort:** S · **Status:** TODO · **Depends on:** T-008 · **Owner:** ETL

**What to build**
- Loads the JAMIA-derived custom concepts into the OMOP vocabulary tables in a Parthenon-namespaced concept_id range to avoid collisions with future Athena releases.
- Pinned to a specific upstream version; bumping is a deliberate manifest update.
- Idempotent reload.

**Acceptance criteria**
- [ ] After load, count of CONCEPT rows in Parthenon namespace matches expected (5,183 + 3,628 ± fixture variation).
- [ ] T-012 (`etl_dicom_metadata`) succeeds against this load.

---

#### T-014 · Template: `fhir_anonymizer`
**Effort:** M · **Status:** TODO · **Depends on:** T-010 · **Owner:** ETL

**What to build**
- Pre-processing template that applies anonymization to a FHIR bundle before any downstream ETL.
- Default backend: Microsoft FHIR Anonymizer (containerized; the .NET dependency lives in a sidecar, not in the main Python env).
- Alternative backend: Parthenon native redactor (Python; rule-driven from the same Microsoft-compatible config format for portability).
- The anonymizer is composable — `fhir_to_omop` (T-015) accepts an upstream anonymizer node as a parameter.

**Acceptance criteria**
- [ ] Both backends produce equivalent output on the test corpus (canonical anonymization config + 100 synthetic patients).
- [ ] Runtime config: `backend: ms-anonymizer` or `backend: parthenon-native`.
- [ ] Container security: anonymizer container runs non-root, no network egress.

---

#### T-015 · Template: `fhir_to_omop`
**Effort:** L · **Status:** TODO · **Depends on:** T-010, T-014 · **Owner:** ETL — **split into 3 PRs**

**What to build**
- Python-native FHIR → OMOP CDM converter conforming to the HL7 FHIR-OMOP IG.
- Resource scope (split across PRs):
  - **PR-A:** Patient, Encounter, Condition, Observation. Targets PERSON, VISIT_OCCURRENCE, CONDITION_OCCURRENCE, MEASUREMENT/OBSERVATION.
  - **PR-B:** Procedure, MedicationStatement, MedicationAdministration, Immunization. Targets PROCEDURE_OCCURRENCE, DRUG_EXPOSURE.
  - **PR-C:** DiagnosticReport, Consent, performance path (Rust-assisted bulk-export ingestion if profiling shows Python is the bottleneck).
- Profile selector: US Core, mCODE, IPS, German MII selectable per run.
- Both v5.3 and v5.4 CDM targets.

**Acceptance criteria (per PR, tightened in PR-C)**
- [ ] Conformance test suite: HL7 FHIR-OMOP IG examples round-trip correctly.
- [ ] Performance: 1M Observation resources in <10 minutes on the reference hardware (8 vCPU, 32GB).
- [ ] Profile selector tested on US Core + German MII fixtures.
- [ ] Achilles-equivalent summary passes on the resulting CDM.

**Reference implementations to study (do not port):**
- `NACHC-CAD/fhir-to-omop` (Java)
- `OHDSI/FhirToCdm` (.NET)
- `OHDSI/ETL-German-FHIR-Core` (Java/Spring, German MII)
- `HL7/fhir-omop-ig` (canonical mapping reference)

---

### Phase 2 — Reference data, NLP, domain enrichment (Q3, ~12 weeks)

> **Goal:** NER (LLM and SciSpaCy), ARTEMIS, MIMIC, and SDTM. Most of these wrap existing OSS rather than rebuilding it.

#### T-016 · Node: `ner` (pluggable backend)
**Effort:** M · **Status:** TODO · **Depends on:** T-001 · **Owner:** ML/ETL

**What to build**
- `NerNode` with backend interface: `extract(text) -> list[Entity]` where `Entity` includes span, text, type, confidence, optional concept_id.
- Backends:
  - `LlmNerBackend` — Anthropic SDK + OpenAI SDK; configurable model, temperature, prompt template.
  - `SciSpacyNerBackend` — SciSpaCy models (`en_core_sci_md`, `en_ner_bc5cdr_md`, `en_ner_bionlp13cg_md`).
  - `LletuceHybridBackend` — Llettuce-style hybrid (LLM + retrieval) for OMOP concept binding.
- Audit trail: every NER run records model, prompt version, seed, params in NOTE_NLP rows.

**Acceptance criteria**
- [ ] All three backends produce output on a 100-note fixture; each backend's output is deterministic given fixed params.
- [ ] Cost telemetry for LLM backends (tokens in/out, $ estimated).
- [ ] Reproducibility test: SciSpaCy backend produces byte-identical output on two consecutive runs.

---

#### T-017 · Templates: `parthenon_ner_llm` and `parthenon_ner_scispacy`
**Effort:** M · **Status:** TODO · **Depends on:** T-016 · **Owner:** ETL

**What to build**
- Two templates wrapping the NER node with default configurations:
  - `parthenon_ner_llm` — Claude as default model, conservative prompt, audit-heavy.
  - `parthenon_ner_scispacy` — SciSpaCy MD models, UMLS linker enabled, OMOP concept-id binding via Athena lookup.
- Both write to NOTE_NLP with full provenance.

**Acceptance criteria**
- [ ] LLM template costs <$0.10 per 100 notes at default config.
- [ ] SciSpaCy template processes 10K notes in <20 minutes on 4 vCPU.
- [ ] OMOP concept-id binding accuracy >70% on the i2b2 NER benchmark set (sanity floor; not a research claim).

---

#### T-018 · Template: `load_mimic_iv_omop`
**Effort:** M · **Status:** TODO · **Depends on:** T-005, T-008 · **Owner:** ETL

**What to build**
- Wraps the upstream MIMIC-OMOP Postgres ETL (Paris team) as a Parthenon template.
- Auth: PhysioNet credentialed access token from secrets manager; never logged.
- Achilles + DQD post-conditions wired up.

**Acceptance criteria**
- [ ] Loads MIMIC-IV demo (100 patient subset) end-to-end.
- [ ] DQD report attached as a run artifact.
- [ ] Runs in <2 hours against full MIMIC-IV on reference hardware.

**References:** Paris MIMIC-OMOP (`MIT-LCP/mimic-omop`); MIMIC-IV PhysioNet.

---

#### T-019 · Template: `artemis_chemo_regimens`
**Effort:** S · **Status:** TODO · **Depends on:** T-001 (R node) · **Owner:** ETL

**What to build**
- Wraps OHDSI/ARTEMIS R package as a Parthenon template. **Do not rewrite ARTEMIS.**
- Pre-conditions: HemOnc vocabulary present, validDrugs configured.
- Post-conditions: EPISODE table populated with `Disease First Occurrence` and regimen episodes.
- UI surface: the cohort UI links to ARTEMIS-derived regimens with full lineage.

**Acceptance criteria**
- [ ] Template runs against MIMIC-IV-OMOP after T-018.
- [ ] At least one realistic chemo regimen detected in the test data and linked to its HemOnc concept.

**Reference:** OHDSI/ARTEMIS; HemOnc.org OMOP vocabulary integration.

---

#### T-020 · Node: `sdtm-domain` and Template: `sdtm_to_omop_v54`
**Effort:** L · **Status:** TODO · **Depends on:** T-001, T-005 · **Owner:** ETL — **split into 2 PRs**

**What to build**
- `SdtmDomainNode` — typed reader for a single SDTM domain (DM, AE, CM, EX, LB, VS, QS, DS).
- Template `sdtm_to_omop_v54`:
  - **PR-A:** DM → PERSON / OBSERVATION_PERIOD; CM, EX → DRUG_EXPOSURE; AE → CONDITION_OCCURRENCE.
  - **PR-B:** LB, VS → MEASUREMENT; QS → MEASUREMENT (PRO subset); DS → VISIT_OCCURRENCE / DEATH.
- Concept-mapping decisions surfaced to the user in a **mapping review UI** (deferred to T-029 for full UI; for now, output a CSV of unmapped codes for manual review).

**Acceptance criteria**
- [ ] Round-trips the CDISC LZZT test dataset (Lipid-Lowering Therapy Trial, public).
- [ ] Achilles summary passes on the resulting CDM.
- [ ] Unmapped-codes report attached as a run artifact.

**References:**
- CDISC SDTM IG.
- "Converting clinical trial data between CDISC SDTM and OMOP CDM" (2020).
- SHYFT/Medidata SDTM-OHDSI poster (2018) for the integration pattern with SynPUF.

---

### Phase 3 — Parthenon-only differentiators (Q4)

> **Goal:** The four templates that move Parthenon ahead of D2E. These are the commercial-buyer features and they justify the price premium.

#### T-021 · Template: `claims_to_omop` (X12 837/835, NCPDP)
**Effort:** L · **Status:** TODO · **Depends on:** T-001, T-005, T-008 · **Owner:** ETL — **split into 3 PRs**

**What to build**
- New nodes: `X12_837_Reader`, `X12_835_Reader`, `NCPDP_Reader`.
- Template that ingests medical claims (837), remits (835), and pharmacy claims (NCPDP) and projects to OMOP DRUG_EXPOSURE, PROCEDURE_OCCURRENCE, COST, CONDITION_OCCURRENCE, VISIT_OCCURRENCE.
- Use a battle-tested X12 parser (e.g., `pyx12` or `bots` — evaluate in PR-A; ADR required).

**Acceptance criteria**
- [ ] Ingests synthetic 837P/I/D and 835 fixtures (CMS-published examples).
- [ ] Cost projection (charged_amount, paid_amount, allowed_amount) populates COST table correctly.
- [ ] Throughput: 1M claims in <30 minutes on reference hardware.

**Why this matters:** D2E doesn't have this. Most Parthenon prospects (payers, integrated delivery networks, life-science RWE buyers) have claims data. This is the single largest commercial wedge.

---

#### T-022 · Template: `registry_to_omop` (NAACCR + STS + NCDR)
**Effort:** L · **Status:** TODO · **Depends on:** T-001, T-005 · **Owner:** ETL — **split into 3 PRs**

**What to build**
- Three sub-templates, one per registry, sharing a common `registry_base.yaml` partial:
  - **PR-A:** NAACCR (cancer registry). Builds on the OHDSI Oncology subgroup's existing NAACCR ETL — extend, don't fork.
  - **PR-B:** STS (Society of Thoracic Surgeons National Database).
  - **PR-C:** NCDR (National Cardiovascular Data Registry).
- Each template requires its registry-specific vocabulary load to have been run.

**Acceptance criteria**
- [ ] NAACCR template ingests a fixture EAV file and populates CONDITION_OCCURRENCE + EPISODE correctly.
- [ ] STS / NCDR templates pass against synthetic registry exports.
- [ ] All three pass DQD-equivalent post-conditions.

**Reference:** OHDSI Oncology subgroup NAACCR ETL.

---

#### T-023 · Template: `lis_lab_to_omop` (HL7 v2 ORU + LOINC harmonizer)
**Effort:** M · **Status:** TODO · **Depends on:** T-001, T-005, T-008 · **Owner:** ETL

**What to build**
- New node: `Hl7v2OruReader` — parses HL7 v2.x ORU^R01 (lab results) messages. Use `hl7apy` or `python-hl7`.
- Template projects lab results to OMOP MEASUREMENT.
- Built-in LOINC harmonizer: for unmapped local lab codes, suggests LOINC candidates using a combination of (a) string similarity, (b) LIS catalog metadata, and (c) AI-assisted mapping (handoff to T-024).

**Acceptance criteria**
- [ ] Ingests fixture HL7 v2 ORU messages and produces correct MEASUREMENT rows with valid LOINC concept_ids where mapping exists.
- [ ] Unmapped local codes flow into the AI-assisted mapping queue (T-024).
- [ ] LIS catalog format documented in `docs/templates/lis_lab_to_omop.md`.

---

#### T-024 · Template: `ai_assisted_mapping` (Llettuce-style)
**Effort:** L · **Status:** TODO · **Depends on:** T-016, T-008 · **Owner:** ML/ETL — **split into 2 PRs**

**What to build**
- New nodes: `ConceptMappingSuggesterNode`, `MappingReviewQueueNode`.
- Template:
  - **PR-A:** Backend — given a list of unmapped source codes/strings, produces ranked candidate OMOP concept_ids using Llettuce-style retrieval (embedding similarity on CONCEPT.concept_name + concept_synonym) plus optional LLM re-ranking.
  - **PR-B:** Front-end UI — batch review experience. Reviewer sees source code, top-N candidates, similarity scores, can approve / reject / edit / escalate. Approvals write to a Parthenon-namespaced mapping table that feeds back into all downstream templates.
- Audit trail: every approved mapping has reviewer ID, timestamp, model version, candidate ranking at time of decision.

**Acceptance criteria**
- [ ] On the SDO-2024 mapping benchmark (or equivalent published mapping eval), top-1 accuracy >60%, top-5 accuracy >85%.
- [ ] Reviewer UI lets a domain expert approve/reject 200 mappings in <30 minutes (timed user test).
- [ ] Approved mappings persist and are picked up automatically by re-runs of `lis_lab_to_omop`, `sdtm_to_omop_v54`, etc.

**Reference:** Llettuce paper (Reza et al., 2024); USAGI; OHDSI concept-mapping conventions.

**Why this matters:** Concept mapping is the single largest cost in OMOP ETL — published estimates put it at 40–60% of total ETL effort. Cutting that in half is a generational productivity gain and a Parthenon-native moat.

---

## 5. Cross-Cutting Concerns

### 5.1 Secrets management
- `.env.example` files at the package root list required env vars. Real `.env` is gitignored.
- Production: secrets manager (AWS Secrets Manager / Azure Key Vault / GCP Secret Manager) accessed through a thin Python adapter in `parthenon-nodes/src/parthenon_nodes/secrets.py`.
- Specific secrets that must NEVER be logged or persisted:
  - `UMLS_API_KEY` (CPT4)
  - `PHYSIONET_USERNAME` / `PHYSIONET_PASSWORD` (MIMIC)
  - `EUROQOL_LICENSE_KEY` (EQ-5D value sets, when applicable)
  - `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (LLM NER)

### 5.2 Logging and observability
- Structured logging (JSON) via `structlog`. No `print()` statements anywhere in `packages/`.
- Every node emits OpenTelemetry spans for: node start, db connection acquired, external call out, db connection released, node end.
- Prefect run metadata exported to the Parthenon catalog DB.

### 5.3 Storage
- Artifact storage adapter in `parthenon-orchestration` supports: S3, GCS, Azure Blob, local filesystem (for dev), MinIO (for on-prem).
- Adapter selected via env var `PARTHENON_STORAGE_BACKEND`.
- All artifact paths are scoped under `<backend>://<bucket>/parthenon/runs/<run-id>/<node-id>/<artifact-name>`.

### 5.4 OMOP CDM versioning
- Default target: v5.4. v5.3 also supported. v6.x explicitly deferred (community uptake too low to justify yet).
- Every template manifest declares its supported `cdm_versions`.
- The materializer rejects parameter combinations where a template doesn't support the configured CDM version.

### 5.5 Open-core split (per Workstream 4)
| Component | License | Tier |
|---|---|---|
| `parthenon-nodes`, `parthenon-cdm`, `parthenon-orchestration`, `parthenon-templates` | AGPLv3 | Community |
| Templates 1–14 (D2E parity slate) | AGPLv3 | Community |
| Templates 15–18 (claims, registry, LIS, AI-assisted mapping) | Commercial | Cloud / Enterprise |
| Validation & certification packs | Commercial | Enterprise |
| Enterprise auth/audit/RBAC extensions | Commercial | Enterprise |

This split is an architectural constraint, not just a license choice. Code in commercial templates **must not** be imported by community packages — enforced via CI lint that fails on disallowed imports.

### 5.6 Performance budgets
- Foundation tasks must not regress the existing Parthenon API p95 latency by more than 5%.
- Template execution: provide order-of-magnitude budgets per template in its README.
- Profile before optimizing. Rust additions only after Python profile shows a hot path.

---

## 6. Testing Strategy

### 6.1 Test pyramid
- **Unit:** every node, every parser, every projection function. Target >85% line coverage on `packages/`.
- **Integration:** node + orchestration adapter, manifest + materializer, template + storage adapter.
- **E2E:** every template runs against fixture sources to a postgres instance, post-conditions assert correctness. Lives in `tests/e2e/`.
- **Performance:** budget tests in CI for the L-effort templates (FHIR, SDTM, claims).

### 6.2 Fixtures
- `tests/fixtures/` is the single source of truth for test data.
- FHIR fixtures: small synthetic bundles (Synthea-derived, attribution in README).
- DICOM fixtures: 50 anonymized files across 3 modalities (MR, CT, US). Pixel data scrubbed, metadata representative.
- SDTM fixtures: CDISC LZZT public test dataset.
- Claims fixtures: CMS-published 837/835 examples.
- HL7 v2 fixtures: synthetic ORU^R01 messages.
- All fixtures must be redistributable — no PHI, no proprietary data.

### 6.3 CI matrix
- Python: 3.11, 3.12, 3.13.
- PostgreSQL: 14, 15, 16.
- OS: Ubuntu 22.04 (primary), macOS (smoke), Windows (smoke for CLI only).
- Prefect: 3.x latest minor.

### 6.4 Validation packs (per template)
Every template ships with a validation pack at `templates/<id>/validation/`:
- `inputs/` — small representative inputs.
- `expected/` — expected outputs (row counts, sentinel values, hash of the resulting CDM tables modulo timestamps).
- `dqd_checks.yaml` — DQD-equivalent checks the resulting CDM must pass.
- `README.md` — what the pack proves and what it doesn't.

These validation packs are also the substrate for Parthenon-Certified (Workstream 4) — third parties write templates, their validation packs prove correctness, certification is the assurance layer.

---

## 7. Documentation Requirements

For every template, ship:

1. **`templates/<id>/README.md`** — what it does, when to use it, parameters reference, prerequisites, examples, known limitations, license/attribution notes.
2. **`docs/templates/<id>.md`** — long-form authoring guide if the template is non-trivial. Includes data flow diagrams.
3. **Inline manifest comments** — every parameter has a `description`; every node in the manifest has a one-line comment.

For platform packages:
- Each package ships an `API.md` generated from docstrings (`pdoc` or `mkdocstrings`).
- Each ADR lives at `docs/adr/NNNN-title.md`.

For the developer portal:
- A "Build your first template" tutorial that takes a developer from zero to a custom template in ≤30 minutes.
- A "Build your first node" tutorial.
- An end-to-end concept guide explaining the three platform abstractions.

---

## 8. Definition of Done (per template)

A template is DONE when **all** of the following are true:

- [ ] Manifest validates against the v1 schema.
- [ ] Template appears in the UI dropdown and renders a working parameter form.
- [ ] E2E test runs the template against a fixture source on a clean Postgres instance and post-conditions pass.
- [ ] Validation pack present at `templates/<id>/validation/` with non-trivial checks.
- [ ] README at `templates/<id>/README.md` covers what it does, when to use it, parameters, prerequisites, examples, limitations, license notes.
- [ ] Performance budget documented in the README and verified by a CI test for L-effort templates.
- [ ] All cross-cutting concerns honored: no plaintext secrets, structured logs, OTel spans, correct storage adapter use.
- [ ] License/tier assignment correct (community vs commercial) and CI lint passes.
- [ ] If the template adds new vocabulary requirements, the corresponding vocabulary loader is referenced (or built) in the same PR.
- [ ] Reviewed and approved by at least one ETL engineer + one platform engineer.

---

## 9. Open Questions for Human Review

> **Claude Code: do not invent answers to these. Surface them in the relevant PR descriptions and tag the right human owner.**

1. **Repo layout.** Is the §2 layout correct? In particular, is `apps/ingestion-ui/` a new app or a route inside `apps/web/`?
2. **Python tooling.** `uv` workspace vs `poetry` with path dependencies — strong opinion or open?
3. **Orchestration default.** Locked to Prefect 3.x, or should the design spike T-002 evaluate Temporal more seriously given the enterprise traction?
4. **Front-end framework alignment.** Is the existing Parthenon web app on Next.js, plain React, or something else? T-004 Storybook setup depends on this.
5. **R packaging.** Is `renv` the right tool, or does the existing R footprint use a different convention?
6. **Storage adapter contract.** Does Parthenon already have a storage abstraction? If yes, extend it; if no, T-002 owns building it.
7. **OMOP CDM v6.x.** Plan defers it. Confirm this is acceptable given any current customer asks.
8. **EuroQol licensing.** Confirm that shipping the EQ-5D mapping logic (without the value set) is consistent with EuroQol terms.
9. **PhysioNet credentialing.** How do we want customers to provide MIMIC credentials — at template-run time, at workspace-config time, or via a one-time workspace setup?
10. **AI-assisted mapping evaluation set.** Which benchmark set should T-024 PR-A be evaluated against? SDO-2024 is the placeholder; confirm.
11. **Claims data parser license.** `pyx12` is BSD; `bots` is GPL. T-021 PR-A ADR will recommend; please confirm GPL-incompatibility constraints (the AGPLv3 community tier is fine with GPL deps; the commercial tier is not).
12. **AGPLv3 vs Apache 2.0 vs BSL.** The Workstream 4 doc mentions AGPLv3; confirm this is final for community-tier code.
13. **Monorepo CI compute.** What's the budget? The Prefect-runs-against-real-Postgres tests are not free.
14. **D2E template content reuse.** D2E is open source under OHDSI. We should review their template manifests for ideas (and credit them in our READMEs where we adopt patterns). Confirm this is the right approach vs clean-room.

---

## 10. Reference Material

### 10.1 D2E (the benchmark)
- D2E homepage: https://data2evidence.org/
- D2E GitHub: https://github.com/OHDSI/Data2Evidence
- D2E Prefect-artifacts PR (architectural reference): https://github.com/OHDSI/d2e/pull/237
- Data4Life open-source announcement (April 2025): https://www.data4life.care/en/press/data2evidence-as-open-source/

### 10.2 OHDSI / OMOP CDM
- OMOP CDM v5.4: https://ohdsi.github.io/CommonDataModel/cdm54.html
- OHDSI Athena (vocabulary): https://athena.ohdsi.org/
- DQD (Data Quality Dashboard): https://github.com/OHDSI/DataQualityDashboard
- Achilles: https://github.com/OHDSI/Achilles

### 10.3 Source-format references
- HL7 FHIR-OMOP IG: https://github.com/HL7/fhir-omop-ig
- ETL-German-FHIR-Core: https://github.com/OHDSI/ETL-German-FHIR-Core
- NACHC fhir-to-omop: https://github.com/NACHC-CAD/fhir-to-omop
- DICOM2OMOP (JAMIA reference): https://github.com/paulnagy/DICOM2OMOP
- Nagy et al., JAMIA 2025 (DICOM-OMOP): https://academic.oup.com/jamia/article/32/10/1533/8206314
- MIMIC-OMOP: https://github.com/MIT-LCP/mimic-omop
- ETL-CMS (SynPUF): https://github.com/OHDSI/ETL-CMS
- OHDSI/ARTEMIS (chemo regimens): https://github.com/OHDSI/ARTEMIS
- HemOnc.org: https://hemonc.org/
- CDISC SDTM: https://www.cdisc.org/standards/foundational/sdtm

### 10.4 Tooling
- Prefect 3.x: https://docs.prefect.io/3.0/
- pyomop: https://github.com/dermatologist/pyomop
- pydicom: https://pydicom.github.io/
- fhir.resources: https://github.com/nazrulworld/fhir.resources
- SciSpaCy: https://allenai.github.io/scispacy/
- Llettuce: https://arxiv.org/abs/2410.09076
- pyx12 (claims): https://github.com/azoner/pyx12

### 10.5 Internal Parthenon documents
- `Parthenon_Ingestion_Patterns_Memo.docx` — the strategic memo this plan implements.
- Workstream 4 (Open-Source Commercialization) — for license/tier decisions.
- Workstream 1 (Numbers) — for any market-sizing-related framing.

---

*End of plan. Last updated by Claude Sonnet on May 2, 2026. When in doubt, ship the smallest correct thing, write the ADR, and surface the open question.*
