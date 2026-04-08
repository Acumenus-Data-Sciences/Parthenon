# Wiki Rebuild Handoff: Fresh Corpus Ingestion

**Date:** 2026-04-07
**Author:** Sanjay Udoshi (via Claude)
**Status:** Ready for execution

---

## Mission

Delete all existing wiki content and rebuild from scratch using the curated 982-paper OHDSI corpus at `OHDSI-scraper/corpus/`. The goal is a clean, well-tagged, searchable knowledge base that Abby (the AI assistant) can use to ground answers in peer-reviewed OHDSI/OMOP literature.

---

## 1. What You're Working With

### 1.1 New Corpus (Source of Truth)

```
OHDSI-scraper/corpus/
  pdfs/          — 982 PDF files (1.6 GB)
  metadata.csv   — 982 rows with bibliographic metadata
```

**Metadata CSV columns:**
| Column | Description | Coverage |
|--------|-------------|----------|
| DOI | Digital Object Identifier | 100% (982/982) |
| PMID | PubMed ID | 35% (341/982) |
| PMCID | PubMed Central ID | 35% |
| Title | Full paper title | 100% |
| Authors | Full author list | 99% (969/982) |
| First Author | First author surname + initial | 99% |
| Journal | Journal or book name | 99% |
| Publication Year | Year published | 99% |
| Create Date | PubMed create date | 35% |
| Citation | Full citation string | 4% |
| Source | Origin: `ohdsi_papers (crossref)`, `validated_oa_corpus`, or `both` | 100% |
| Filename | PDF filename in `corpus/pdfs/` | 100% |
| File Size Bytes | PDF file size | 100% |
| Page Count | Number of pages | 100% |
| SHA256 | File hash for dedup | 100% |
| PDF Title | Embedded PDF title metadata | ~70% |
| PDF Author | Embedded PDF author metadata | ~30% |
| PDF Subject | Embedded PDF subject field | ~20% |
| PDF Keywords | Embedded PDF keyword field | ~15% |

### 1.2 Current Wiki State (To Be Deleted)

```
data/wiki/platform/
  index.md              — 156 entries (markdown table)
  log.md                — Activity log
  ingest_manifest.json  — Processing manifest
  sources/              — 206 PDF files
  wiki/
    source_summaries/   — 197 markdown files
    concepts/           — 284 markdown files
    entities/           — empty
    comparisons/        — empty
    analyses/           — empty
```

**ChromaDB collection to clear:** `wiki_pages` (SapBERT 768-dim, cosine)

### 1.3 Key Files You'll Modify or Interact With

| File | Role |
|------|------|
| `ai/app/wiki/engine.py` | Core ingest/query engine — `ingest()` at line 124, `_write_page()` at line 663, `_upsert_page_to_chroma()` at line 611, `_chunk_text()` at line 596 |
| `ai/app/wiki/prompts.py` | LLM prompts for ingest and query — `build_ingest_prompt()` at line 6 |
| `ai/app/wiki/index_ops.py` | Index file I/O — `IndexEntry` dataclass, `read_index()`, `upsert_index_entry()` |
| `ai/app/wiki/adapters/external.py` | PDF text extraction via PyMuPDF (`fitz`) |
| `ai/app/wiki/adapters/base.py` | `slugify()`, `build_frontmatter()`, `PreparedSource` |
| `ai/app/wiki/git_ops.py` | `WORKSPACE_PAGE_DIRS`, `wiki_commit()` |
| `ai/app/wiki/log_ops.py` | Activity log append |
| `ai/app/wiki/models.py` | Pydantic models for API responses |
| `ai/app/chroma/collections.py` | `get_wiki_collection()` — the `wiki_pages` collection accessor |
| `ai/app/chroma/ingestion.py` | `_upsert_resilient()` for batch ChromaDB writes |
| `ai/app/chroma/embeddings.py` | `ClinicalEmbedder` (SapBERT, 768-dim) and `GeneralEmbedder` (MiniLM, 384-dim) |
| `ai/app/routers/wiki.py` | FastAPI endpoints — `POST /wiki/ingest` at line 73 |
| `data/wiki/platform/` | On-disk wiki workspace root |

---

## 2. Step-by-Step Execution Plan

### Phase 1: Delete Everything

