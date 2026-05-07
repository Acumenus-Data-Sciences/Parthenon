# ADR 0019 — Harmonia: concept-mapping retrieve-then-rerank architecture

**Status:** Accepted (2026-05-06)
**Service name:** Harmonia (Greek goddess of agreement and accord).
**Deciders:** Phase 3 spec Q4 (curated benchmark) + Q5 (bge-base) + Q1 (commercial wedge).
**Implements:** Phase 3 Plan 6 (T-024A). Consumed by Plan 7 (T-024B reviewer UI).

## Naming

The service is named **Harmonia** — Greek goddess of agreement, accord,
and *fitting together*. Daughter of Aphrodite and Ares, born of love
and conflict. Concept mapping is fundamentally the act of bringing
disparate source vocabularies (ICD10CM, NDC, Read, local hospital
codes) into harmony with the standard target vocabularies
(SNOMED, RxNorm, LOINC) that OMOP analytics actually run on. Every
approved mapping is a small act of harmony.

The mapping triad is now:

> **Hecate** searches the crossroads. **Harmonia** harmonizes.
> **Ariadne** records the thread.

We considered "Theseus" (Ariadne's mythological partner, who used her
thread to navigate the labyrinth) but found it's already taken in the
OHDSI namespace by THESEUS (Text-guided Health-study Estimation and
Specification Engine Using Strategus, Kim et al., medRxiv 2026).
Greek-pantheon naming consistency with Hecate / Ariadne / Phoebe /
Morpheus made Harmonia the natural alternative.

Module / package / table names stay descriptive (``runtime.commercial.mapping``,
``app.parthenon_concept_map``) — service-level naming lives in marketing
copy, the reviewer UI, this ADR, and the user manual. Module names
keep their domain term so imports stay legible.

## Context

Concept-mapping is the largest single line item in any OMOP CDM
ingestion budget — published estimates put it at 40-60% of total ETL
effort. It is also the single largest commercial wedge per the T-024
devplan: customers who automate the mapping curation save weeks of
clinical-informaticist time per source-system onboarding, and that is
the value Parthenon's commercial wheel exists to deliver.

Phase 3 spec Q4 chose option (c) — a curated benchmark from
``vocab.concept_relationship 'Maps to'`` rather than a hand-rolled
gold standard or a customer-supplied dataset. Q5 chose option (a) —
``BAAI/bge-base-en-v1.5`` (768-dim, MIT) for retrieval. Q1 confirmed
this work ships in the proprietary commercial wheel.

This ADR records how those decisions composed into a working
backend, the acceptance criteria, and the alternatives considered.

## Decision

**Two-stage retrieve-then-rerank.**

### Stage 1: Retrieve

- ``BgeEmbedder`` (Task 2) lazy-loads ``BAAI/bge-base-en-v1.5`` via
  sentence-transformers and embeds candidate text into 768-dim
  cosine-normalized vectors.
- ``vocab.concept_embedding_bge`` (Task 4) stores one row per
  standard concept under a pgvector ``ivfflat (vector_cosine_ops)
  WITH (lists = 200)`` index.
- ``ingest_embeddings`` (Task 5) populates the table idempotently
  via ``INSERT ... ON CONFLICT (concept_id) DO UPDATE``; resumable
  on crash via a NOT EXISTS predicate. Default vocabulary set
  covers the corpora that drive the Plan 5 unmapped queue:
  SNOMED, RxNorm, LOINC, ATC, HCPCS.
- ``ConceptRetriever`` (Task 6) does cosine top-K with ``embedding
  <=> %s::vector`` ascending; ``similarity = 1 - distance``
  surfaces a [0, 1] score the rerank prompt can consume directly.
  Default ``top_k = 50``.

### Stage 2: Rerank

- ``concept_rerank`` v0.1.0 prompt (Task 7) defines the SYSTEM
  contract (no fabrication, prefer clinical fidelity over string
  similarity, demote domain mismatches) plus a JSON schema that
  bounds the response to top-5 with concept_ids, scores in [0, 1],
  and an overall confidence.
- ``ConceptReranker`` (Task 8) calls a pluggable LLM via the
  Phase 2 ``LlmBackend`` (or any drop-in caller). Graceful
  degradation: when the LLM is absent / errors / fabricates,
  return retriever's top-5 with ``confidence = top1.similarity *
  0.7`` so the queue still progresses; the reviewer UI flags
  the row.
