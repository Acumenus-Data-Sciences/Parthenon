---
slug: abby-acceleration-rag-overhaul
title: "Making Abby Honest and Fast: ROCm Migration, RAG Overhaul, and the Hunt for a 8MB Memory Lock"
authors: [mudoshi, claude]
tags: [development, ai, performance, chromadb, rag, ollama, rocm, abby, ohdsi, infrastructure]
date: 2026-03-16
---

What started as "Abby's responses are slow" turned into an 18-hour deep dive that touched every layer of the AI stack — from GPU driver backends to embedding model race conditions to the fundamental question of why a 4-billion-parameter medical LLM was confidently inventing researcher names. By the end, Abby went from 15-25 second hallucinated responses to 2-5 second grounded answers backed by 167,000 vectors of medical knowledge — and we found that an 8-megabyte systemd memory lock was silently killing 25% of all GPU inference requests.

<!-- truncate -->

<div style={{borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem'}}>
  <img src="/docs/img/Abby-AI.png" alt="Abby AI assistant" style={{width: '100%', display: 'block'}} />
</div>

---

## The Starting Point: Three Problems Masquerading as One

When we sat down to investigate Abby's performance, the user complaint was simple: "responses take quite a long time." But profiling the full request pipeline — from browser click to rendered markdown — revealed three distinct problems stacked on top of each other:

1. **Speed**: MedGemma 1.5 (4B parameters) running at F16 precision on an unstable Vulkan GPU backend, generating ~20 tokens/second
2. **Quality**: Abby hallucinating researcher names, paper titles, and study details instead of citing the 88,000 chunks of actual OHDSI research we'd just ingested
3. **Reliability**: ~25% of requests hanging indefinitely with no response, requiring Ollama restarts

Each problem had its own root cause. Fixing them required changes across seven codebases: the FastAPI AI service, ChromaDB retrieval pipeline, Ollama configuration, systemd service limits, Docker Compose, the Vulkan-to-ROCm GPU migration, and the frontend streaming path.

---

## Phase 1: The Speed Investigation

### Profiling the Request Pipeline

We instrumented every step of Abby's response path to build a latency map:

| Step | Component | Latency | % of Total |
|------|-----------|---------|-----------|
| Frontend → Nginx → PHP → Python | Network hops | &lt;50ms | &lt;1% |
| ChromaDB RAG retrieval | 5 sequential queries | 300-500ms | 3-5% |
| SapBERT cold start | Model loading | 2,000-5,000ms | First call only |
| **Ollama LLM inference** | **MedGemma F16 on Vulkan** | **5,000-25,000ms** | **80-90%** |
| Response parsing + storage | Post-processing | &lt;100ms | &lt;1% |

The bottleneck was clear: Ollama inference dominated everything. But fixing it required understanding *why* it was slow.

### The Vulkan Problem

The system runs an AMD Radeon RX 7900 XTX with 24GB of VRAM — more than enough for a 4B model. But Ollama was configured with `OLLAMA_VULKAN=1`, using the Vulkan compute backend instead of AMD's native ROCm/HIP stack.

Vulkan is a graphics API repurposed for compute. It works, but for LLM inference on AMD GPUs it has two critical weaknesses:

1. **Lower throughput**: ~20 tokens/second vs. ~120 tokens/second on ROCm
2. **Silent stalls**: The Vulkan compute pipeline can hang without error, causing Ollama to appear frozen while the GPU driver is stuck in an unrecoverable state

### The ROCm Migration

We migrated from Vulkan to ROCm 7.2:

```bash
# Install ROCm 7.2 from AMD's noble repository
sudo apt install rocm-libs rocm-hip-runtime amdgpu-dkms

# Remove the Vulkan override, install Ollama's ROCm backend
# (the installer was short-circuiting due to a ghost nvidia-smi)
```

The migration wasn't straightforward — a leftover `nvidia-smi` binary from an old CUDA installation was causing Ollama's installer to detect a non-existent NVIDIA GPU and skip the ROCm backend. After removing the ghost binary and manually installing the ROCm variant, the RX 7900 XTX was properly detected as `gfx1100` with 24GB VRAM available.

**Result**: Token generation jumped from ~20 tok/s (Vulkan) to ~122 tok/s (ROCm) — a **6x improvement** in raw inference speed.

---

## Phase 2: Parallel RAG Retrieval

### The Sequential Query Problem

Abby's RAG pipeline queries five ChromaDB collections to build context for each response:

1. **docs** (47,860 chunks) — Platform documentation, MiniLM embeddings (384-dim)
2. **conversations** — Per-user conversation history, MiniLM (384-dim)
3. **faq_shared** (8 entries) — Auto-promoted frequent Q&A, MiniLM (384-dim)
4. **clinical_reference** (985,299 concepts) — OMOP vocabulary, SapBERT (768-dim)
5. **ohdsi_papers** (88,050 chunks) — Research papers + medical textbooks, SapBERT (768-dim)

These were queried **sequentially** — each waiting for the previous to complete. With SapBERT embeddings taking 50-100ms per query and MiniLM taking 10-20ms, the total RAG step was 300-500ms of pure waiting.

### The Fix: ThreadPoolExecutor with 5 Workers

```python
_query_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="chroma-rag")

def build_rag_context(query, page_context, user_id=None):
    futures = {
        "docs": _query_pool.submit(query_docs, query),
        "faq": _query_pool.submit(query_faq, query),
        "clinical": _query_pool.submit(query_clinical, query),
        "ohdsi": _query_pool.submit(query_ohdsi_papers, query),
    }
    # All 5 queries run simultaneously
    results = {k: f.result(timeout=10) for k, f in futures.items()}
```

**Result**: RAG retrieval dropped from 300-500ms to ~100-150ms — a **3x improvement**.

### The Race Condition Discovery

But parallelization exposed a deeper bug. When two threads simultaneously initialized `SentenceTransformer` (the MiniLM embedding model), PyTorch's internal state management produced corrupted "meta tensors" — model weights that existed as placeholders with no actual data.

The error was maddeningly intermittent:
```
NotImplementedError: Cannot copy out of meta tensor; no data!
```

It only appeared in uvicorn workers (not CLI tests), only when two threads raced to load models simultaneously, and only with `torch 2.10.0+cu128` and `sentence-transformers 4.1.0`. We proved it was a race condition by spawning two threads that both call `SentenceTransformer()` — one always succeeded, one always failed.

The fix: a threading lock with double-checked locking pattern, plus PID-aware singleton caching to detect and recover from uvicorn's pre-fork model corruption:

```python
_embedder_lock = threading.Lock()

def get_general_embedder():
    global _general_embedder, _general_pid
    pid = os.getpid()
    if _general_embedder is None or _general_pid != pid:
        with _embedder_lock:
            if _general_embedder is None or _general_pid != pid:
                _general_embedder = GeneralEmbedder()
                _general_pid = pid
    return _general_embedder
```

---

## Phase 3: The Medical Textbook Ingestion

### Evaluating 111 PDFs

Before the speed work, we evaluated 111 medical textbooks in the `OHDSI-scraper/Medical Texts/` directory for ChromaDB ingestion priority. The selection criteria was Abby's primary use case: translating natural language into OMOP CDM cohort expressions.

We organized the books into four priority tiers:

| Tier | Focus | Books | Examples |
|------|-------|-------|---------|
| 1 | Core OHDSI/Clinical | 5 | The Book of OHDSI, Guyton & Hall, Robbins Pathology, CMDT, Lippincott Pharmacology |
| 2 | Clinical breadth | 14 | Critical Care (Vincent), DeVita Oncology, Nelson Pediatrics, Ganong Physiology |
| 3 | Methodology | 6 | Cochrane Handbook, Epidemiology (Kestenbaum), Clinical Trials (Brody) |
| 4 | Infectious disease | 8 | Fields Virology, Principles of Virology, COVID-19 Handbook |

**Excluded**: Physics, calculus, organic chemistry, healthcare operations books, pure molecular biology, anatomy atlases (image-heavy, poor text extraction).

### Fixing the Extraction Script

The existing `ingest_textbooks.py` had seven broken regex patterns that failed to match actual filenames:

- **Robbins Pathology**: Pattern `Robb.*Kumar.*Abbas.*Aster` — but "Kumar, Abbas, Aster" appear *before* "Robb" in the filename
- **Lippincott Pharmacology**: Pattern `Lippincott.*Pharmacology` — but the filename is `Lippincott-Illustrated-Reviews` (no "Pharmacology")
- **DeVita Cancer**: Pattern `DeVita.*Rosenberg.*Cancer` — filename truncates before "Cancer"
- **Ganong Physiology**: Pattern `Kim-E.-Barrett.*Ganong` — "Ganong" never appears in the filename
- **COVID-19 Handbook**: Pattern uses hyphens but filename has spaces

The Book of OHDSI — the single most critical source for Abby — was completely missing from the extraction list.

After fixes: **34 books extracted, 87,157 chunks, 100MB of medical text**.

### The ChromaDB Volume Mount Bug

During clinical concept ingestion, ChromaDB kept crashing at ~141,500 vectors with an OOM error. Investigation revealed:

1. **Memory limit**: ChromaDB container was capped at 1GB — insufficient for 985K SapBERT vectors at 768 dimensions
2. **Volume mount mismatch**: The Docker volume was mounted at `/chroma/chroma`, but ChromaDB's `persist_path` was `/data`. All data was being written to the container's ephemeral filesystem — every `docker compose up -d` destroyed everything.

We fixed the mount (`chromadb-data:/data`), increased memory to 6GB, and excluded RxNorm Extension (1.87M NDC/pack variants that Abby doesn't need for cohort building). Final collection sizes:

| Collection | Vectors | Embedding | Use |
|-----------|---------|-----------|-----|
| clinical_reference | 985,299 | SapBERT 768-dim | OMOP concepts (Condition, Drug, Procedure, Measurement) |
| ohdsi_papers | 88,050 | SapBERT 768-dim | Research papers + 34 medical textbooks |
| docs | 47,860 | MiniLM 384-dim | Platform documentation |
| faq_shared | 8 | MiniLM 384-dim | Seeded FAQ entries |

---

## Phase 4: The Hallucination Fix

### The Root Cause

Despite having 167,000+ vectors of medical knowledge, Abby was confidently inventing researcher names:

> *"Dr. M. H. (Michael) Rabin: Known for his work on cohort design..."*
> *"Dr. S. (Sarah) Chen: Research focuses on applying OMOP to population health studies..."*

None of these people exist in the OHDSI community. The investigation found **eight structural problems** in the RAG pipeline:

1. **Permissive system prompt**: The instruction "use this context to **inform** your response" gave the model permission to mix knowledge base content with hallucinated training data
2. **No grounding rules**: No instruction to avoid fabricating names, papers, or statistics
3. **No KB-empty signal**: When retrieval found nothing relevant, the model received no indication and responded as if fully informed
4. **Fixed-order results**: Documents assembled in section order (docs → FAQ → clinical → OHDSI) regardless of relevance scores
5. **No cross-collection ranking**: A 0.95-score OHDSI paper could be ranked below a 0.6-score doc chunk
6. **No source attribution**: The model couldn't distinguish between sources or cite them
7. **Thinking token leak**: MedGemma's `\<unused94\>thought...` chain-of-thought tokens were being shown to users
8. **Loose threshold**: Cosine distance threshold of 0.3 was accepting low-relevance results

### The Fix: Grounding Rules + Cross-Collection Ranking

**System prompt grounding** — when knowledge base results are available:
```
GROUNDING RULES:
- Base your answer PRIMARILY on the KNOWLEDGE BASE content provided above.
- When citing specific studies, papers, researchers, or statistics, use ONLY
  information from the KNOWLEDGE BASE. Do NOT invent paper titles, author
  names, or study details.
- If the KNOWLEDGE BASE does not contain enough information, say so explicitly.
```

When no results are found:
```
NOTE: No relevant documents were found in the knowledge base for this query.
Answer using your general knowledge but be transparent about limitations.
Do NOT fabricate specific paper titles, researcher names, or study details.
```

**Cross-collection relevance ranking** — all results from all collections are merged into a single list, sorted by similarity score, deduplicated, and the top 8 are injected with source attribution:

```
[OHDSI Research Literature — Park's Textbook of Preventive Medicine, relevance: 0.716]
The results of prevalence studies of diabetes mellitus...

[Clinical Reference (OMOP Vocabulary), relevance: 0.693]
Metformin seems to affect multiple key processes related to cell growth...
```

**Additional fixes**:
- Temperature lowered from 0.3 to 0.15 (less "creative" hallucination)
- Thinking tokens stripped via regex: `\<unused94\>.*?\<unused95\>`
- Distance threshold corrected from 0.3 to 0.5
- TOP_K increased from 3 to 5 per collection for better candidate pool
- Chunk truncation at 600 chars to keep context window reasonable

### Before and After

**Before** (asking "Name the OHDSI researchers who study diabetes"):
> *"Dr. M. H. (Michael) Rabin: Known for his work on cohort design..."*

**After**:
> *"I cannot provide a list of researchers who have published diabetes papers in OHDSI based on the provided knowledge base. The available documents discuss OHDSI's network, tools, and principles of biostatistics, but do not contain specific information about researchers or their publications related to diabetes within the OHDSI network."*

Honest, transparent, and accurate.

---

## Phase 5: The 8MB Memory Lock

### The Final Boss

After all the software fixes, Abby was fast and accurate — but still failing ~25% of requests with silent Ollama timeouts. The GPU had 24GB of VRAM, only 48% was in use, ROCm was properly installed, and the model loaded fine. But inference would randomly hang.

We audited Ollama's systemd service limits:

```bash
$ systemctl show ollama | grep LimitMEMLOCK
LimitMEMLOCK=8388608
```

**8 megabytes.** The `LimitMEMLOCK` setting caps how much memory a process can pin (lock in RAM, preventing swap). Ollama needs to pin GPU memory for DMA transfers between system RAM and VRAM. With a 9.7GB model, an 8MB lock limit means the GPU driver's memory pinning requests are silently denied — and inference stalls without any error message.

The fix:
```ini
[Service]
LimitMEMLOCK=infinity
LimitNOFILE=1048576
Environment=OLLAMA_HOST=0.0.0.0
Environment=OLLAMA_NUM_PARALLEL=4
Environment=OLLAMA_FLASH_ATTENTION=1
Environment=OLLAMA_KEEP_ALIVE=30m
Environment=OLLAMA_MAX_LOADED_MODELS=1
```

Combined with a retry mechanism in the Python AI service (3 attempts at 30s each, transparent to the user), the result was dramatic:

| Metric | Before | After |
|--------|--------|-------|
| Success rate | ~75% | **100%** (10/10) |
| Silent hangs | Every 3-4 requests | **None** |

---

## Final Numbers

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Response time (warm) | 15-25s | **2-5s** | 5-10x faster |
| Success rate | ~75% | **100%** | No more hangs |
| Hallucination | Fabricated names/papers | **Grounded or transparent** | Qualitative |
| RAG retrieval | 300-500ms sequential | **~100ms parallel** | 3-5x faster |
| Token generation | ~20 tok/s (Vulkan) | **~122 tok/s (ROCm)** | 6x faster |
| Model VRAM | 9.7GB / 24GB | 9.7GB / 24GB | Same model, stable |
| Knowledge base | 79,070 vectors | **167,000+ vectors** | 2.1x more context |
| RAG sources active | 1 of 5 | **5 of 5** | Full coverage |

### What Changed (Summary)

1. **GPU backend**: Vulkan → ROCm 7.2 (6x faster inference)
2. **Systemd limits**: `LimitMEMLOCK=8MB` → `infinity` (eliminated silent hangs)
3. **RAG queries**: Sequential → parallel ThreadPoolExecutor (3x faster retrieval)
4. **Embedder loading**: Race condition fixed with threading lock + PID-aware singletons
5. **Knowledge base**: 34 medical textbooks added, 985K clinical concepts ingested, ChromaDB volume mount fixed
6. **System prompt**: Grounding rules prevent hallucination, KB-empty signal for transparency
7. **Cross-collection ranking**: Results sorted by relevance, not source order
8. **Source attribution**: Every KB result tagged with origin and relevance score
9. **Thinking tokens**: MedGemma `\<unused94\>thought...` stripped from output
10. **Temperature**: 0.3 → 0.15 for more factual responses
11. **Retry logic**: 3 attempts at 30s catches intermittent GPU stalls
12. **Flash attention**: Enabled for faster inference and lower VRAM usage

---

## Lessons Learned

**"It's slow" is never one problem.** The user saw slow responses, but the actual issues were a Vulkan GPU backend (speed), broken embedder singletons (RAG quality), a permissive system prompt (hallucination), and an 8MB memory lock (reliability). Each required a different investigation methodology.

**systemd limits are invisible killers.** The `LimitMEMLOCK=8388608` default caused 25% of GPU inference requests to silently hang — no error message, no log entry, no timeout signal. The GPU driver just... stopped. Always audit process limits when deploying GPU workloads.

**Race conditions in model loading are real.** PyTorch and HuggingFace Transformers are not thread-safe for concurrent model initialization. If you're using `sentence-transformers` or `transformers` in a multi-worker ASGI server (uvicorn, gunicorn), you need explicit locking around model creation.

**Grounding rules change everything.** The difference between "use this context to inform your response" and "base your answer PRIMARILY on the KNOWLEDGE BASE; do NOT fabricate specific claims" is the difference between confident hallucination and honest transparency. LLMs follow instructions — but only the ones you actually give them.