1. **Clear the wiki_pages ChromaDB collection:**
   ```python
   # From Python or via the chroma API
   from app.chroma.client import get_chroma_client
   client = get_chroma_client()
   try:
       client.delete_collection("wiki_pages")
   except Exception:
       pass
   ```
   Or via HTTP: `DELETE http://localhost:8000/api/v1/collections/wiki_pages`

   **Important:** Also clear the collection handle cache in `collections.py` by calling `clear_cached_collection("wiki_pages")` or just restart the Python AI service after deletion.

2. **Delete all wiki filesystem content:**
   ```bash
   cd /home/smudoshi/Github/Parthenon/data/wiki/platform

   # Remove all generated wiki pages
   rm -rf wiki/source_summaries/*
   rm -rf wiki/concepts/*
   rm -rf wiki/entities/*
   rm -rf wiki/comparisons/*
   rm -rf wiki/analyses/*

   # Remove ingested source PDFs
   rm -rf sources/*

   # Reset index to empty
   cat > index.md << 'EOF'
   # Wiki Index

   | type | title | slug | path | keywords | links | updated_at | source_slug | source_type | ingested_at |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   EOF

   # Reset activity log
   cat > log.md << 'EOF'
   # Activity Log

   | timestamp | action | target | message |
   | --- | --- | --- | --- |
   EOF

   # Reset manifest
   echo '{"version": 1}' > ingest_manifest.json
   ```

3. **Commit the clean state:**
   ```bash
   cd /home/smudoshi/Github/Parthenon
   git add data/wiki/platform/
   git commit -m "chore(wiki): clear all wiki content for corpus rebuild"
   ```

### Phase 2: Enhance the Ingest Pipeline

Before ingesting 982 papers, the pipeline needs to be enhanced to carry the rich bibliographic metadata from `metadata.csv` through to the wiki pages and ChromaDB chunks. Currently the system extracts titles from PDFs and generates generic keywords — we have much better data.

#### 2.1 Enhance the Ingest Prompt (`ai/app/wiki/prompts.py`)

Update `build_ingest_prompt()` to accept and use bibliographic metadata:

```python
def build_ingest_prompt(
    schema: str,
    workspace: str,
    source_title: str,
    source_text: str,
    *,
    doi: str = "",
    authors: str = "",
    journal: str = "",
    publication_year: str = "",
) -> str:
```

Include the metadata in the prompt so the LLM can use real titles/authors instead of guessing from noisy PDF text. Add an instruction block like:

```
Bibliographic metadata (authoritative — use this over any text you extract):
- Title: {source_title}
- Authors: {authors}
- Journal: {journal}
- Year: {publication_year}
- DOI: {doi}
```

The LLM should use this metadata for the Authors section and title rather than trying to parse it from raw PDF text (which often has broken formatting, superscripts, affiliations mixed in).

#### 2.2 Enhance Frontmatter and Index

**Add these fields to page frontmatter** (in `_write_page()` and `build_frontmatter()`):

```yaml
---
title: "Paper Title"
slug: paper-slug
type: concept
keywords: [OMOP, cohort, pharmacovigilance]
links: []
updated_at: 2026-04-07T20:00:00+00:00
source_title: "Paper Title"
doi: "10.1234/example"
authors: "Smith J, Jones K, Brown L"
first_author: "Smith J"
journal: "Journal Name"
publication_year: "2024"
pmid: "12345678"
pmcid: "PMC1234567"
---
```

**Add corresponding columns to `index_ops.py`:**

Update `INDEX_HEADER` and `IndexEntry` dataclass to include: `doi`, `authors`, `first_author`, `journal`, `publication_year`, `pmid`, `pmcid`.

This is critical because:
- Abby's query path uses `search_index()` for keyword fallback — having authors, journal, and year in the index makes these searchable
- The frontend sidebar displays page metadata — users need to see authors and year
- ChromaDB chunk metadata carries these fields for filtered retrieval

#### 2.3 Enhance ChromaDB Chunk Metadata

Update `_upsert_page_to_chroma()` to include bibliographic metadata in each chunk's metadata dict:

