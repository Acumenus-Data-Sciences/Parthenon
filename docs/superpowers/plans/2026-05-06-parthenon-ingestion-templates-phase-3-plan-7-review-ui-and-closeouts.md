# Parthenon Ingestion Templates — Phase 3, Plan 7: T-024B Review UI + Phase 2 Closeouts

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **GATE 2 — second wave** (per Phase 3 spec §2): This plan is the second ML/UX-novel work. Frontend acceptance gate is qualitative ("domain expert reviews 200 mappings in <30 minutes"); requires a timed user test. Pause for user check-in before opening the PR.

**Goal:** Closes Phase 3. Lands three deliverables in one plan:

1. **T-024B** — concept-mapping reviewer UI in the React shell (Phase 3 Q8=(a)).
2. **Phase 2 carry-over** — full ARTEMIS R-package install via multi-stage Dockerfile (Q11=(c)). Replaces the v0.1 hand-curated 5-regimen library with the full ~600-regimen ARTEMIS export.
3. **Phase 2 carry-over** — Llettuce graduation decision (Q9=(b)). Re-runs Llettuce against Plan 6's curated 3k-pair benchmark; applies ADR 0013's +5 pp SNOMED concept_match_rate threshold; ships `parthenon_ner_llettuce` only if Llettuce graduates.

**Architecture:**

