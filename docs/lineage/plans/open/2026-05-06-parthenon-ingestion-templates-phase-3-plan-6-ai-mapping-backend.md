# Parthenon Ingestion Templates — Phase 3, Plan 6: T-024A — `ai_assisted_mapping` Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **GATE 2 (per Phase 3 spec §2):** This plan is the first ML-novel work in Phase 3. The +5 pp graduation criterion + 60% top-1 / 85% top-5 acceptance gates can miss on first attempt. Pause for user check-in before opening the PR for this plan.

**Goal:** Lands the AI-assisted concept-mapping backend — `ConceptMappingSuggesterNode` (retrieval + LLM rerank) and `MappingReviewQueueNode` (writes approved mappings to a Parthenon-namespaced mapping table). Commercial-tier per Phase 3 spec §2 + Q1=(b′). Uses `BAAI/bge-base-en-v1.5` embeddings (Q5=(a)) + the LLM backend from Phase 2 Plan 1 for re-ranking. Acceptance benchmark is curated from `vocab.concept_relationship 'Maps to'` (Q4=(c)).

**Architecture:** Two-stage retrieval-then-rerank pipeline:

1. **Retrieve** — given an unmapped source code + text, embed via `BAAI/bge-base-en-v1.5` (768-dim), search pgvector index over CONCEPT.concept_name + concept_synonym embeddings, return top-50 candidates.
2. **Rerank** — feed top-50 candidates + source text to the LLM via the existing Phase 2 NlpBackend (`LlmBackend` with the `concept-rerank` prompt template), receive ranked top-5 with confidence scores.

`ConceptMappingSuggesterNode` runs the pipeline; `MappingReviewQueueNode` writes accepted suggestions to `${app_schema}.parthenon_concept_map` (the mapping table that downstream templates read). Backend is fully usable headless; the UI in Plan 7 sits on top of these nodes.

**Tech Stack:**
- Python 3.12, pgvector (already pinned in Phase 1).
- New deps: `sentence-transformers==3.3.1` (Apache-2.0) for the bge-base loader; `torch==2.5.1` (BSD).
- Reuses: Phase 2 LlmBackend, `vocab.concept` + `concept_synonym` tables.

**Depends on:**
- Phase 3 Plan 5 (`unmapped_local_lab_code` queue exists; suggester reads from it as one of multiple sources).
- Phase 3 Plan 1 (commercial-tier wheel scaffolding).

**Unblocks:**
- Plan 7 (T-024B) — review UI sits on top of these nodes.

---

## Conventions

Same as prior plans. Branch: `feature/phase-3-plan-6-ai-mapping`. Type names: `ConceptMappingSuggesterNode`, `MappingReviewQueueNode`, `ConceptCandidate`, `RerankResult`, `BgeEmbedder`, `MappingBenchmark`.

**HIGHSEC compliance:** All free-text fields fed to the LLM go through the existing PHI-redaction layer from Phase 2. `parthenon_concept_map` writes are audited per HIGHSEC §1.1 (`mapping-reviewer` role required).

---

## Task index (16 tasks)

1. Pin `sentence-transformers==3.3.1` + `torch==2.5.1` (commercial wheel only)
2. `BgeEmbedder` — wraps sentence-transformers; lazy-loads bge-base-en-v1.5
3. `ConceptCandidate` + `RerankResult` typed Pydantic models
4. pgvector schema migration — `vocab.concept_embedding_bge` (concept_id, embedding vector(768))
5. Concept-embedding ingest job — embeds CONCEPT.concept_name + concept_synonym for the standard concept set; idempotent re-runs
6. `ConceptRetriever` — pgvector top-K search wrapper
7. `concept-rerank` prompt template (`templates/runtime/nlp/prompts/v0.1.0/concept_rerank.md`)
8. LLM rerank glue — calls Phase 2 LlmBackend with `concept-rerank` prompt
9. `ConceptMappingSuggesterNode` orchestration node
10. `parthenon_concept_map` schema migration (`(source_code, source_vocab, omop_concept_id, confidence, reviewer_id, reviewed_at, model_version, candidate_ranking_json)`)
11. `MappingReviewQueueNode` — writes approved mappings + audit row
12. Mapping benchmark curation — `vocab.concept_relationship 'Maps to'` → 3k blind/seen pairs
13. Acceptance E2E — top-1 ≥60%, top-5 ≥85% on the curated benchmark
14. Three-place node-type registration (NODE_TYPES, schema enum, NODE_REGISTRY)
15. HIGHSEC §1.1 RBAC — `mapping-reviewer` role gate on writes
16. ADR 0019 — concept-mapping retrieval+rerank architecture

---

## Task 1: Pin dependencies

