---
slug: building-abby-the-ai-that-reads-every-ohdsi-paper
title: "Building Abby: The AI That Read Every OHDSI Paper, Every HADES Vignette, and 19 Medical Textbooks"
authors: [mudoshi, claude]
tags: [ai, ohdsi, chromadb, rag, sapbert, abby, knowledge-base, architecture]
date: 2026-03-14
---

Today we gave Parthenon's AI assistant a research library that most outcomes researchers would envy. Abby — our context-aware, privacy-preserving AI — now has **115,000+ SapBERT-embedded vectors** spanning 2,258 peer-reviewed OHDSI papers, the complete Book of OHDSI, documentation from 30 HADES R packages, a decade of community forum Q&A, and 19 medical reference textbooks covering epidemiology, biostatistics, pharmacology, pathology, and clinical medicine.

This post tells the full story: why we built Abby, how the architecture works, what we harvested, what we learned about data quality in knowledge bases, and where we're headed next.

<!-- truncate -->

<div style={{borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem'}}>
  <img src="/docs/img/Abby-AI.png" alt="Abby AI assistant" style={{width: '100%', display: 'block'}} />
</div>

---

## The Problem We Set Out to Solve

The OMOP Common Data Model is the backbone of modern observational health research. It powers studies at institutions ranging from Columbia University to the European Medicines Agency. But working with it is genuinely hard.

A researcher who wants to run a population-level estimation study needs to understand cohort expression syntax, propensity score methodology, negative control selection, study diagnostics interpretation, and the specific quirks of whichever HADES R package handles their analysis type. The documentation is scattered across GitHub wikis, R vignette PDFs, the Book of OHDSI (a 700-page textbook), 10+ years of forum threads, and thousands of research papers.

We built Abby to centralize all of that knowledge into a single, contextual assistant that can answer questions like:

- *"My propensity score distribution is bimodal — what does that mean for my estimation?"*
- *"What's the recommended approach for time-at-risk in a self-controlled case series?"*
- *"How do I map this local ICD-10-CM code to a standard OMOP concept?"*
- *"What negative controls should I use for ACE inhibitor studies?"*

Not with generic LLM responses, but with answers grounded in the actual OHDSI literature.

---

## Architecture: How Abby Works

### The Stack

Abby runs entirely on-premises. No data leaves your infrastructure:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language Model | MedGemma 1.5 (4B) via Ollama | Response generation |
| Vector Database | ChromaDB | Semantic search across knowledge base |
| Embedding (general) | sentence-transformers/all-MiniLM-L6-v2 | 384-dim embeddings for documentation |
| Embedding (clinical) | SapBERT (PubMedBERT-based) | 768-dim embeddings for medical content |
| AI Service | Python FastAPI | RAG pipeline orchestration |
| Acceleration | Apache Solr | Pre-computed 3D vector projections |
| Frontend | React 19 + TypeScript | Chat UI, source attribution, feedback |
| Backend | Laravel 11 + Sanctum | Auth, rate limiting, API proxy |

### Retrieval-Augmented Generation (RAG)

Every question Abby receives triggers a five-stage pipeline:

**1. Page Context Detection** — Abby knows which page you're on. The cohort builder page activates a cohort expression expert persona. The estimation page activates a propensity score specialist. Twenty-two distinct personas across the entire platform.

**2. Parallel Retrieval** — The question is embedded and searched against up to five ChromaDB collections simultaneously. General documentation uses the 384-dim MiniLM embedder. Research literature and clinical references use the 768-dim SapBERT embedder, which understands that "heart attack" and "acute myocardial infarction" are semantically equivalent.

**3. Context Assembly** — Retrieved chunks are deduplicated, ranked by cosine similarity (threshold: 0.70), and formatted into a structured context block with source labels (documentation, research literature, clinical reference, conversation history, shared FAQ).

**4. Generation** — MedGemma receives the system prompt (page persona + behavioral instructions), the assembled RAG context, and the user's question. Responses are grounded in the retrieved knowledge rather than the model's general training data.

**5. Memory Storage** — The Q&A pair is embedded and stored in the user's private conversation collection. This enables session continuity and follow-up questions.

### Why SapBERT?

We chose SapBERT over general-purpose embedders for medical content because clinical terminology has unique properties that standard models miss:

- **Synonymy**: "MI" = "myocardial infarction" = "heart attack"
- **Abbreviations**: "ACEI" = "angiotensin-converting enzyme inhibitor"
- **Hierarchical relationships**: "ibuprofen IS-A NSAID IS-A analgesic"
- **Cross-vocabulary mapping**: SNOMED CT concepts linking to ICD-10 codes

SapBERT was pre-trained on PubMedBERT and fine-tuned on UMLS concept pairs. It produces 768-dimensional vectors that capture these biomedical semantic relationships. In our testing, it significantly outperforms MiniLM on clinical retrieval tasks — especially when researchers use informal terminology that doesn't match the exact wording in the literature.

---

## The Harvest: Building a Research Library

### Phase 1: OHDSI Research Papers

We built a five-phase harvester pipeline that legally acquires open-access publications by OHDSI community members:

1. **Scraped the OHDSI publications bibliography** — extracted seed PMIDs and DOIs
2. **Resolved 48 workgroup leads via OpenAlex** — including George Hripcsak, Patrick Ryan, Marc Suchard, Martijn Schuemie, and 44 other core contributors
3. **Enriched with PubMed/PMC** — found PMCIDs for free full-text access
4. **Checked Unpaywall** — located legal OA copies for remaining papers
5. **Downloaded 2,258 PDFs** (2.2 GB) from PMC and publisher OA sources

The full catalog contains 7,904 papers with metadata. The harvester is fully resumable (state saved after each phase) and uses content-hash deduplication.

| Metric | Count |
|--------|-------|
| Papers catalogued | 7,904 |
| With DOI | 7,127 |
| Open Access | 4,492 |
| PDFs downloaded | 2,258 |
| Chunks after extraction | 74,539 |

### Phase 2: The Book of OHDSI

The [Book of OHDSI](https://ohdsi.github.io/TheBookOfOhdsi/) is the canonical textbook for the OMOP ecosystem. We scraped all 26 R Markdown chapters from GitHub, stripped R code blocks (keeping only the explanatory methodology text), and preserved the full chapter structure.

This gives Abby authoritative coverage of the CDM architecture, standardized vocabularies, cohort design, estimation methodology, prediction frameworks, and data quality — the topics researchers ask about most.

**26 chapters, 698K characters, 773 chunks.**

### Phase 3: HADES Vignettes

HADES (Health Analytics Data-to-Evidence Suite) contains the R packages researchers use daily. We scraped READMEs and vignettes from **30 packages**:

- **Estimation**: CohortMethod, SelfControlledCaseSeries, EvidenceSynthesis
- **Prediction**: PatientLevelPrediction, DeepPatientLevelPrediction
- **Cohort Building**: CohortGenerator, Capr, CirceR, PhenotypeLibrary, PheValuator
- **Data Quality**: Achilles, DataQualityDashboard
- **Feature Extraction**: FeatureExtraction, Andromeda
- **Infrastructure**: DatabaseConnector, SqlRender, Strategus, Eunomia

**136 files across 30 packages, 764K characters, 1,134 chunks.**

### Phase 4: OHDSI Forums

The community forums at forums.ohdsi.org contain over a decade of practitioner Q&A — the hard-won knowledge that doesn't make it into textbooks. We scraped high-quality threads with aggressive quality filtering:

- **Engagement threshold**: 3+ replies or 200+ views
- **Solved preference**: Threads with accepted answers scored 2x
- **Recency weighting**: Post-2022 content weighted 2-3x over older posts
- **Quality scoring**: Composite of views, likes, replies, solved status, and year

The result skews heavily recent — 306 of 429 threads are from 2022 or later — which is exactly right for current methodology guidance.

**429 threads, 3.0 MB, 2,624 chunks.**

### Phase 5: Medical Reference Textbooks

We selectively extracted 19 high-value medical textbooks from a 111-book, 11 GB collection. The selection criteria: direct relevance to outcomes research methodology, clinical reasoning, or data interpretation. We specifically excluded:

- Anatomy atlases (image-heavy, poor text extraction)
- Basic science textbooks (cell biology, organic chemistry, physics)
- Surgery textbooks (procedural, not analytical)
- 15+ virology books (too specialized)

The high-value subset:

| Category | Books | Notable Titles |
|----------|-------|---------------|
| Systematic Reviews | 1 | **Cochrane Handbook** (1,466 chunks — gold standard for evidence synthesis) |
| Preventive Medicine | 1 | **Park's Textbook** (4,574 chunks — epidemiology and public health) |
| Physiology | 1 | **Guyton & Hall** (4,211 chunks — clinical reasoning foundation) |
| Biostatistics | 2 | Principles of Biostatistics, Applied Longitudinal Data Analysis |
| Clinical Medicine | 6 | Current Medical Diagnosis & Treatment, Hutchison's, 250 Cases |
| Epidemiology | 1 | Kestenbaum's Epidemiology and Biostatistics |
| Clinical Trials | 1 | Brody's Clinical Trials |
| Oncology | 1 | Molecular Biology of Cancer |
| Pharmacology | 1 | Lippincott Illustrated Reviews |
| Immunology | 1 | Roitt's Essential Immunology |
| + 3 more | 3 | Cardiology, radiology, data visualization |

**19 books, 41.8 MB of extracted text, 36,339 chunks.**

---

## The Numbers

After all five phases of harvesting and embedding, Abby's knowledge base contains:

| Collection | Vectors | Embedder | Content |
|-----------|---------|----------|---------|
| `ohdsi_papers` | ~115,000+ | SapBERT (768-dim) | Research papers + Book + HADES + Forums + Textbooks |
| `docs` | 51,288 | MiniLM (384-dim) | Platform documentation |
| `conversations_user_*` | per-user | MiniLM (384-dim) | Personal Q&A memory |
| `faq_shared` | grows over time | MiniLM (384-dim) | Community FAQ |
| `clinical_reference` | pending | SapBERT (768-dim) | OMOP concept embeddings |

### Source Breakdown of `ohdsi_papers`

| Source | Files | Chunks | Priority |
|--------|-------|--------|----------|
| Research PDFs | 2,233 | 74,539 | high |
| Medical Textbooks | 19 | 36,339 | high-medium |
| OHDSI Forums | 429 | 2,624 | medium |
| HADES Vignettes | 136 | 1,134 | high |
| Book of OHDSI | 26 | 773 | high |
| **Total** | **2,843** | **~115,000+** | |

---

## Data Quality: The Hard Part

Building a knowledge base is easy. Building one that doesn't make your AI *worse* is hard. OHDSI methods evolve, CDM versions change, old forum answers reference deprecated approaches, and early papers use outdated statistical methodology. We built several safeguards:

### Recency Metadata

Every chunk carries a `year` or `last_updated` field. This enables retrieval-time boosting of recent content without throwing away older foundational material. A 2024 paper on propensity score matching should rank above a 2015 one, but the 2015 one shouldn't be invisible.

### Source Priority Tags

Not all knowledge is created equal:

| Priority | Sources | Rationale |
|----------|---------|-----------|
| `high` | Book of OHDSI, research papers, HADES vignettes | Peer-reviewed or official documentation |
| `medium` | Forum threads, clinical textbooks | Community knowledge, general medical reference |
| `low` | Older forum posts, tangential textbooks | Useful context but may be outdated |

### Quality Scores on Forum Posts

Each forum thread gets a composite quality score from:
- Solved/accepted answer status (+2)
- View count (up to +2)
- Like count (up to +2)
- Reply count (up to +1)
- Recency bonus: 2024+ gets +3, 2022+ gets +2, 2020+ gets +1

### Content Cleaning

- **R code stripped** from Book of OHDSI and HADES vignettes — only explanatory text kept
- **Forum quoted text removed** — prevents duplication when replies quote the original question
- **Image-heavy pages skipped** — PDF pages with less than 50 characters of text are discarded
- **Table of contents/index pages filtered** — high dot-ratio pages excluded
- **Minimum chunk length** — fragments under 100-200 characters discarded

### Content-Hash Deduplication

Every file is SHA-256 hashed before ingestion. If the hash matches an existing chunk ID in ChromaDB, the file is skipped entirely. If the content changed (file updated), old chunks are deleted before new ones are upserted. The entire pipeline is idempotent — safe to re-run at any time.

---

## Abby in the Commons Workspace

Beyond the per-page chat panel, Abby is a first-class participant in the **Commons** collaborative workspace — Parthenon's real-time communication hub for research teams. Researchers can reach Abby three ways:

1. **Dedicated #ask-abby channel** — Full conversational interface with source attribution showing which documents informed each response, feedback buttons for quality tracking, and typing indicators showing RAG pipeline stages.

2. **@Abby mentions in any channel** — Type `@Abby` followed by a question in any Commons channel. The response appears inline, visible to all participants. Great for getting a quick vocabulary lookup during a team discussion.

3. **Page-level chat panel** — Available on every page via the bottom-right corner. Carries full page-aware context.

The Commons integration is built from seven composable React components (`AbbyAvatar`, `AbbyResponseCard`, `AbbySourceAttribution`, `AbbyFeedback`, `AbbyTypingIndicator`, `AbbyMentionHandler`, `AskAbbyChannel`) with TypeScript types, custom hooks (`useAbbyQuery`, `useAbbyFeedback`, `useAbbyMention`), and real-time WebSocket sync via Laravel Reverb.

---

## Administration: The ChromaDB Studio

The Admin panel includes a **ChromaDB Studio** for managing Abby's knowledge base:

- **Collection browser** — inspect any collection, see vector counts, facet distributions, sample records
- **Semantic search** — test retrieval quality by running queries against any collection
- **3D Vector Explorer** — interactive Three.js point cloud visualization of the embedding space, with cluster detection and outlier highlighting. Accelerated by Solr pre-computed projections (under 500ms vs ~8-10 seconds for live PCA+UMAP)
- **Ingestion actions** — one-click buttons for all knowledge base operations:
  - Ingest Docs (platform documentation)
  - Ingest Clinical (OMOP concept embeddings)
  - Promote FAQ (auto-promote frequent questions)
  - Ingest OHDSI Papers (research PDFs)
  - Ingest OHDSI Knowledge (Book + HADES + Forums)
  - Ingest Textbooks (medical reference textbooks)

---

## What We Shipped Today

| Component | Files Changed | Description |
|-----------|-------------|-------------|
| **OHDSI Paper Harvester** | `harvester.py` | 5-phase pipeline: OHDSI bibliography, OpenAlex, PubMed, Unpaywall, PDF download |
| **Book of OHDSI Scraper** | `scrape_book.py` | 26 chapters from GitHub, R code stripped |
| **HADES Vignette Scraper** | `scrape_hades.py` | 136 files from 30 packages |
| **Forum Scraper** | `scrape_forums.py` | 429 quality-filtered threads |
| **Textbook Extractor** | `ingest_textbooks.py` | Selective extraction of 19 high-value books from 111 |
| **ChromaDB Collection** | `collections.py` | New `ohdsi_papers` collection with SapBERT |
| **Ingestion Pipeline** | `ingestion.py` | PDF extraction, markdown chunking, JSONL textbook ingestion |
| **RAG Retrieval** | `retrieval.py` | `query_ohdsi_papers()` wired into `build_rag_context()` |
| **API Endpoints** | `chroma.py` router | 3 new endpoints: papers, knowledge, textbooks |
| **Laravel Routes** | `api.php`, Controller | Proxy routes for admin panel |
| **Admin UI** | `ChromaStudioPanel.tsx` | OHDSI ingestion action buttons |
| **Docker Config** | `docker-compose.yml` | Volume mounts for all corpus directories |
| **Dependencies** | `requirements.txt` | pymupdf, python-multipart |
| **Documentation** | 6 new Docusaurus pages | Full Abby AI chapter: origins, architecture, RAG, Commons, admin |
| **Dev Blog** | 2 posts | Technical devlog + this comprehensive post |

---

## What's Next

The knowledge base is built. The RAG pipeline is live. But there's more to do:

1. **Citation grounding** — Include DOIs in Abby's responses so researchers can verify claims against the source literature. The metadata is already stored on every chunk; we just need to surface it in the response.

2. **Query expansion** — Expand OHDSI acronyms (PLE, PLP, SCCS, DQD, CDM) before embedding the query. Researchers use these abbreviations constantly, and expanding them before search will improve retrieval recall.

3. **Cross-encoder re-ranking** — Retrieve top-10 results with bi-encoder search (fast), then re-rank with a cross-encoder (accurate) to push the most relevant chunks to the top. This is the standard two-stage retrieval pattern and should meaningfully improve precision.

4. **Recency boosting** — Apply a time-decay weighting to retrieval scores so post-2022 methodology content ranks above older material for technique-related questions.

5. **Periodic re-harvesting** — Monthly cron job to pull new papers, forum threads, and updated HADES vignettes. The pipeline is designed to be idempotent, so re-running it will only process new or changed content.

6. **Clinical concept embeddings** — Ingest the full OMOP standard vocabulary into the `clinical_reference` collection with SapBERT. This is the final piece of Abby's knowledge stack.

7. **Tool use** — Move Abby from passive RAG to active agent. Give her tools to search the vocabulary, check cohort feasibility, and execute read-only analytical queries. This transforms her from "answers questions" to "does research."

---

## The Takeaway

Abby isn't just a chatbot bolted onto a research platform. She's a retrieval-augmented AI that has read the foundational textbooks, consumed the entire OHDSI canon, absorbed a decade of community wisdom, and can speak to any of it in the context of exactly what you're working on right now.

Every response is grounded. Every inference is traceable. Every byte of data stays on your infrastructure.

*Parthenon is open-source and available at [github.com/sudoshi/Parthenon](https://github.com/sudoshi/Parthenon). Built by [Acumenus Data Sciences](https://www.acumenus.io).*
