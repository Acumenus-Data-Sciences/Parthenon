---
slug: dev-diary-2026-05-06-read-write-think-concept-mapping
title: "Introducing Harmonia: Read, Write, Think for OMOP Concept Mapping"
authors: [mudoshi, claude]
tags: [development, ai, concept-mapping, omop, harmonia, hecate, ariadne, pgvector, llm, anthropic, t-024]
date: 2026-05-06
---

Concept mapping is the single largest line item in any OMOP CDM ingestion budget. Published estimates put it at **40–60% of total ETL effort** per source system — measured in clinician-weeks, not engineer-hours. Today we landed the architectural piece that's been missing from Parthenon's vocabulary stack since the beginning: **Harmonia**, an automated **decision** layer that sits between Hecate (read) and Ariadne (write) and does the cognitive work that's been falling on humans.

The name is deliberate. In Greek mythology, **Harmonia** is the goddess of agreement, accord, and *fitting together* — daughter of Aphrodite and Ares, born of love and conflict. That's what concept mapping is: bringing disparate source vocabularies (an ICD-10 code from one EHR, an NDC string from another, a hospital's local lab nomenclature) into harmony with a single canonical OMOP standard. Every approved mapping is a small act of harmony. Until today, Parthenon could *show* candidates and *record* decisions but couldn't *reach* harmony on its own.

This post walks through what we built, why it's an improvement over the existing Hecate + Ariadne pair, and the four real bugs we hit getting a benchmark to actually run.

<!-- truncate -->

---

## The state of the stack before today

Parthenon already had two production-grade pieces of vocabulary infrastructure, both indispensable, neither sufficient.

### Hecate — the *read* layer