Add `sentence-transformers==3.3.1` + `torch==2.5.1` to `templates/commercial/pyproject.toml`. Document the disk footprint (~2 GB with bge-base weights) — this is why the commercial wheel is the only place these deps live. **Commit:** `chore(templates/commercial): pin sentence-transformers + torch for bge-base embeddings`.

---

## Task 2: `BgeEmbedder`

```python
class BgeEmbedder:
    def __init__(self, model_name: str = "BAAI/bge-base-en-v1.5") -> None:
        self._model_name = model_name
        self._model: SentenceTransformer | None = None  # lazy

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
        return self._model.encode(texts, normalize_embeddings=True).tolist()
```

Tests use a tiny mock (no real model load) to assert the interface. **Commit:** `feat(templates/commercial): BgeEmbedder lazy loader`.

---

## Task 3: Typed candidate + rerank models

```python
class ConceptCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    concept_id: int
    concept_name: str
    vocabulary_id: str
    domain_id: str
    standard_concept: str  # 'S', 'C', or null
    similarity: float = Field(ge=0.0, le=1.0)


class RerankResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    source_text: str
    source_code: str
    source_vocab: str
    candidates: list[ConceptCandidate]  # ranked top-N
    rerank_model: str
    confidence: float = Field(ge=0.0, le=1.0)
```

**Commit:** `feat(templates/commercial): ConceptCandidate + RerankResult types`.

---

## Task 4: pgvector schema

Migration (in commercial-tier SQL): `vocab.concept_embedding_bge (concept_id BIGINT PRIMARY KEY, embedding vector(768) NOT NULL)`. Indexed via `ivfflat (embedding vector_cosine_ops) WITH (lists = 200)`.

**Commit:** `feat(templates/commercial): vocab.concept_embedding_bge pgvector schema`.

---

## Task 5: Concept embedding ingest

Job: `python -m runtime.commercial.mapping.ingest_embeddings --vocabulary SNOMED RxNorm LOINC ATC HCPCS`. Iterates standard concepts in batches of 1024, embeds via BgeEmbedder, INSERTs ON CONFLICT (concept_id) DO UPDATE. Idempotent. Throughput target: 1M concepts in <1 hour on a single A10 GPU; CPU-only fallback documented.

**Commit:** `feat(templates/commercial): concept embedding ingest job`.

---

## Task 6: `ConceptRetriever`

```python
class ConceptRetriever:
    def search(self, query_embedding: list[float], top_k: int = 50,
               domain_filter: str | None = None) -> list[ConceptCandidate]:
        # SELECT concept_id, concept_name, vocabulary_id, domain_id, standard_concept,
        #   1 - (embedding <=> $1) AS similarity
        # FROM vocab.concept_embedding_bge e JOIN vocab.concept c USING (concept_id)
        # WHERE c.standard_concept = 'S' AND ($2::text IS NULL OR c.domain_id = $2)
        # ORDER BY embedding <=> $1
        # LIMIT $3
        ...
```

**Commit:** `feat(templates/commercial): ConceptRetriever pgvector top-K search`.

---

## Task 7: Rerank prompt

`templates/runtime/nlp/prompts/v0.1.0/concept_rerank.md` — system prompt + few-shot examples for ranking concept candidates. Mirrors the Phase 2 NER prompt-versioning convention. **Commit:** `feat(templates): concept-rerank prompt v0.1.0`.

---

## Task 8: LLM rerank glue

`ConceptReranker` class wraps the Phase 2 LlmBackend; takes (source_text, top-K candidates), returns ranked top-5 + confidence. Gracefully degrades when LLM is unavailable: returns the retriever's top-5 unchanged with `confidence = retriever_similarity * 0.7` discount. **Commit:** `feat(templates/commercial): ConceptReranker via Phase 2 LlmBackend`.

---

## Task 9: `ConceptMappingSuggesterNode`

Orchestration node. Reads from one or more queues (`unmapped_local_lab_code`, `unmapped_ndc`, `unmapped_icdo3`), runs each unmapped row through retrieve → rerank, writes `RerankResult` artifacts. **Commit:** `feat(templates/commercial): ConceptMappingSuggesterNode orchestration`.

---

## Task 10: `parthenon_concept_map` schema

App-tier table:
```sql
CREATE TABLE app.parthenon_concept_map (
    map_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_code TEXT NOT NULL,
    source_vocab TEXT NOT NULL,
    source_text TEXT,
    omop_concept_id BIGINT NOT NULL REFERENCES vocab.concept(concept_id),
    confidence NUMERIC(5,4) NOT NULL,
    reviewer_id BIGINT REFERENCES app.users(id),  -- NULL if auto-approved
    reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    model_version TEXT NOT NULL,
    candidate_ranking_json JSONB NOT NULL,
    UNIQUE (source_code, source_vocab)
);
```

