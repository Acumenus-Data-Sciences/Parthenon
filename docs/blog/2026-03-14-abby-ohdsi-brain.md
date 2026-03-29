---
slug: dev-diary-2026-03-14-abby-ohdsi-brain
title: "Abby Gets a Brain: 79,070 Vectors of OHDSI Knowledge"
authors: [mudoshi, claude]
tags: [development, ai, chromadb, knowledge-base, ohdsi, abby]
date: 2026-03-14
---

Today we transformed Abby from a capable AI assistant into an OHDSI domain expert backed by the largest curated outcomes research knowledge base we're aware of in any open-source platform. By the end of the day, Abby's `ohdsi_papers` ChromaDB collection held **79,070 SapBERT-embedded vectors** spanning peer-reviewed research papers, the Book of OHDSI, HADES package documentation, and a decade of practitioner Q&A from the OHDSI forums.

<!-- truncate -->

<div style={{borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem'}}>
  <img src="/docs/img/Abby-AI.png" alt="Abby AI assistant" style={{width: '100%', display: 'block'}} />
</div>

---

## The Problem: An Assistant Without a Library

Abby already had strong bones — page-aware personas, conversation memory, FAQ auto-promotion, and clinical concept embeddings via SapBERT. But when a researcher asked "How should I handle time-at-risk in a self-controlled case series?" or "What's the recommended approach for negative controls in population-level estimation?", Abby was generating answers from the LLM's general training data rather than grounding responses in the actual OHDSI methodology canon.

The fix wasn't to swap models — it was to give Abby a proper research library and the ability to cite it.

---

## The Harvest: Four Knowledge Sources in Parallel

### 1. OHDSI Research Papers (2,258 PDFs, 2.2 GB)

We built a five-phase harvester pipeline (`harvester.py`) that:

1. **Scraped the OHDSI publications bibliography** for seed papers with PMIDs and DOIs
2. **Resolved 48 workgroup leads via OpenAlex** — including core contributors like George Hripcsak, Patrick Ryan, Marc Suchard, and Martijn Schuemie — and fetched all their publications
3. **Enriched with PubMed/PMC** to find PMCIDs for open-access full text
4. **Checked Unpaywall** for legal OA copies of remaining papers
5. **Downloaded 2,258 PDFs** from PMC and publisher OA sources

The final catalog contains **7,904 papers** with metadata, of which 4,492 are open access. The harvester is fully resumable (state saved after each phase) and uses content-hash deduplication to avoid re-processing on subsequent runs.

| Metric | Count |
|--------|-------|
| Total papers catalogued | 7,904 |
| With DOI | 7,127 |
| With PMID | 4,830 |
| Open Access | 4,492 |
| PDFs downloaded | 2,258 |
| Authors tracked | 48 |

### 2. Book of OHDSI (26 Chapters, 698K chars)

The [Book of OHDSI](https://ohdsi.github.io/TheBookOfOhdsi/) is the canonical textbook for the OMOP ecosystem. We scraped all 26 R Markdown chapters from the GitHub repository, stripped R code blocks (keeping only the explanatory methodology text), and preserved the full chapter structure with headers intact.

This gives Abby authoritative coverage of:
- The OMOP Common Data Model architecture
- Standardized vocabularies and concept hierarchies
- Study design methodology (cohort, case-control, self-controlled)
- Population-level estimation (propensity scores, negative controls)
- Patient-level prediction (feature extraction, model evaluation)
- Data quality and characterization with Achilles

### 3. HADES Vignettes (136 Files, 764K chars)

HADES (Health Analytics Data-to-Evidence Suite) is the collection of R packages that researchers use daily. We scraped READMEs and vignettes from **30 packages** including CohortMethod, PatientLevelPrediction, CohortGenerator, Achilles, DataQualityDashboard, FeatureExtraction, and more.

Each vignette was cleaned (R code stripped, YAML frontmatter removed) and tagged with the package name and last-updated date for recency-aware retrieval.

### 4. OHDSI Forums (429 Threads, 3.0 MB)

The OHDSI community forums at forums.ohdsi.org contain over a decade of practitioner Q&A — the kind of hard-won knowledge that doesn't make it into textbooks. We scraped high-quality threads with quality filters:

- **Minimum engagement:** 3+ replies or 200+ views
- **Solved preference:** Threads with accepted answers scored higher
- **Recency weighting:** 2022+ content weighted 2-3x over older posts
- **Category filtering:** Focused on clinical methodology categories, skipped jobs/events/announcements
- **Quality scoring:** Each thread gets a composite score from views, likes, replies, solved status, and recency

The year distribution skews recent — 306 of 429 threads are from 2022 or later — which is exactly what we want for current methodology guidance.

---

## The Embedding Pipeline

All four sources flow into a single ChromaDB collection: `ohdsi_papers`, embedded with **SapBERT** (768-dimensional, biomedical-specialized).

We chose SapBERT over the general-purpose MiniLM embedder (384-dim) because these are biomedical research texts. SapBERT was pre-trained on PubMedBERT and fine-tuned on UMLS concept pairs — it understands that "myocardial infarction" and "heart attack" are semantically close in a way that general embedders miss.

### Chunking Strategy

| Source | Chunk Size | Overlap | Strategy |
|--------|-----------|---------|----------|
| Research PDFs | 1,500 chars | 200 chars | Plain text, sentence boundary splitting |
| Book of OHDSI | 1,500 chars | 200 chars | Markdown header-aware splitting |
| HADES Vignettes | 1,500 chars | 200 chars | Markdown header-aware splitting |
| Forum Threads | 1,500 chars | 200 chars | Markdown header-aware splitting |

### Metadata on Every Chunk

Every vector carries metadata for filtering and ranking:

```json
{
  "source": "ohdsi_corpus | book_of_ohdsi | hades_vignette | ohdsi_forums",
  "source_file": "filename.pdf",
  "title": "Paper/chapter/thread title",
  "doi": "10.xxxx/...",
  "year": 2024,
  "priority": "high | medium | low",
  "quality_score": 7.5,
  "package": "CohortMethod",
  "chunk_index": 3,
  "total_chunks": 12,
  "version": "a1b2c3d4"
}
```

### Content-Hash Deduplication

Every file is SHA-256 hashed before ingestion. If the hash matches an existing chunk ID, the file is skipped. If the content changed (file updated), old chunks are deleted before new ones are upserted. This means the pipeline is fully idempotent — you can re-run it safely.

---

## RAG Integration

The new collection is wired into Abby's retrieval pipeline via `build_rag_context()`. On **all clinical pages** (cohort builder, vocabulary, estimation, prediction, characterization, genomics, imaging, etc.), Abby now queries both the existing clinical reference collection and the new OHDSI papers collection.

Results are injected into the system prompt as:

```
KNOWLEDGE BASE (use this context to inform your response):

Documentation:
- [existing docs chunks]

OHDSI research literature:
- [relevant paper/book/vignette/forum chunks]

Clinical reference:
- [OMOP concept matches]
```

The retrieval uses a cosine distance threshold of 0.3 (70% similarity) and returns the top 3 most relevant chunks per source.

---

## Final Numbers

| Collection | Vectors | Dimension | Embedder |
|-----------|---------|-----------|----------|
| `ohdsi_papers` | **79,070** | 768 | SapBERT |
| `docs` | 46,271 | 384 | MiniLM |
| `clinical_reference` | 0* | 768 | SapBERT |
| **Total** | **125,341** | | |

*Clinical reference collection pending OMOP concept ingestion.

### Breakdown of ohdsi_papers

| Source | Files | Chunks |
|--------|-------|--------|
| Research PDFs | 2,233 | 74,539 |
| HADES Vignettes | 136 | 1,134 |
| Book of OHDSI | 26 | 773 |
| OHDSI Forums | 429 | 2,624 |
| **Total** | **2,824** | **79,070** |

---

## Infrastructure Changes

| File | Change |
|------|--------|
| `ai/app/chroma/collections.py` | New `get_ohdsi_papers_collection()` — SapBERT 768-dim |
| `ai/app/chroma/ingestion.py` | `ingest_ohdsi_corpus()` for PDFs + `ingest_ohdsi_knowledge()` for Book/HADES/Forums |
| `ai/app/chroma/retrieval.py` | `query_ohdsi_papers()` + wired into `build_rag_context()` on clinical pages |
| `ai/app/routers/chroma.py` | `POST /ingest-ohdsi-papers` + `POST /ingest-ohdsi-knowledge` endpoints |
| `ai/requirements.txt` | Added `pymupdf`, `python-multipart` |
| `docker-compose.yml` | Volume mounts for all four corpus directories into AI container |
| `OHDSI-scraper/harvester.py` | Five-phase research paper harvester |
| `OHDSI-scraper/scrape_book.py` | Book of OHDSI chapter scraper |
| `OHDSI-scraper/scrape_hades.py` | HADES vignette scraper (30 packages) |
| `OHDSI-scraper/scrape_forums.py` | OHDSI forums Q&A scraper with quality filtering |

---

## Data Quality Safeguards

We built several safeguards into the pipeline to prevent stale or incorrect knowledge from degrading Abby's responses:

1. **Recency metadata** — every chunk carries a year/date so retrieval can boost recent content
2. **Source priority tags** — canonical sources (Book, official docs) ranked `high`, community content ranked `medium`
3. **Quality scores on forum posts** — composite of solved status, engagement, and recency
4. **Content deduplication** — SHA-256 hashing prevents duplicate ingestion
5. **R code stripping** — code blocks removed from Book/vignettes, keeping only explanatory text
6. **Forum quote removal** — quoted reply text stripped to avoid content duplication within threads
7. **Minimum length filters** — chunks under 200 chars (PDFs) or 100 chars (markdown) are discarded

---

## What's Next

With the knowledge base in place, the next priorities for Abby's evolution are:

- **Citation grounding** — include DOIs in responses so researchers can verify claims
- **Query expansion** — expand OHDSI acronyms (PLE, PLP, SCCS, DQD) before retrieval
- **Re-ranking with cross-encoder** — retrieve top-10, re-rank with a cross-encoder for precision
- **Recency boosting** — weight post-2022 content higher for methodology questions
- **ChromaDB Admin Panel updates** — add OHDSI ingestion buttons and fix the query endpoint for 768-dim collections
- **Periodic re-harvesting** — cron job to pull new papers and forum threads monthly

Abby now has a library. Next, she learns to cite her sources.
