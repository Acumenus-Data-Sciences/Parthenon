---
slug: v1-0-4-test-coverage-ci-hardening
title: "Parthenon v1.0.4 — Test Coverage & CI Hardening"
description: "First stabilization release in the v1.0.x arc — no new features, only refinement. Closes every test coverage gap identified at v1.0.3 launch and hardens the CI pipeline."
authors: [mudoshi]
tags: [release, testing, ci, quality]
date: 2026-04-09
---

## v1.0.4 — Test Coverage & CI Hardening

v1.0.4 is the first stabilization release in the v1.0.x arc. **No new features** —
only refinement of what exists. This release fills the test coverage gaps
identified during the v1.0.3 launch and hardens the CI pipeline so every
subsequent release starts from a trustworthy baseline.

<!--truncate-->

### Why stabilization matters

v1.0.3 landed fast. It shipped the installer rewrite, Poseidon + Vulcan,
Standard PROs+, Risk Scores v2, the Commons wiki ChromaDB refactor, the
Acropolis enterprise installer, Hecate semantic search, and a dozen other
modules. By the time the dust settled, the test suite had drifted: 74 PHP
test files and 37 Playwright E2E specs covered the older surfaces, but the
newer modules had thin unit coverage, zero Vitest tests on the frontend, and
several "contract" tests for inter-service communication had been scheduled
but never written.

v1.0.4 is the release that pays that debt. Every scope item listed in
`ROADMAP.md` v1.0.4 is now either shipped or explicitly deferred with a
rationale.

### Backend test coverage

- **Pest service tests** for Achilles, DQD, Cohort, and Analysis services
  (shipped in commit `4b3a77c`)
- **8 database connection integration tests** — one per Laravel connection,
  each verifying its `search_path` resolves the correct schemas for clinical
  data, vocabulary, and results (commit `4b3a77c`)
- **RBAC enforcement tests** on every route group (auth, research, admin,
  data pipeline) — these verify that removing a permission actually breaks
  the corresponding endpoint (commit `39cfe57`)
- **OpenAPI spec drift detection** in CI — generated TypeScript types are now
  verified against live API responses so the frontend never diverges from the
  backend (commit `4b3a77c`)
- **R Plumber contract tests** — a new `DarkstarContractTest.php` hits the
  `darkstar` service `/health` endpoint via `config('services.darkstar.url')`,
  asserting the response shape: `status`, `service=darkstar`, semver `version`,
  the `checks.{packages,jvm,memory_ok,jdbc_driver}` dict, and non-empty
  `packages.ohdsi` metadata. The test gracefully skips when darkstar is not
  running so CI stays green in environments that don't deploy the R sidecar.
- **Python AI contract tests** — a matching `AiServiceContractTest.php` hits
  the `python-ai` service `/health` endpoint via `config('services.ai.url')`,
  asserting `service=parthenon-ai`, `llm.provider=ollama`, and non-empty
  model/base_url. Same graceful-skip fallback.
- **PHPUnit/Pest runtime detection** for local test isolation (commit
  `5a5ff2cd9`) — fixes a regression where Redis-backed middleware poisoned
  the test database transaction.

### Python AI test coverage

Three new FastAPI TestClient contract tests land in `ai/tests/`:

- `test_abby_router_contract.py` — covers `/abby/parse-cohort` with a mocked
  `call_ollama` function. Verifies the full `CohortParseResponse` shape, the
  422 validation errors on missing and short prompts, and the fallback shape
  when the LLM returns unparseable output.
- `test_embeddings_router_contract.py` — covers `/embeddings/encode` and
  `/embeddings/encode-batch` with a mocked SapBERT service. Verifies the
  `{embedding, model}` and `{embeddings, model, count}` response contracts
  plus the 422/400 validation guards.
- `test_concept_mapping_router_contract.py` — covers `/concept-mapping/map-term`
  and `/concept-mapping/map-batch` with every strategy singleton (exact,
  cache, SapBERT, LLM, ranker) patched. Verifies the `RankedCandidate` shape
  and the `{results, total_time_ms, strategies_used}` batch response.

All Python contract tests mock every external dependency (Ollama, SapBERT,
pgvector, ChromaDB) so they need no network and no model weights.