```python
metadatas.append({
    "workspace": workspace,
    "slug": slug,
    "title": title,
    "page_type": page_type,
    "keywords": ", ".join(keywords),
    "source_slug": source_slug or "",
    "source_type": source_type or "",
    "chunk_index": i,
    # NEW: bibliographic metadata for filtering and attribution
    "doi": doi,
    "authors": first_author,  # First author only (ChromaDB metadata value size limit)
    "journal": journal,
    "publication_year": publication_year,
})
```

This enables:
- **Year-filtered queries:** "What papers from 2024 discuss..." → filter by `publication_year`
- **Author-filtered queries:** "What did Schuemie publish on..." → filter by `authors`
- **Journal-filtered queries:** "Papers from JAMIA about..." → filter by `journal`
- **Citation attribution:** When Abby cites a chunk, the response can include DOI/author/year

### Phase 3: Build the Batch Ingest Script

Create a new script `ai/app/wiki/batch_ingest.py` (or a management command) that:

1. **Reads `OHDSI-scraper/corpus/metadata.csv`** to get bibliographic metadata for each PDF
2. **For each of the 982 papers**, calls the ingest pipeline with the PDF bytes + metadata
3. **Passes metadata through** to the enhanced `ingest()` method
4. **Handles failures gracefully** — log errors, continue to next paper, report summary at end
5. **Batches git commits** — don't commit after every single paper (982 commits would be absurd). Commit every 50 papers or at the end.
6. **Rate-limits LLM calls** — if using Claude API, respect rate limits. If using Ollama, no rate limit needed but expect ~30-60 seconds per paper.

**Estimated time:** At ~45 seconds per paper via Ollama, 982 papers = ~12 hours. Consider:
- Running overnight
- Using Claude API for faster processing (but costs ~$15-30 for 982 papers)
- Parallelizing with 2-3 concurrent workers (if Ollama has capacity)

**Script outline:**

```python
import asyncio
import csv
from pathlib import Path

CORPUS_DIR = Path("OHDSI-scraper/corpus")
METADATA_CSV = CORPUS_DIR / "metadata.csv"
PDFS_DIR = CORPUS_DIR / "pdfs"

async def batch_ingest():
    engine = WikiEngine()
    
    with open(METADATA_CSV) as f:
        rows = list(csv.DictReader(f))
    
    successes, failures = 0, 0
    for i, row in enumerate(rows):
        pdf_path = PDFS_DIR / row["Filename"]
        if not pdf_path.exists():
            continue
        
        try:
            # Enhanced ingest call with metadata
            await engine.ingest(
                workspace="platform",
                filename=row["Filename"],
                content_bytes=pdf_path.read_bytes(),
                raw_content=None,
                title=row["Title"],  # Use authoritative title from metadata
                # Pass new metadata fields:
                doi=row["DOI"],
                authors=row["Authors"],
                first_author=row["First Author"],
                journal=row["Journal"],
                publication_year=row["Publication Year"],
                pmid=row.get("PMID", ""),
                pmcid=row.get("PMCID", ""),
            )
            successes += 1
        except Exception as e:
            failures += 1
            print(f"  FAILED [{i+1}]: {row['Title'][:60]} — {e}")
        
        if (i + 1) % 50 == 0:
            print(f"Progress: {i+1}/{len(rows)} ({successes} ok, {failures} failed)")
    
    print(f"Done: {successes} ingested, {failures} failed out of {len(rows)}")
```

### Phase 4: Tagging Strategy

The current system generates generic keywords like `OMOP, cohort, data quality` via the LLM during ingest. For 982 papers this is inconsistent and shallow. Implement a structured tagging taxonomy.

#### 4.1 Primary Domain Tags (Mutually Exclusive)

Every paper gets exactly ONE primary domain tag based on its content:

| Tag | Description | Detection Signal |
|-----|-------------|-----------------|
| `population-level-estimation` | Comparative effectiveness, drug safety studies | "comparative", "cohort method", "propensity score", "new-user" |
| `patient-level-prediction` | Predictive models, risk scores, ML on EHR | "prediction", "AUROC", "calibration", "machine learning" |
| `characterization` | Descriptive studies, Achilles, data profiling | "characterization", "Achilles", "descriptive", "prevalence" |
| `data-quality` | DQD, data validation, ETL quality | "data quality", "DQD", "completeness", "plausibility" |
| `vocabulary-mapping` | OMOP vocabulary, concept mapping, SNOMED/RxNorm | "vocabulary", "concept mapping", "SNOMED", "RxNorm", "terminology" |
| `etl-cdm` | ETL processes, CDM conversion, data transformation | "ETL", "common data model", "CDM", "transformation" |
| `methods-statistics` | Statistical methodology, study design, causal inference | "methodology", "calibration", "empirical", "negative controls" |
| `network-studies` | Multi-site OHDSI network studies, federated analyses | "network study", "distributed", "multi-site", "multi-database" |
| `pharmacovigilance` | Drug safety surveillance, adverse events, signal detection | "pharmacovigilance", "adverse", "signal detection", "FAERS" |
| `clinical-applications` | Specific disease studies (COVID, diabetes, cardio, etc.) | Disease-specific terms, clinical outcome studies |
| `infrastructure-tools` | OHDSI tools, Atlas, WebAPI, HADES packages | "Atlas", "WebAPI", "HADES", "R package", "software" |
| `policy-governance` | Data governance, privacy, regulatory, ethics | "governance", "privacy", "regulatory", "ethics", "policy" |

#### 4.2 Secondary Tags (Multiple Allowed)

Each paper gets 3-7 secondary tags from a controlled vocabulary:

**Disease/Condition tags:** `covid-19`, `diabetes`, `cardiovascular`, `cancer`, `respiratory`, `neurological`, `psychiatric`, `renal`, `gastrointestinal`, `musculoskeletal`, `infectious-disease`, `autoimmune`, `ophthalmology`, `pediatric`, `geriatric`

**Method tags:** `cohort-study`, `case-control`, `self-controlled`, `meta-analysis`, `machine-learning`, `deep-learning`, `nlp`, `propensity-score`, `negative-controls`, `time-series`, `survival-analysis`, `bayesian`

**Data tags:** `claims-data`, `ehr-data`, `registry-data`, `multi-database`, `synthetic-data`, `imaging`, `genomics`, `biobank`

**OHDSI-specific tags:** `omop-cdm`, `ohdsi-tools`, `atlas`, `achilles`, `cohort-diagnostics`, `feature-extraction`, `plp-package`, `cohort-method-package`, `book-of-ohdsi`

#### 4.3 Tag Assignment Strategy

**Option A: LLM-based tagging (recommended)**

After the LLM generates the concept page body, make a second LLM call with a classification prompt:

```
Given this paper summary, assign tags from the controlled vocabulary below.

Return JSON: {"primary_domain": "one-tag", "secondary_tags": ["tag1", "tag2", ...]}

Primary domains (pick exactly one): [list]
Secondary tags (pick 3-7): [list]

Paper title: {title}
Paper summary: {body[:3000]}
Journal: {journal}
Keywords from PDF: {pdf_keywords}
```

**Option B: Rule-based tagging**

Use regex/keyword matching on the paper title + extracted text against the tag vocabulary. Faster but less accurate. Good as a fallback or first pass.

**Option C: Hybrid (best)**

Run rule-based tagging first for high-confidence matches, then use LLM only for papers where the rule-based tagger is uncertain (< 2 secondary tags matched).

#### 4.4 Where Tags Are Stored

1. **Frontmatter** — `keywords` field becomes the secondary tags; add `primary_domain` as a new field
2. **Index table** — `keywords` column carries all tags (comma-separated)
3. **ChromaDB metadata** — `primary_domain` and `keywords` fields on each chunk

This enables:
- **Sidebar filtering:** Frontend can group/filter by primary domain
- **Scoped queries:** "Show me all pharmacovigilance papers" → index keyword search
- **Semantic + filtered RAG:** ChromaDB `where={"primary_domain": "patient-level-prediction"}` + semantic similarity

### Phase 5: Verify and Deploy

1. **Verify the rebuild:**
   ```bash
   # Count wiki pages
   grep -c "^|" data/wiki/platform/index.md
   # Should be close to 982 * 2 (one source_summary + one concept per paper) = ~1964

   # Verify ChromaDB
   curl http://localhost:8000/api/v1/collections/wiki_pages | python3 -m json.tool
   # Check count is non-zero

   # Test Abby query
   curl -X POST http://localhost:8002/wiki/query \
     -H "Content-Type: application/json" \
     -d '{"workspace":"platform","question":"What is the OMOP Common Data Model?"}'
   ```