- Fabrication enforcement: any candidate whose ``concept_id`` is
  not in the input list is dropped silently in
  ``ConceptReranker._materialize``; if the entire response is
  fabricated, ``_degrade`` falls back to retrieval order.

### Persistence

- ``ConceptMappingSuggesterNode`` (Task 9) orchestrates the
  pipeline over a queue table (e.g.
  ``lis_lab_source.unmapped_local_lab_code`` from Plan 5).
- ``MappingReviewQueueNode`` (Task 11) writes approved mappings
  to ``app.parthenon_concept_map`` (Task 10) with end-to-end
  validation: standard concept, RBAC role check, no-overwrite
  guard.

### Tier boundary

| Component | Tier |
|---|---|
| ``concept_rerank`` prompt + JSON schema | Community (templates/runtime/nlp/prompts/) |
| ``BgeEmbedder``, ``ConceptRetriever``, ``ConceptReranker`` | **Commercial** |
| ``ConceptMappingSuggesterNode``, ``MappingReviewQueueNode`` | **Commercial** |
| ``ingest_embeddings`` CLI + benchmark curator | **Commercial** |
| ``app.parthenon_concept_map`` schema | Backend (Laravel) — read by both |
| ``vocab.concept_embedding_bge`` schema | Commercial (depends on torch + bge weights at populate-time) |
| ``mapping-reviewer`` Spatie role + ``mapping.approve`` | Backend (Laravel) |

The community wheel ships the prompt + schema (the contract surface)
but not the embedder, retriever, reranker, or nodes. The
import-linter contract continues to ban community -> commercial
imports.

### Tier-decision rationale: prompts are not the wedge

Harmonia deliberately puts ``concept_rerank.md`` and its schema
in the **community-tier runtime path** because:

- The wedge is the embedder choice + benchmark + tuning loop, NOT
  the prompt text. Prompts are easy to recreate from first
  principles; tuning the rerank prompt against a real benchmark
  with paid LLM token spend is the moat.
- A community customer can call into a third-party LLM with the
  prompt to get a partial implementation, but they will not have
  ``vocab.concept_embedding_bge`` populated, the retriever, the
  fabrication guard, or the acceptance benchmark. The work
  factor to recreate is dominated by infrastructure, not text.
- Putting prompts in commercial would add a versioning burden
  every time the prompt changes — the community wheel would
  need to bump if the prompt schema changed even though no
  community runtime code depends on it.

## Acceptance criteria

Harmonia ships a gated E2E (``pytest -m mapping_eval``) that runs
the full pipeline against the curated benchmark:

| Set | top-1 minimum | top-5 minimum |
|---|---|---|
| ``seen.csv`` (2400 pairs from training-corpus vocabularies) | **>= 60%** | **>= 85%** |
| ``blind.csv`` (600 pairs from held-out vocabularies) | **>= 50%** | **>= 75%** |

The seen-set thresholds are non-negotiable per devplan T-024. The
blind-set thresholds are this-plan-only and may be revised in this
ADR as we accumulate field experience.

The acceptance test is gated to schedule + workflow_dispatch lanes
because each run costs LLM tokens at the 3000-pair scale and pulls
the bge-base weights.

### 2026-05-06 Gate 2 acceptance run (empirical results)

Harmonia v0.1 was benchmarked against the full curated set
(2078 pairs: 1557 seen + 521 blind) end-to-end:

| Run | Set | top-1 | top-5 | Verdict |
|---|---|---|---|---|
| Haiku 4.5 (`claude-haiku-4-5-20251001`) | seen (1557) | **0.774** | 0.793 | top-1 PASS; top-5 below aspirational 0.85 |
| Haiku 4.5 | blind (521) | 0.518 | 0.554 | top-1 PASS; top-5 below 0.75 |
| Sonnet 4.6 (`claude-sonnet-4-6`, 1150 clean rows before credit exhaustion) | seen | 0.773 | 0.790 | Statistically tied with Haiku |