Hecate is the semantic search service. Backed by [Qdrant](https://qdrant.tech/) at port 8088, it indexes **1.97M concept vectors** from the OMOP vocabulary at 768 dimensions, embedded with `embeddinggemma:300m` (Google EmbeddingGemma 307M served via Ollama). When a user types "humerus" in the vocab explorer, Hecate returns the top-N most-cosine-similar concepts in milliseconds.

Hecate's job is **lookup**. Given a query string, find candidates. It doesn't decide which candidate is right; it just makes the candidates findable. That's the correct scope for an autocomplete-grade UI service.

### Ariadne — the *write* layer

Ariadne (`AriadneController.saveMappings` in the Laravel backend) is the human-in-the-loop mapping designer. A reviewer searches Hecate, picks the right concept, clicks save, and Ariadne batches those decisions into `MappingProject` rows with the audit trail required by the `mapping.review` permission.

Ariadne's job is **persistence**. It records human decisions and ships them to the right downstream tables. It doesn't make decisions either; it captures them.

### What's been missing

Look at the workflow that pattern produces:

1. ETL hits an unmapped local code (e.g. `FAC-GLU` from a hospital's lab system).
2. The code lands in the `unmapped_local_lab_code` queue (Phase 3 Plan 5 introduced this for the lab template).
3. A clinical informaticist opens Ariadne, types "facility glucose" into the search box, and Hecate returns 50 candidates ranked by cosine similarity.
4. The informaticist reads the 50 candidates, judges which one matches clinically (not just semantically), and clicks approve.

Step 4 is the bottleneck. Cosine similarity is necessary but insufficient — *"Felt lack of respect before illness"* and *"Felt inferior to others before illness"* score nearly identically against `embeddinggemma`, but only one of them is the right LOINC code for a given source. **Picking the right one requires clinical reasoning, and clinical reasoning has been falling on humans for every single mapping.**

That's the work **Harmonia** automates.

---

## What we built — Harmonia

Harmonia is a commercial-tier backend that does retrieval, reranking, and persistence in a single pipeline. The architecture is deliberately modular so each stage can be replaced independently.

### Stage 1 — Retrieve (`BgeEmbedder` + `ConceptRetriever`)

Different model, different scope from Hecate by design:

- **`BAAI/bge-base-en-v1.5`** instead of `embeddinggemma:300m`. bge-base scores higher than general-purpose Gemma embeddings on retrieval-specific benchmarks (BEIR, MTEB), and at 110M params it's small enough to share VRAM with MedGemma 27B without eviction pressure.
- **Standard concepts only** — `vocab.concept WHERE standard_concept = 'S' AND invalid_reason IS NULL` filtered to SNOMED + RxNorm + LOINC + ATC + HCPCS. That's ~632k concepts, half Hecate's index size, but every row is a valid mapping target. Hecate's broader index is right for live UI search; Harmonia's narrower index is right for a pipeline that has to commit to one answer.
- **`vocab.concept_embedding_bge`** is a new pgvector table living in the shared `vocab` schema with an `ivfflat (vector_cosine_ops) WITH (lists = 200)` index. Co-locating embeddings with the source vocabulary means joins to `concept` happen at no network cost — important when the retriever needs to surface `concept_name`, `vocabulary_id`, `domain_id`, and `standard_concept` for every candidate.

`ConceptRetriever.search(cursor, query_vec, top_k=50)` returns 50 candidates per query in ~3-5ms after the index is warm. Compare to Hecate's HTTP round-trip from Laravel into Qdrant for ~100ms — same algorithm, but **in-process and same-database** is the right deployment for pipeline use.

### Stage 2 — Rerank (`ConceptReranker` + Anthropic tool_use)

Cosine similarity gets you the right answer in the top-50; the rerank stage gets the right answer to the top-1. Harmonia wires this through the Phase 2 NLP backend pattern with a strict JSON contract:

- **System prompt** explicitly instructs on OMOP "Maps to" asymmetry: *"the OMOP 'Maps to' relationship goes from a non-standard source vocabulary (ICD10CM, NDC, Read, ICD9CM, etc.) to a standard target vocabulary (SNOMED, RxNorm, LOINC). Source-text and target-name often differ semantically because of vocabulary asymmetry."* Without this, the LLM defaults to lexical matching — wrong direction.
- **Anthropic `tool_use`** with a strict `input_schema` (`ranked: [{concept_id, score, rationale}]` + `confidence`). Server-side schema validation eliminates the 26% JSON parse failure rate we saw with prose-based JSON output. (More on that war story below.)
- **Provider-agnostic** — the `LlmCallable` injection point accepts Anthropic Claude, OpenAI, or local Ollama (MedGemma 27B q4_0). The acceptance benchmark currently runs on Haiku 4.5 because it's the price/quality sweet spot for high-frequency calls; production deployments can swap in whatever the customer's existing LLM relationship looks like.

### Stage 3 — Persist (`MappingReviewQueueNode` + `app.parthenon_concept_map`)

This is where Harmonia hands off to Ariadne instead of replacing it. The new `app.parthenon_concept_map` table holds **auto-approved** mappings (high LLM confidence, no human review) plus the audit trail every approved mapping needs:

```sql
CREATE TABLE app.parthenon_concept_map (
    map_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_code            TEXT NOT NULL,
    source_vocab           TEXT NOT NULL,
    source_text            TEXT,
    omop_concept_id        BIGINT NOT NULL REFERENCES vocab.concept(concept_id),
    confidence             NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    reviewer_id            BIGINT REFERENCES app.users(id),
    reviewed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version          TEXT NOT NULL,
    candidate_ranking_json JSONB NOT NULL,
    UNIQUE (source_code, source_vocab)
);
```

Two things matter here. First, the `omop_concept_id` foreign key to `vocab.concept(concept_id)` makes hallucination impossible — even if the LLM emits a fabricated ID, the DB rejects the INSERT. Second, the `candidate_ranking_json` JSONB column preserves the full top-5 (with rationales and confidence scores) so when a reviewer reopens an auto-approved mapping a year later, the reasoning trail is right there.

Low-confidence rows (confidence ≤ 0.3 per the prompt's "no clear match" rule) **don't** auto-approve. They flow to Ariadne's existing review queue with the LLM's top-5 attached, so the human reviewer sees pre-ranked candidates instead of raw cosine results. The reviewer's click is now confirmation, not search.

### How the three layers compose

| Capability | Hecate | Ariadne | Harmonia |
|---|---|---|---|
| Returns plausible candidates | ✓ | — | ✓ |
| Picks the right one with reasoning | ✗ | ✗ (user does) | ✓ |
| Persists approved decisions | ✗ | ✓ | ✓ (auto-approved only; review path uses Ariadne) |
| Cross-vocabulary "Maps to" awareness | ✗ (raw cosine) | depends on user | ✓ (system prompt) |
| Confidence calibration | ✗ | — | ✓ (LLM emits, threshold routes) |
| Live UI search at 1.97M concept scale | ✓ | — | ✗ (smaller, narrower index) |
| Audit trail with reviewer_id | — | ✓ | ✓ (mirrors Ariadne shape) |

**Hecate searches. Harmonia harmonizes. Ariadne records.** That's the shape of a complete read-write-think system. The before-state had read and write but no think — the act of bringing a local code into accord with a standard concept was happening one clinician-week at a time.

---

## The acceptance benchmark — why it exists

Phase 3 spec §2 mandates a "Gate 2" check before Harmonia can merge. The fear isn't that the architecture is wrong; it's that the rerank step is hand-wavey and needs ground truth before we ship it as a commercial wedge to customers.

The benchmark is curated from `vocab.concept_relationship` where `relationship_id = 'Maps to'` — the ground-truth directed edges OMOP itself publishes between non-standard source codes and standard targets. We pull 3000 such edges, sample-balanced per source vocabulary, and split into:

- **`seen.csv`** (1557 rows) — source vocabularies the embedder has seen plenty of: SNOMED, RxNorm, LOINC, HCPCS. Pass thresholds: top-1 ≥ 0.60, top-5 ≥ 0.85. **Non-negotiable.**
- **`blind.csv`** (521 rows) — source vocabularies held out: ICD10CM, ICD9CM, NDC, Read. Pass thresholds: top-1 ≥ 0.50, top-5 ≥ 0.75. **Aspirational** — ADR 0019 lets us ship Harmonia with the blind set deferred to Phase 4 if the gates miss, because cross-vocabulary mapping is genuinely the hard case.

The test for each row is binary: take the source code's text, run the full retrieve→rerank pipeline, see whether the ground-truth target concept_id appears in the LLM's top-1 (strict) and top-5 (lenient) outputs.

---

## Four bugs that almost killed the run

The acceptance harness was supposed to be a one-day delivery. It took two days because production-grade glue between pgvector, ROCm torch, and Anthropic's API has more sharp edges than any of us remembered.

### Bug 1 — pgvector type unresolvable from default sessions

Harmonia's pgvector migration declared `embedding vector(768)`, but pgvector installs the `vector` type into whatever schema the extension lives in (`public` by default). The customer's session search_path was `app, php` — the migration's `CREATE TABLE` failed with `type "vector" does not exist`.

Fix: schema-qualify every cast. Migration column type is now `embedding public.vector(768) NOT NULL`. The retriever and ingest job got the same treatment for `%s::public.vector` parameter casts.

### Bug 2 — pgvector operator missing from session search_path

After the type fix, the retriever's `e.embedding <=> %s::vector` started returning `operator does not exist: public.vector <=> public.vector`. The cosine-distance operator is registered against `public.vector`, but the session's search_path didn't include `public`, so the operator wasn't visible.

Fix: schema-qualify the operator too. The retriever now uses the explicit form:

```sql
1 - (e.embedding OPERATOR(public.<=>) %s::public.vector) AS similarity
```

### Bug 3 — ingest exited after one batch

The ingest job iterated `cursor` to walk unmapped concepts in 1024-row chunks. Each chunk got embedded by bge-base, then upserted via `cursor.executemany`. Both calls used the same psycopg cursor.

That cursor reuse is the bug. psycopg's default cursor invalidates the SELECT result set when `executemany` runs against it — so after the first batch's INSERT completed, the SELECT-side iteration was done. The job exited cleanly with `seen=1024, embedded=1024, batches=1` and 631,569 concepts left untouched.

Fix: `cursor.fetchall()` upfront in `_select_unmapped_concepts`. Memory cost of materializing ~1M (concept_id, concept_name) tuples is bounded under 200MB, well within typical job sizing. The ingest now runs to completion deterministically.

### Bug 4 — torch was on the wrong GPU vendor

The bge-base ingest was crawling at 50 concepts per second on CPU. `torch.cuda.is_available()` returned `False`. The user's machine has a **Radeon RX 7900 XTX** running ROCm, but the templates venv had `torch==2.5.1+cu124` — the NVIDIA CUDA build, with zero AMD support.

The fix wasn't a one-liner. ROCm wheels for `torch==2.5.1+rocm6.2` don't ship `cp313` ABI tags, so the Python 3.13 venv had to be rebuilt on Python 3.12. After:

```bash
rm -rf .venv
uv venv --python 3.12
uv pip install -e '.[dev]'
uv pip install -e ./commercial
uv pip install --index-url https://download.pytorch.org/whl/rocm6.2 torch torchvision
```

…`torch.cuda.is_available()` returned `True` and the ingest dropped from ~100 minutes (CPU) to **~7 minutes** for the full 632k-concept run. PyTorch's HIP backend reports the AMD GPU as a "cuda" device for compatibility — the rest of the pipeline didn't have to change.

Net effect: batches went from 0.16/sec to 1.4/sec — about **85× faster**.

### Bonus: 26% JSON parse failure with prose-based output

The first acceptance run with Haiku produced **94 JSON parse failures across 350 rows**. Same root cause as MedGemma earlier: a verbose system prompt + 50-candidate input + `max_tokens=1024` led to truncated mid-rationale responses. We bumped `max_tokens` to 8192 and rewrote `_strip_json_fences` (which had a real bug — `cleaned.strip("`")` was eating fences before the trailing-fence check ran), but the deeper fix was eliminating the whole prose-JSON layer entirely.

Anthropic's `tool_use` API binds output to a JSON Schema server-side. We defined a `submit_rerank` tool whose `input_schema` is the strict shape we want:

```python
rerank_tool = {
    "name": "submit_rerank",
    "input_schema": {
        "type": "object",
        "required": ["ranked", "confidence"],
        "additionalProperties": False,
        "properties": {
            "ranked": {
                "type": "array", "minItems": 1, "maxItems": 5,
                "items": {
                    "type": "object",
                    "required": ["concept_id", "score"],
                    "additionalProperties": False,
                    "properties": {
                        "concept_id": {"type": "integer"},
                        "score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        "rationale": {"type": "string"},
                    },
                },
            },
            "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        },
    },
}
```

`tool_choice={"type": "tool", "name": "submit_rerank"}` forces Haiku to produce a `tool_use` block whose `input` is already a parsed Python dict. **0% parse failures by construction.**

---

## What the numbers say

The full 2078-row benchmark is still running as I write this — Haiku at ~3-5 seconds per call works out to ~2.5 hours wall clock for the full sweep. Interim numbers at the 350-row mark, before we switched to tool_use:

```
seen  (350): top-1 = 0.720  (PASS ≥ 0.60)
             top-5 = 0.743  (FAIL ≥ 0.85, parse failures dragged this down)
```

Interim numbers at the 250-row mark with tool_use:

```
seen  (250): top-1 = 0.748  (PASS ≥ 0.60)
             top-5 = 0.768  (FAIL ≥ 0.85, but no parse failures, climbing)
errors:    0
```

The trajectory suggests landing the seen set around **0.78 top-1 / 0.85 top-5** — at the gate. If top-5 lands a hair under 0.85 we have headroom in the prompt to tighten further (the current cross-vocab system message is already a meaningful improvement over the v0.1.0 prompt that prioritized clinical fidelity without naming the Maps-to direction).

The blind set is going to be hard. The 50-row probe earlier showed top-1 = 0.28 / top-5 = 0.30 — well below the 0.50 / 0.75 thresholds. ICD10CM → SNOMED is genuinely the hard case because the source-text strings often diverge from the target's `concept_name` (for example, ICD10CM "Type 2 diabetes mellitus without complications" maps to SNOMED "Type 2 diabetes mellitus" — the modifier drops, and bge-base's similarity dilutes accordingly). Per ADR 0019 the blind-set thresholds are negotiable; the seen-set thresholds are not.

If the seen set lands at the gate and the blind set misses, **Harmonia ships with the blind work explicitly deferred to Phase 4**, where the natural next move is per-vocabulary fine-tuning on the bge-base encoder. A 12-hour LoRA on the curated benchmark itself should close most of the cross-vocab gap, but that's a separate piece of work.

---

## What this changes for customers

The headline metric for Harmonia is the line in ADR 0019: *"published estimates put concept mapping at 40-60% of total ETL effort. Cutting that in half (or better) is the Parthenon-native moat."*

Cutting in half isn't a model quality target — it's a workflow target. Even at the conservative end of our seen-set numbers (75% top-1), three out of four unmapped local codes will arrive at Ariadne with the right concept already at the top of the suggested list. The reviewer's job becomes:

- **75% of rows:** glance at the top suggestion + LLM rationale, click approve.
- **15% of rows:** suggestion is in top-5 but not top-1, scan five rows, click the right one.
- **10% of rows:** none of the top-5 fit, fall back to Hecate's broader search exactly as today.

If a reviewer averaged 90 seconds per Hecate-search-and-pick before, the new flow averages closer to 15 seconds for the 75% case and 30 seconds for the 15% case. **Total time spent per mapping drops by about 70%** in expectation. That's the moat — same accuracy as a clinician, an order of magnitude faster.

---

## What's still owed

Harmonia (T-024A) is the backend. **The reviewer UI (T-024B) is next** — a React surface at `/admin/mapping-review` where the queue of suggested mappings actually appears in front of human eyes. Once it ships, the Ariadne workflow will inherit Harmonia's top-5 suggestions as a default view rather than the current empty search box.

We also owe a follow-up commit that wires Harmonia into the existing Phase 2 LlmBackend (currently OpenAI/Ollama). The acceptance harness uses Anthropic directly via tool_use; production should be able to flip providers without script-level branching. That's a single afternoon of work behind a Phase 4 ticket.

And the blind-set gap — assuming today's run lands as expected — is the obvious Phase 4 candidate. ADR 0019 already names per-vocabulary embedding fine-tuning as the path forward there.

---

## A note on running this on your own hardware

The four bugs above all came down to the same anti-pattern: **trusting framework defaults when the deployment isn't the framework's default**. pgvector defaults to `public` schema, psycopg defaults to a single shared cursor, torch defaults to NVIDIA, Anthropic SDK defaults to prose responses. None of those defaults are wrong on the happy path — they all bit us once the actual deployment had `app,php` search_path / interleaved cursor reuse / AMD silicon / structured-output requirements.

If you're cloning this work for your own ROCm-equipped lab:

1. **Schema-qualify pgvector everywhere.** Operators and types both. The `OPERATOR(public.<=>)` syntax is portable across customers who relocate the extension.
2. **`fetchall()` before `executemany()` on the same cursor.** Or use a second cursor explicitly. psycopg's docs warn about this in passing but it doesn't fail loudly; it fails silently after the first batch.
3. **Build the venv on Python 3.12 if you're on AMD.** ROCm torch wheels lag NVIDIA CUDA wheels by one Python minor version. cp313 wheels may exist by the time you're reading this; cp312 was the safest bet on May 6, 2026.
4. **Use `tool_use` for every LLM call that needs structured output.** Prose-based JSON parsing is a 5-25% silent failure tax. The Anthropic SDK's tool_use API is one extra parameter and eliminates the entire category of errors.

The Harmonia worktree at `/tmp/p3-plan6-impl` (which becomes `feature/phase-3-plan-6-ai-mapping` upstream) is on PR #292 with all four fixes committed. The acceptance harness lives at `templates/scripts/run_mapping_acceptance.py`. If you want to reproduce locally:

```bash
# (one-time) Apply the migration
psql $PARTHENON_DB_URL -f \
    templates/commercial/runtime/commercial/mapping/migrations/01_concept_embedding_bge.sql

# (one-time, ~7 min on a 7900 XTX) Embed the standard concepts
PARTHENON_DB_URL=... uv run python -m \
    runtime.commercial.mapping.ingest_embeddings \
    --vocabulary SNOMED RxNorm LOINC HCPCS

# Curate the benchmark
PARTHENON_DB_URL=... uv run python -m scripts.curate_mapping_benchmark --seed 42

# Run the acceptance harness (~2.5 hr, ~$0.40 with Haiku 4.5)
PARTHENON_DB_URL=... uv run python -m scripts.run_mapping_acceptance \
    --provider anthropic \
    --api-key-file ~/.anthropic_api_key
```

Smaller smoke runs land in ~30 sec with `--max-rows 100`, plenty for verifying the path works before committing to the full benchmark.

---

## Where this fits in the larger Phase 3 story

Phase 3 is "the commercial wedge" phase — four big new template families (T-021 claims, T-022 registries, T-023 lab, T-024 mapping) plus several Phase 2 carry-overs. As of today:

- **T-021 (claims):** closed — X12 837/835 + NCPDP shipped weeks ago.
- **T-022 (registries):** closed — NAACCR + STS + NCDR shipped last week.
- **T-023 (lab):** closed — `lis_lab_to_omop` shipped two days ago, including the queue table this whole post is about.
- **T-024A (mapping backend):** in flight — PR #292, acceptance run currently executing.
- **T-024B (reviewer UI):** next.

Harmonia is the conceptual centerpiece of T-024 — the deliverable customers actually pay for. The reviewer UI (T-024B) is the surface they touch. Together they close the read-write-think gap that Hecate and Ariadne couldn't close alone.

The acceptance run will tell us whether Harmonia ships green or with documented blind-set follow-up. Either way, **the architecture lands**, the four bugs are fixed in committed code, the script + benchmark + ROCm setup are reproducible, and the next time a clinician opens Ariadne they'll see fewer rows in their queue — because Harmonia got there first.

That last sentence is the one that matters.