Migration via Laravel's existing migration runner (cross-tier touch — schema lives in `app.*` so backend code can read it). **Commit:** `feat(backend): parthenon_concept_map schema (app.*)`.

---

## Task 11: `MappingReviewQueueNode`

Writes reviewer-approved mappings to `parthenon_concept_map`. Validates: `omop_concept_id` exists in `vocab.concept` with `standard_concept = 'S'`; `reviewer_id` has `mapping-reviewer` role; entry doesn't already exist (UNIQUE constraint catches; node raises `MappingAlreadyExistsError` with the existing row's metadata).

**Commit:** `feat(templates/commercial): MappingReviewQueueNode + RBAC validation`.

---

## Task 12: Benchmark curation

Script: `scripts/curate_mapping_benchmark.py`. Pulls 3k pairs from `vocab.concept_relationship` where `relationship_id = 'Maps to'`, filters to standard concept targets, splits into "seen" (source_vocab in the model's training corpus) and "blind" (source_vocab held out) sets. Deterministic seed. Output: `templates/commercial/runtime/commercial/mapping/benchmark/v0.1.0/{seen,blind}.csv` (2400 + 600 rows). **Commit:** `feat(templates/commercial): mapping benchmark curation (3k pairs)`.

---

## Task 13: Acceptance E2E

`tests/e2e/commercial/test_concept_mapping_acceptance.py` runs the full retrieve → rerank pipeline against the curated benchmark and asserts:
- top-1 ≥ 60% on `seen.csv`
- top-5 ≥ 85% on `seen.csv`
- top-1 ≥ 50% on `blind.csv` (held-out vocabularies; lower bar)
- top-5 ≥ 75% on `blind.csv`

If acceptance fails on first run, **iteration is expected** — try one more rerank-prompt revision before bailing. Devplan T-024 §"acceptance" is non-negotiable for the seen set; blind-set thresholds are this-plan-only and may be revised in the ADR.

**Gated under `pytest -m mapping_eval` — slow lane, runs in scheduled CI like the Phase 2 ner-eval lane.** **Commit:** `test(templates/commercial): concept mapping acceptance E2E (gated)`.

---

## Task 14: Three-place registration

Register `concept_mapping_suggester` and `mapping_review_queue` in NODE_TYPES + schema enum + NODE_REGISTRY (commercial registry; not in the community NODE_REGISTRY). **Commit:** `feat(templates/commercial): register concept_mapping_suggester + mapping_review_queue node types`.

---

## Task 15: RBAC gate

`MappingReviewQueueNode` requires the runner's principal to have the `mapping-reviewer` role. HIGHSEC §1.1 already lists this role; Phase 3 wires it into the Spatie permission seeder for backend, and the node enforces it via the existing context auth check. **Commit:** `feat(templates/commercial): RBAC gate — mapping-reviewer role required for writes`.

---

## Task 16: ADR 0019

ADR records:
- **Context:** Phase 3 Q4=(c) (curated benchmark), Q5=(a) (bge-base), Q8=(a) (React UI in Plan 7). Concept-mapping is the single largest commercial wedge per devplan T-024.
- **Decision:** Two-stage retrieve-then-rerank. bge-base for retrieval (768-dim, MIT, strong biomedical baseline). LLM rerank via Phase 2 LlmBackend with `concept-rerank` prompt. Approved mappings persist to `app.parthenon_concept_map`.
- **Acceptance:** top-1 ≥60% / top-5 ≥85% on curated 3k seen-vocab benchmark; top-1 ≥50% / top-5 ≥75% on 600-pair blind-vocab held-out set.
- **Consequences:** Concept mapping cost — published estimates put it at 40-60% of total ETL effort. Cutting that in half (or better) is the Parthenon-native moat. Embedding ingest is one-shot; runtime cost is dominated by LLM rerank for unmapped codes only (small N relative to total CONCEPT count).
- **Alternatives:** USAGI exact-match only (misses synonyms); LLM-only (no embedding stage — too slow at corpus scale); heavyweight reranker like cross-encoder (not warranted at our top-50 cutoff).
- **Open follow-ups:** Plan 7 (review UI); cross-encoder rerank if top-5 accuracy plateaus below 90% in production; per-vocabulary embedding fine-tuning (Phase 4 candidate).

**Commit:** `docs(adr): ADR 0019 — concept-mapping retrieve-then-rerank architecture`.

---

## Done

After Task 16, the AI-assisted mapping backend is complete. Plan 7 lays the React UI on top.

**Pre-PR check-in:** Per Phase 3 spec §2 Gate 2, surface acceptance E2E results to the user before opening the PR. If first-attempt accuracy fails, iterate on prompt or report blockers; don't merge a failed acceptance gate.