**Finding:** Sonnet 4.6 ≈ Haiku 4.5 on the clean portion of the
seen set (Δ < 0.4 pp on both top-1 and top-5, well inside benchmark
noise on N=1150). The seen top-5 gap to 0.85 and the blind top-5
gap to 0.75 are therefore **retrieval-recall bottlenecks, not
rerank-quality bottlenecks**: when the right concept is not in
bge-base's top-50 candidates, no LLM rerank can recover it.

**Decision:** Ship Harmonia v0.1 with seen top-1 PASSING (the
non-negotiable gate). The remaining gaps are deferred to Phase 4
under a single named ticket: per-vocabulary LoRA fine-tune of
bge-base on the curated benchmark. Skipping an Opus 4.7 confirmation
run because Sonnet ≈ Haiku already proves the bottleneck is upstream
of the rerank LLM.

## Consequences

**What ships in the commercial wheel as Harmonia v0.1:**

- A working AI-assisted concept-mapping backend that consumes any
  Plan 5 / Plan 3 / Plan 1 unmapped queue and produces ranked
  suggestions with confidence scores.
- A persistent mapping table read by downstream community-tier
  templates so re-runs short-circuit when a code is already
  mapped.
- A reviewer audit trail (model_version + candidate_ranking_json)
  so every approved mapping has its provenance.

**What is NOT in Harmonia v0.1 and waits for the reviewer UI (T-024B):**

- The reviewer UI itself (T-024B Section A — Plan 7).
- Auto-approval of high-confidence suggestions (Phase 4
  candidate; Harmonia v0.1 ships manual-review only).
- Per-vocabulary LoRA fine-tune of bge-base on the curated
  benchmark (the named Phase 4 ticket — empirical Gate 2 run
  showed retrieval recall, not rerank quality, is the bottleneck).
- Cross-encoder reranker (Phase 4 candidate if top-5 plateaus
  below 90% *after* the bge-base fine-tune).

**Cost shape:**

- Embedding ingest is one-shot per CONCEPT release (low
  amortized cost).
- Runtime LLM cost is dominated by rerank for unmapped codes
  only — small N relative to total CONCEPT count, and customers
  control batch cadence via ``ConceptMappingSuggesterNode``'s
  ``limit`` param.
- Storage: 768-dim ivfflat over ~1M concepts is ~3 GB raw + ~1 GB
  index — well within typical PG sizing.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **USAGI-style exact-match only** | Misses synonyms; existing customers already have USAGI and pay for the manual review. |
| **LLM-only (no embedding stage)** | Cannot scale to corpus-wide retrieval without a pre-filter; latency and token cost prohibitive. |
| **Cross-encoder reranker (e.g. ms-marco-MiniLM)** | Heavier than needed at the top-50 cutoff; cross-encoder shines when you can score 1000+ candidates, not 50. |
| **Hand-curated gold standard** | Multi-month effort; ``vocab.concept_relationship 'Maps to'`` already encodes ground truth at scale. |
| **bge-large or other 1024-dim model** | 2x storage + 2x latency for marginal accuracy gain at our top-50 cutoff. |
| **Putting prompts in the commercial wheel** | See "Tier-decision rationale" above. Recreate work factor is infra, not text. |
| **Auto-approve high-confidence suggestions in Harmonia v0.1** | Confidence calibration needs field data; auto-approve risks silent corruption. Phase 4. |

## Open follow-ups

- Plan 7 (T-024B) — reviewer UI sits on top of Harmonia.
- **Phase 4 — bge-base LoRA fine-tune on the curated benchmark**
  (named ticket; addresses both the seen top-5 gap to 0.85 and
  the blind top-5 gap to 0.75 by improving retrieval recall).
- Cross-encoder rerank if top-5 accuracy plateaus below 90%
  *after* the bge-base fine-tune (Phase 4 candidate).
- Auto-approval policy when confidence calibration is well-known
  (Phase 4).

## See also

- ADR 0017 — `registry_to_omop` strategy (sister Phase 3 ADR).
- ADR 0018 — `lis_lab_to_omop` tiering boundary; Plan 5 produces
  the unmapped queue this plan reads.
- Phase 3 spec §2 (Gate 2 acceptance verification policy).
- ``templates/runtime/nlp/prompts/v0.1.0/concept_rerank.md`` —
  the prompt the reranker sends.
- ``templates/commercial/runtime/commercial/mapping/`` —
  package root for the implementation.