2. **Test streaming:**
   ```bash
   curl -N -X POST http://localhost:8002/wiki/query/stream \
     -H "Content-Type: application/json" \
     -d '{"workspace":"platform","question":"How does Achilles characterize data sources?"}'
   ```

3. **Rebuild frontend and deploy:**
   ```bash
   cd /home/smudoshi/Github/Parthenon
   ./deploy.sh --frontend
   # Restart AI service
   docker compose restart python-ai
   ```

4. **Smoke test in browser:** Open https://parthenon.acumenus.net, go to Wiki, verify:
   - Sidebar shows papers sorted by `ingested_at` (newest first)
   - Clicking a paper shows its concept page with Authors, Key Findings, Methods
   - Chat works — ask "What papers discuss COVID-19 outcomes?" and get cited answers
   - PDF viewer works — clicking "View Source" opens the PDF

---

## 3. Embedding Strategy Deep Dive

### How It Works Now

```
PDF → fitz text extraction → LLM prompt (12K chars) → JSON with concept page
                                                          ↓
                                              body text (markdown)
                                                          ↓
                                              _chunk_text(body, 500, 50)
                                                          ↓
                                              ChromaDB wiki_pages collection
                                              (SapBERT 768-dim, cosine)
                                              metadata: workspace, slug, title,
                                                        page_type, keywords,
                                                        source_slug, source_type,
                                                        chunk_index
```

### What Should Change

1. **Chunk size increase:** 500 chars is too small for academic papers — sentences get split mid-thought. Increase to **800 chars with 100-char overlap**. This gives roughly 1-2 paragraphs per chunk, which is better for SapBERT's context window and produces more coherent retrieval.

2. **Title prepend stays:** Each chunk already prepends `f"{title}\n\n{chunk}"` before embedding. This is good — it ensures every chunk carries the paper identity into the embedding space.

3. **Metadata enrichment:** Add `doi`, `first_author`, `journal`, `publication_year`, `primary_domain` to chunk metadata (see Phase 2.3 above).

4. **Query-time filtering:** Update `_query_chroma_slugs()` in `engine.py` line 895 to accept optional filters:
   ```python
   # Example: filter by year range
   where_filter = {"$and": [
       {"workspace": workspace},
       {"publication_year": {"$gte": "2020"}},
   ]}
   ```

5. **Dual collection strategy:** The `ohdsi_papers` collection (also SapBERT 768-dim) already exists and is used by Abby's general RAG pipeline. The `wiki_pages` collection is used by the wiki-specific query path. After rebuild, both collections will contain overlapping content but with different chunking strategies:
   - `ohdsi_papers`: 1500-char chunks, coarse, for broad Abby RAG
   - `wiki_pages`: 800-char chunks with rich metadata, for wiki-specific queries

   **Decision needed:** Should the `ohdsi_papers` collection also be rebuilt from the same 982-paper corpus? Currently it may contain different/older papers. If so, clear and re-ingest it too (uses `ai/app/chroma/ingestion.py` path, not wiki engine).

---

## 4. What Abby Needs to Be Good at Answering

The wiki exists so Abby can answer questions like:

- "What OHDSI studies have looked at GLP-1 agonists?" → needs journal/author/year metadata + disease tags
- "How do you implement negative controls in a cohort study?" → needs methods tags
- "Compare the SCCS and cohort designs for vaccine safety" → needs domain tags for pharmacovigilance + methods
- "What did Schuemie et al. publish about empirical calibration?" → needs author search
- "Show me recent 2024 papers on patient-level prediction" → needs year + domain filtering
- "What's the standard approach for ETL to OMOP CDM?" → needs etl-cdm domain tag

Without structured tags, Abby relies purely on semantic similarity, which works for direct matches but fails for:
- Author-based queries (no author in embeddings)
- Year-range queries (no temporal filtering)
- Domain browsing ("show me all pharmacovigilance papers")
- Cross-paper synthesis ("compare methods across these 3 studies")

The tagging and metadata enrichment in this handoff closes those gaps.

---

## 5. Risks and Gotchas