- **Review UI** (`frontend/src/features/mapping-review/`) — React + TypeScript component tree mounted at `/admin/mapping-review`. Pages: `MappingReviewQueuePage` (paginated unmapped-code queue), `MappingReviewDetailPage` (single source code with top-5 candidates, similarity bars, source examples). Approve/reject/edit/escalate buttons. Backend hits `MappingReviewQueueNode` from Plan 6. Acceptance: timed user test with a domain expert reviewing 200 mappings in <30 min.
- **ARTEMIS R-install** — multi-stage Dockerfile in `templates/Dockerfile`. Stage 1 installs R + ARTEMIS package, runs the extraction script, materializes `templates/runtime/oncology/artemis/v0.2.0/patterns.json` with all ~600 regimens. Stage 2 (the runtime image) copies only the JSON forward; no R in the final image (preserves Phase 2 ADR 0014's "runtime stays pure Python" promise).
- **Llettuce graduation** — re-runs the Phase 2 `ner-eval` harness against Plan 6's `seen.csv` benchmark; if `llettuce.snomed_concept_match_rate - scispacy.snomed_concept_match_rate >= 0.05`, ship `parthenon_ner_llettuce` (mirror of `parthenon_ner_scispacy` shape). Else document the rejection in an ADR amendment.

**Tech Stack:** React 19, TypeScript strict, TanStack Query (already in stack); Docker multi-stage; R 4.4 (build-time only).

**Depends on:**
- Phase 3 Plan 6 (T-024A backend merged) — UI calls into Plan 6's `MappingReviewQueueNode`.
- Phase 2 PRs #275 (ARTEMIS v0.1) + #276 (Llettuce eval harness) merged.

**Unblocks:** Phase 3 complete after this plan ships.

---

## Conventions

- Backend conventions same as prior plans.
- **Frontend conventions:** TypeScript strict; no `any` (use `unknown` and narrow); named exports only; TanStack Query hooks for API calls; Zustand for UI state; Tailwind v4 + dark clinical theme (#0E0E11 / #9B1B30 / #C9A227 / #2DD4BF).
- Branch: `feature/phase-3-plan-7-review-ui-and-closeouts`.
- Type names: `MappingReviewQueuePage`, `MappingReviewDetailPage`, `useMappingQueue`, `useMappingApprove`.

---

## Task index (18 tasks)

### Section A — Concept-mapping reviewer UI (T-024B, ~12 tasks)

1. Backend API endpoints — list queue, get detail, approve, reject, escalate
2. Backend Form Requests + RBAC middleware
3. Backend OpenAPI spec annotations
4. Backend pest test suite — endpoint behaviors + RBAC enforcement
5. Frontend route registration (`/admin/mapping-review`)
6. `useMappingQueue` TanStack Query hook
7. `MappingReviewQueuePage` — paginated table with severity / source-vocab filters
8. `MappingReviewDetailPage` — source code + top-5 candidates with similarity bars
9. Keyboard shortcuts: J/K row nav; A approve; R reject; E escalate; / search
10. Vitest unit tests + zustand store tests
11. Playwright E2E: domain-expert flow (queue → detail → approve → next)
12. Timed user test: domain expert reviews 200 mappings, measure wall-clock time

### Section B — ARTEMIS full R-install (Phase 2 carry-over, ~3 tasks)

13. Multi-stage Dockerfile — build stage installs R + ARTEMIS, runs extractor
14. Extractor script `tools/extract_artemis_regimens.R`
15. Validate v0.2.0 library shape — schema-equivalence with v0.1 + count assertions

### Section C — Llettuce graduation decision (Phase 2 carry-over, ~3 tasks)

16. Re-run `ner-eval` against Plan 6's `seen.csv` benchmark
17. Apply +5 pp SNOMED threshold; produce graduation verdict
18. If GRADUATE — ship `parthenon_ner_llettuce` template; if HOLD — amend ADR 0013

---

## Section A — Concept-mapping reviewer UI (12 tasks)

### Task 1: Backend API endpoints

Routes (under `auth:sanctum` + `permission:mapping.review`):
- `GET /api/v1/mapping-review/queue` — paginated queue
- `GET /api/v1/mapping-review/{queue_id}` — single source code with candidates
- `POST /api/v1/mapping-review/{queue_id}/approve` — accept a candidate
- `POST /api/v1/mapping-review/{queue_id}/reject` — reject all candidates
- `POST /api/v1/mapping-review/{queue_id}/escalate` — flag for senior reviewer

Controller delegates writes to `MappingReviewQueueNode` from Plan 6. **Commit:** `feat(backend): mapping-review API endpoints`.

### Task 2: Form Requests + RBAC

`ApproveMappingRequest` validates: `concept_id` exists in `vocab.concept` with `standard_concept = 'S'`; `confidence` is `0.0..1.0`. Middleware: `permission:mapping.review` for read; `permission:mapping.approve` for writes. Permissions seeded via the existing `RolePermissionSeeder`. **Commit:** `feat(backend): Form Requests + RBAC for mapping review`.

### Task 3: OpenAPI

Annotate routes per the existing Scribe convention; types regenerate into `frontend/src/types/api.generated.ts`. **Commit:** `feat(backend): OpenAPI annotations for mapping-review endpoints`.

### Task 4: Pest tests

Covers: list with pagination, detail by id, approve writes to `parthenon_concept_map`, reject preserves queue row with status, escalate sets `escalated_at`, RBAC denies viewer-role users. **Commit:** `test(backend): mapping-review API pest suite`.

### Task 5: Frontend route

`frontend/src/features/mapping-review/routes.tsx` registers under the admin route group. **Commit:** `feat(frontend): /admin/mapping-review route registration`.

### Task 6: TanStack Query hooks

`useMappingQueue(filters)`, `useMappingDetail(id)`, `useApproveMapping()`, `useRejectMapping()`, `useEscalateMapping()`. Type-safe via `api.generated.ts`. **Commit:** `feat(frontend): mapping-review TanStack Query hooks`.

### Task 7: Queue page

Paginated dark-themed table; filters by source_vocab, sort by confidence/age/seen_count. URL-driven state for shareable filters. **Commit:** `feat(frontend): MappingReviewQueuePage`.

### Task 8: Detail page

Two-column layout: source code + occurrences (left); top-5 candidates with concept_name, vocabulary, similarity bars, "Maps to" hierarchy preview (right). **Commit:** `feat(frontend): MappingReviewDetailPage`.

### Task 9: Keyboard shortcuts

`J/K` next/prev row; `A` approve highlighted candidate; `R` reject all; `E` escalate; `/` search. Implemented via a small `useKeyboardShortcuts` hook. Discoverable via `?` overlay. **Commit:** `feat(frontend): mapping-review keyboard shortcuts`.

### Task 10: Vitest tests

Component render tests, hook tests, store tests. Coverage ≥80%. **Commit:** `test(frontend): mapping-review unit tests`.

### Task 11: Playwright E2E

Critical-path flow: login as `mapping-reviewer` → queue → detail → approve → next item. **Commit:** `test(e2e): mapping-review critical path`.

### Task 12: Timed user test

Run with one domain expert reviewing 200 real-shape mappings. Record wall-clock time. **Acceptance gate per devplan T-024:** must be <30 min. If fails, iterate on UX before opening the PR. **Commit:** `test(uat): mapping-review 200-mapping timed user test (results in PR description)`.

---

## Section B — ARTEMIS R-install (3 tasks)

### Task 13: Multi-stage Dockerfile

Modify `templates/Dockerfile`:

```dockerfile
# Stage 1 — R + ARTEMIS extraction (build-time only)
FROM r-base:4.4 AS artemis-build
WORKDIR /build
RUN R -e "install.packages('remotes', repos='https://cloud.r-project.org')" && \
    R -e "remotes::install_github('HemOnc-org/HemOnc@<PINNED_SHA>')"
COPY tools/extract_artemis_regimens.R .
RUN Rscript extract_artemis_regimens.R --output /build/patterns.json

# Stage 2 — runtime (Python only, no R)
FROM python:3.12-slim AS runtime
# ... existing runtime setup ...
COPY --from=artemis-build /build/patterns.json \
     /app/runtime/oncology/artemis/v0.2.0/patterns.json
```

Pin a HemOnc commit SHA in `templates/runtime/oncology/artemis/ohdsi_pin.txt`. **Commit:** `feat(templates): multi-stage ARTEMIS R-install (full ~600-regimen library, v0.2.0)`.

### Task 14: Extractor R script

`tools/extract_artemis_regimens.R` — loads the ARTEMIS R-package, extracts the regimen + drug-set + indication tables, normalizes RxNorm concept_ids, writes JSON matching the v0.1.0 schema. **Commit:** `feat(templates): ARTEMIS extractor R script`.

### Task 15: Validate v0.2.0 shape

Test asserts:
- v0.2.0 `patterns.json` parses against the same Pydantic schema as v0.1.0
- ≥500 regimens (sanity floor; full library is ~600 but upstream count varies)
- All v0.1.0 regimens (FOLFIRINOX, FOLFOX, R-CHOP, AC-T, Carboplatin+Paclitaxel) still present

Update `runtime/oncology/matcher.py::load_pattern_library` default version to `v0.2.0`. **Commit:** `feat(templates): bump ARTEMIS pattern library to v0.2.0 (full ~600 regimens)`.

---

## Section C — Llettuce graduation (3 tasks)

### Task 16: Re-run eval

Add `tests/eval/test_llettuce_graduation_against_curated_benchmark.py` — runs Plan 2 SciSpaCy + Plan 3 Llettuce backends through Plan 6's `seen.csv` benchmark; produces a markdown report with per-vocabulary `concept_match_rate`. Gated under `pytest -m mapping_eval`. **Commit:** `feat(templates): Llettuce graduation eval against curated benchmark`.

### Task 17: Apply threshold

Decision logic: `let_snomed - sci_snomed >= 0.05` → GRADUATE; else HOLD. Output to `_eval/llettuce_graduation_verdict.md`. CI uploads as 90-day artifact. **Commit:** `feat(templates): apply +5 pp SNOMED graduation threshold`.

### Task 18: Verdict

**Branch A — GRADUATE:** Ship `parthenon_ner_llettuce` template (mirrors `parthenon_ner_scispacy` shape). Update Phase 2 ADR 0013 status from "Eval-only" to "Graduated to production". Add the new template's NODE_TYPES + schema entry. Frontend NER backend dropdown gains "Llettuce" option.

**Branch B — HOLD:** Amend Phase 2 ADR 0013 with the verdict and rationale. Document why Llettuce didn't clear the threshold (most likely: bge-base + LLM-rerank from Plan 6 already covers Llettuce's strength). Mark T-024 as the canonical concept-mapping path; Llettuce stays an eval-only artifact for prompt-drift detection.

The verdict is data-driven; this plan ships whichever branch the eval produces. **Commit (one of):** `feat(templates): graduate Llettuce to production (parthenon_ner_llettuce)` OR `docs(adr): ADR 0013 — Llettuce HOLD verdict + Phase 4 reconsideration`.

---

## Done

After Task 18, Phase 3 is complete:
- 4 commercial-tier templates shipped (T-021 claims, T-022 registries, T-023 lab, T-024 mapping).
- Concept-mapping reviewer UI lives at `/admin/mapping-review`.
- ARTEMIS full library replaces the v0.1 hand-curated subset.
- Llettuce graduation decision settled with a public artifact.

**Pre-PR check-in:** Per Phase 3 spec §2 Gate 2, surface results from Section A's timed user test + Section C's Llettuce verdict before opening the PR.