### Frontend test coverage

Vitest + React Testing Library + jsdom infrastructure was already landed in
`vite.config.ts` during v1.0.3. v1.0.4 populates it:

- **66 pre-existing frontend test files** covering estimation, prediction,
  SCCS, analyses, evidence synthesis, data-explorer, publish, auth,
  vocabulary, patient similarity, ingestion, and more.
- **7 new cohort builder component tests** — `CohortExpressionEditor`,
  `CriteriaGroupEditor`, `DomainCriteriaSelector`, `ConceptSetPicker`,
  `CohortStatsBar`, `CohortGenerationPanel`, and `CohortSqlPreview`. Together
  they exercise the store-backed top-level editor, the nested criteria group
  depth guard, the seven OMOP domain buttons, the concept set creation flow,
  the stats bar interaction, and the generation/SQL preview TanStack Query
  states. 33 tests total.
- **5 new concept set editor component tests** — `ConceptSetEditor`,
  `ConceptSetItemRow`, `ConceptSetItemDetailExpander`, `ConceptSetStatsBar`,
  `PhoebeRecommendationsPanel`. These cover the empty state, row rendering,
  the three toggle switches (`includeDescendants`, `isExcluded`,
  `includeMapped`), the four-tab detail expander, and the Phoebe
  recommendations accept flow. 26 tests total.
- **10 dark clinical theme snapshot tests** — `Badge`, `Button`, `StatusDot`,
  `EmptyState`, `MetricCard`, `Panel`, `Tabs`, `Progress`, `FilterChip`, and
  `FormInput`. Each file uses `toMatchInlineSnapshot()` plus a regex
  assertion for the theme token (e.g. `btn-primary`, `badge-critical`,
  `form-input error`). The goal is to fail loudly when someone renames a
  class, removes a variant, or accidentally swaps the `#9B1B30` crimson for
  a different red. 33 snapshots total.

### Analysis stores — scope clarification

The v1.0.4 scope called for "unit tests for all Zustand stores (authStore,
cohort stores, analysis stores)." Here is the actual status:

- `authStore`, `abbyStore`, and `wikiStore` already have Vitest unit tests
  (landed during the wiki UX cleanup work).
- `cohortExpressionStore` already has a Vitest unit test for
  `normalizeCohortExpression`.
- **There is no `analysisStore`.** The `frontend/src/features/analyses/`
  module uses TanStack Query (`useIncidenceRates`, `useCharacterizations`,
  `useEstimations`, `usePatientLevelPredictions`, etc.) exclusively — all
  analysis state lives in the server cache, not in client-side Zustand
  stores.

This scope item is therefore **N/A by design**. TanStack Query is the
analysis feature's state layer, and it is already tested through the
feature-level component tests and the OpenAPI drift detection.

### CI/CD hardening

- **Pre-commit hook** now runs Pint + PHPStan + tsc + ESLint + Vitest on
  every commit. A silent bug in the hook's ESLint invocation — newline
  separators leaking into a `sh -c` command, causing staged files after the
  first to be interpreted as shell commands — was fixed as a side effect
  of this release.
- **Chroma ingestion mypy types** fixed (commit `58a8910a4`).
- **GitHub Actions pipeline**: lint → test → build → deploy gate. OpenAPI
  drift detection runs on every PR.

### Not yet shipped in v1.0.4 (deferred to v1.0.5+)

- **Playwright cross-browser validation** (Chromium, Firefox, WebKit).
- **Playwright E2E coverage** for GIS Explorer, imaging viewer, and
  genomics workflows.

These are tracked in the v1.0.5 section of `ROADMAP.md`.

### Upgrade notes

No migrations, no config changes, no breaking API changes. This is pure
test coverage and CI hardening — `git pull && ./deploy.sh` is sufficient.
New test files are picked up automatically by Vitest, Pest, and pytest
discovery.

### By the numbers

- **New backend tests:** 6 Pest contract tests
- **New Python AI tests:** 11 FastAPI TestClient contract tests
- **New frontend component tests:** 33 cohort builder + 26 concept set
- **New snapshot tests:** 33 across 10 UI primitives
- **Total new tests landed in v1.0.4:** 109

### Contributors

Claude Code + @sudoshi