1. **LLM throughput:** 982 papers * ~45s each = ~12 hours via Ollama. Plan for overnight run. If using Claude API, budget ~$15-30 (at ~$0.02/paper for ingest prompt + tag prompt).

2. **PDF text quality:** Some PDFs are scanned images (no extractable text). The existing `fitz` extraction handles most cases, but expect 5-10% of papers to produce poor/empty text. The batch script should log these and continue.

3. **Title cleanup:** CrossRef titles may contain HTML/XML fragments like `<scp>` tags (see metadata.csv). Strip these before ingesting: `re.sub(r'<[^>]+>', '', title)`.

4. **Git repo size:** 982 PDFs in `data/wiki/platform/sources/` will add ~1.6 GB to the git repo. Consider whether source PDFs should be gitignored and stored outside the repo, or if the current approach (git-tracked) is acceptable.

5. **ChromaDB memory:** 982 papers * ~20 chunks each * 768-dim embeddings = ~15M floats = ~60 MB of vectors. Well within the 6 GB ChromaDB memory limit.

6. **Index.md size:** 1964 rows (2 per paper) in a markdown table will make `index.md` ~500 KB. The `read_index()` function reads it fully on every call. This is fine for now but could become slow at 5000+ entries. Not a concern for 982 papers.

7. **Docker volume:** The `chromadb-data` Docker volume persists across `docker compose down`. Deleting the collection via API is sufficient — you don't need to nuke the volume.

8. **Test before announcing done:** Per project rules, curl and verify the wiki API endpoints, test a streaming query, and confirm the frontend renders correctly before declaring the rebuild complete.

---

## 6. Success Criteria

- [ ] `data/wiki/platform/index.md` has ~1964 entries (982 source_summaries + 982 concepts)
- [ ] Every entry has `doi`, `authors`, `journal`, `publication_year` in frontmatter
- [ ] Every concept page has a `primary_domain` tag and 3-7 secondary keyword tags
- [ ] ChromaDB `wiki_pages` collection has >15,000 chunks with enriched metadata
- [ ] `POST /wiki/query` returns relevant, cited answers for test queries
- [ ] `POST /wiki/query/stream` streams tokens correctly
- [ ] Wiki sidebar shows papers sorted by `ingested_at`
- [ ] No old/stale content remains from previous wiki
- [ ] Frontend renders the new wiki pages correctly
- [ ] Git commit(s) capture the full rebuild

---

## 7. Files to Read Before Starting

In priority order:

1. `ai/app/wiki/engine.py` — the entire file, especially `ingest()`, `_write_page()`, `_upsert_page_to_chroma()`, `_chunk_text()`, `_query_chroma_slugs()`
2. `ai/app/wiki/prompts.py` — both `build_ingest_prompt()` and `build_query_prompt()`
3. `ai/app/wiki/index_ops.py` — `IndexEntry`, `INDEX_HEADER`, `read_index()`, `upsert_index_entry()`
4. `ai/app/wiki/adapters/base.py` — `slugify()`, `build_frontmatter()`, `PreparedSource`
5. `ai/app/wiki/adapters/external.py` — PDF extraction, title detection
6. `ai/app/chroma/collections.py` — `get_wiki_collection()`, `clear_cached_collection()`
7. `ai/app/chroma/ingestion.py` — `_upsert_resilient()` batch upsert
8. `ai/app/chroma/embeddings.py` — `ClinicalEmbedder` (SapBERT)
9. `ai/app/routers/wiki.py` — API endpoints
10. `OHDSI-scraper/corpus/metadata.csv` — the source metadata

---

## 8. Summary

| What | Before | After |
|------|--------|-------|
| Papers | ~206 (mixed quality, some junk titles) | 982 (curated, all with DOI + title) |
| Metadata | Title + 3-5 generic keywords | DOI, PMID, authors, journal, year, domain tags |
| ChromaDB chunks | ~3,000 (500-char, minimal metadata) | ~20,000 (800-char, rich metadata) |
| Tagging | Generic LLM-generated keywords | Structured taxonomy: 12 primary domains + controlled secondary tags |
| Searchability | Semantic only | Semantic + keyword + author + year + domain filtering |
| Abby quality | Often generic answers | Specific, cited, filterable answers |
