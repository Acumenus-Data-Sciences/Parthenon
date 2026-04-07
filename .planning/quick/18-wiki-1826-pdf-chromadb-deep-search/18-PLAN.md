---
phase: quick-18
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ai/app/wiki/engine.py
  - ai/app/chroma/collections.py
  - scripts/wiki_batch_ingest.py
autonomous: true
requirements: [WIKI-SCALE-01, WIKI-SCALE-02, WIKI-SCALE-03]
must_haves:
  truths:
    - "All 1,826 OHDSI PDFs have LLM-generated wiki pages in the platform workspace"
    - "Both wiki summaries and full PDF text are searchable via ChromaDB"
    - "Wiki query() searches both wiki_pages and ohdsi_papers collections and merges results"
    - "Batch ingest is resumable — re-running skips already-processed papers"
    - "Every paper shows clean title, authors, abstract in its wiki page"
  artifacts:
    - path: "scripts/wiki_batch_ingest.py"
      provides: "Resumable batch ingest script for 1,826 PDFs"
      min_lines: 150
    - path: "ai/app/wiki/engine.py"
      provides: "Dual-collection search in query() and dual indexing in _upsert_page_to_chroma()"
    - path: "ai/app/chroma/collections.py"
      provides: "get_ohdsi_papers_collection() accessor (already exists, no change needed)"
  key_links:
    - from: "scripts/wiki_batch_ingest.py"
      to: "ai/app/wiki/engine.py"
      via: "Direct WikiEngine.ingest() calls"
      pattern: "engine\\.ingest\\("
    - from: "ai/app/wiki/engine.py"
      to: "ai/app/chroma/collections.py"
      via: "get_wiki_collection() and get_ohdsi_papers_collection()"
      pattern: "get_(wiki_collection|ohdsi_papers_collection)\\(\\)"
---

<objective>
Scale the wiki engine to ingest all 1,826 OHDSI PDFs from `OHDSI-scraper/OHDSI Papers/` with LLM-generated wiki pages, dual ChromaDB indexing (wiki summaries + full PDF text), and merged search across both collections.

Purpose: Enable Abby to answer detailed questions about ANY of the 1,826 OHDSI papers by searching both structured wiki summaries (general embedder) and raw PDF text (clinical SapBERT embedder).

Output: Batch ingest script with resume tracking, dual-collection indexing in engine, merged query results.
</objective>

<execution_context>
@/home/smudoshi/.claude/get-shit-done/workflows/execute-plan.md
@/home/smudoshi/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ai/app/wiki/engine.py
@ai/app/chroma/collections.py
@ai/app/chroma/ingestion.py
@ai/app/wiki/adapters/external.py
@ai/app/wiki/adapters/base.py
@ai/app/wiki/prompts.py

<interfaces>
<!-- Key types and contracts the executor needs -->

From ai/app/chroma/collections.py:
```python
def get_wiki_collection() -> Collection:
    """Wiki page chunks (384-dim, general embedder, cosine)."""

def get_ohdsi_papers_collection() -> Collection:
    """OHDSI papers (768-dim, SapBERT clinical embedder, cosine)."""
```

From ai/app/chroma/ingestion.py:
```python
def _upsert_resilient(collection, ids, documents, metadatas, chunk_size) -> None:
    """Batch upsert with exponential fallback on failure."""

def chunk_plain_text(text, chunk_size=1500, chunk_overlap=200) -> list[str]:
    """Split plain text into overlapping chunks at sentence boundaries."""

def content_hash(text: str) -> str:
    """Deterministic SHA-256 hash of text content."""
```

From ai/app/wiki/engine.py:
```python
class WikiEngine:
    async def ingest(self, *, workspace, filename, content_bytes, raw_content, title) -> WikiIngestResponse
    async def query(self, workspace, question) -> WikiQueryResponse
    def _upsert_page_to_chroma(self, *, workspace, slug, title, page_type, body, keywords, source_slug, source_type) -> None
    @staticmethod
    def _chunk_text(text, chunk_size=500, overlap=50) -> list[str]
```

From ai/app/wiki/adapters/external.py:
```python
class ExternalDocumentAdapter:
    def prepare_source(self, *, filename, content_bytes, raw_content, title) -> PreparedSource
    def _extract_pdf_text(self, content_bytes: bytes) -> str
    def _extract_pdf_title(self, content_bytes: bytes, content: str) -> str
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dual-collection indexing and merged query to WikiEngine</name>
  <files>ai/app/wiki/engine.py</files>
  <action>
Modify `_upsert_page_to_chroma()` to ALSO index the full page body into the `ohdsi_papers` collection (SapBERT clinical embedder) alongside the existing `wiki_pages` collection (general embedder). This gives two search angles: general semantic search on wiki summaries, and clinical-domain search on the same content.

Implementation:
1. In `_upsert_page_to_chroma()`, after the existing `wiki_pages` upsert, add a second upsert into `ohdsi_papers` collection:
   - Import `get_ohdsi_papers_collection` from `app.chroma.collections`
   - Import `chunk_plain_text` from `app.chroma.ingestion` for larger clinical chunks (1500 chars, 200 overlap) — better for clinical embedder
   - Use chunk IDs like `wiki::{workspace}:{slug}:chunk-{i}` to avoid collision with existing `ohdsi::` prefixed IDs
   - Include metadata: `source_file=slug`, `source="wiki_ingest"`, `title=title`, `workspace=workspace`
   - Delete old `wiki::` chunks for this slug before upserting (same pattern as wiki_pages)
   - Wrap in try/except — ohdsi_papers indexing failure should not block wiki_pages indexing

2. In `query()`, search BOTH collections and merge results:
   - After the existing `wiki_pages` ChromaDB query block, add a second query against `ohdsi_papers` collection
   - Query `ohdsi_papers` with `n_results=10` (no workspace filter — ohdsi_papers has papers from all sources)
   - From ohdsi_papers results, extract unique source_file values (these are PDF filenames or wiki slugs)
   - For results with `source="wiki_ingest"`, look up the slug in the workspace index and add to details
   - For results with `source="ohdsi_corpus"`, extract the document text directly and include as context (these don't have wiki pages yet or are full-text matches)
   - Deduplicate by slug — if a page was already found via wiki_pages, don't add it again
   - Increase the `prompt_context` body slice from 2500 to 4000 chars to give the LLM more context from dual sources
   - Add a `deep_context` string from ohdsi_papers raw chunks that didn't map to wiki pages — append this to the prompt context so the LLM can cite full-text passages

3. Keep the keyword fallback as-is for when both ChromaDB queries fail.
  </action>
  <verify>
    <automated>cd /home/smudoshi/Github/Parthenon/ai && python -c "from app.wiki.engine import WikiEngine; print('Import OK')"</automated>
  </verify>
  <done>WikiEngine._upsert_page_to_chroma() indexes into both wiki_pages and ohdsi_papers collections. WikiEngine.query() searches both collections and merges results with deduplication. Import succeeds without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Create resumable batch ingest script</name>
  <files>scripts/wiki_batch_ingest.py</files>
  <action>
Create a standalone Python script that ingests all 1,826 OHDSI PDFs into the wiki engine. This script calls the WikiEngine directly (not via HTTP API) to avoid Nginx timeouts.

Key requirements:
1. **PDF discovery:** Glob all `.pdf` files from a configurable source directory (default: `OHDSI-scraper/OHDSI Papers/`). Skip non-PDF files. Skip files larger than 25MB (poster sessions that produce garbage text).

2. **Resume manifest:** Maintain `ingest_manifest.json` in the wiki data dir (`/data/wiki/platform/`). Structure:
   ```json
   {
     "version": 1,
     "started_at": "ISO timestamp",
     "updated_at": "ISO timestamp",
     "total_files": 1826,
     "processed": {
       "filename.pdf": {
         "status": "success|error|skipped",
         "slug": "generated-slug",
         "pages_created": 5,
         "error": null,
         "processed_at": "ISO timestamp"
       }
     }
   }
   ```
   On startup, load existing manifest and skip files with status="success". This enables overnight runs that can be interrupted and resumed.

3. **Batch processing loop:**
   - Sort PDFs alphabetically for deterministic order
   - For each PDF: read bytes, call `engine.ingest(workspace="platform", filename=name, content_bytes=bytes, raw_content=None, title=None)`
   - Use `asyncio.run()` to call the async ingest method
   - Catch ALL exceptions per-file — log error, record in manifest as status="error", continue to next file
   - Save manifest to disk every 10 files (not every file — reduces I/O)
   - Print progress: `[42/1826] Ingested: "Paper Title" (3 pages, 12.3s)` or `[42/1826] ERROR: filename.pdf — reason`

4. **Git commit batching:** The wiki engine commits per-ingest. At scale this is fine since git handles many small commits. But add a `--no-git` flag that patches `wiki_commit` to be a no-op during batch mode (monkey-patch `app.wiki.git_ops.wiki_commit`). A single `git add -A && git commit` at the end is more efficient.

5. **CLI interface using argparse:**
   - `--source-dir PATH` — PDF directory (default: project-relative `OHDSI-scraper/OHDSI Papers/`)
   - `--workspace NAME` — wiki workspace (default: `platform`)
   - `--max-size-mb N` — skip PDFs larger than N MB (default: 25)
   - `--no-git` — disable per-ingest git commits, do one at end
   - `--dry-run` — list files that would be ingested, show counts, exit
   - `--retry-errors` — re-process files that previously errored
   - `--concurrency N` — number of concurrent ingests (default: 1, since Ollama is the bottleneck)

6. **Summary output:** At end, print:
   ```
   === Batch Ingest Complete ===
   Total:     1826
   Success:   1780
   Errors:    36
   Skipped:   10 (too large)
   Duration:  4h 32m
   ```

7. **Shebang and path setup:** Add `#!/usr/bin/env python3` and at top, insert the `ai/` directory into sys.path so `from app.wiki.engine import WikiEngine` works when running from project root.

8. **Signal handling:** Catch SIGINT/SIGTERM, save manifest, print summary, exit cleanly.

Note: The script should be runnable as: `python scripts/wiki_batch_ingest.py` from the project root, or `nohup python scripts/wiki_batch_ingest.py > /tmp/wiki-ingest.log 2>&1 &` for overnight runs.
  </action>
  <verify>
    <automated>cd /home/smudoshi/Github/Parthenon && python scripts/wiki_batch_ingest.py --dry-run --source-dir "OHDSI-scraper/OHDSI Papers/" 2>&1 | head -20</automated>
  </verify>
  <done>Batch script discovers all 1,826 PDFs, --dry-run shows the count and file list. Script handles resume via manifest, graceful error handling per-file, and signal handling for clean shutdown. Can be run overnight with nohup.</done>
</task>

<task type="auto">
  <name>Task 3: Add ohdsi_papers dual-index for full PDF text during batch ingest</name>
  <files>ai/app/wiki/engine.py</files>
  <action>
Enhance `_upsert_page_to_chroma()` to also index the ORIGINAL source PDF text (not just the wiki summary) into `ohdsi_papers`. The wiki summary is a condensed LLM-generated page; the full PDF text contains details the summary may omit (methods sections, statistical tables, supplementary data).

Implementation:
1. Add an optional `source_text` parameter to `_upsert_page_to_chroma()` (default None).
2. When `source_text` is provided AND `page_type == "source_summary"` (the main page for the ingested document):
   - Use `chunk_plain_text(source_text, chunk_size=1500, chunk_overlap=200)` to create clinical-sized chunks
   - Upsert into `ohdsi_papers` with IDs `wiki-fulltext::{workspace}:{source_slug}:chunk-{i}`
   - Metadata: `source_file=source_slug`, `source="wiki_fulltext"`, `title=title`, `workspace=workspace`
   - This ensures the full original text is searchable via SapBERT clinical embeddings
3. Pass the source text through from `_write_page()` to `_upsert_page_to_chroma()`:
   - Add `source_text` parameter to `_write_page()`
   - In the `ingest()` method, pass `source.content` as `source_text` when calling `_write_page()` for the source_summary page only
   - For non-source_summary pages (concept, method, etc.), pass `source_text=None`

This means each ingested PDF produces:
- `wiki_pages` collection: wiki summary chunks (general embedder, 500-char chunks)
- `ohdsi_papers` collection: wiki summary chunks (clinical embedder, 1500-char chunks) + full PDF text chunks (clinical embedder, 1500-char chunks)

The query() dual-search from Task 1 will find matches across all three chunk types.
  </action>
  <verify>
    <automated>cd /home/smudoshi/Github/Parthenon/ai && python -c "
from app.wiki.engine import WikiEngine
import inspect
sig = inspect.signature(WikiEngine._upsert_page_to_chroma)
assert 'source_text' in sig.parameters, 'Missing source_text param'
print('source_text param present in _upsert_page_to_chroma')
sig2 = inspect.signature(WikiEngine._write_page)
assert 'source_text' in sig2.parameters, 'Missing source_text param in _write_page'
print('source_text param present in _write_page')
print('All checks passed')
"</automated>
  </verify>
  <done>Full PDF source text is indexed into ohdsi_papers during ingest alongside wiki summaries. The _upsert_page_to_chroma and _write_page methods accept source_text parameter. Only source_summary pages trigger full-text indexing to avoid duplication.</done>
</task>

</tasks>

<verification>
1. `cd ai && python -c "from app.wiki.engine import WikiEngine; print('OK')"` — engine imports clean
2. `python scripts/wiki_batch_ingest.py --dry-run` — discovers 1,826 PDFs, shows summary
3. `python scripts/wiki_batch_ingest.py --source-dir "OHDSI-scraper/OHDSI Papers/" --no-git --max-size-mb 25` — ingests papers (run overnight)
4. After partial ingest, re-run same command — resumes from manifest, skips completed files
5. After ingest, wiki query "What is the OHDSI approach to drug safety surveillance?" returns citations from multiple papers with both summary and full-text matches
</verification>

<success_criteria>
- Batch script ingests all 1,826 PDFs with LLM-generated wiki pages
- Resume works — interrupted runs continue from last successful file
- Errors on individual PDFs don't crash the batch
- Wiki query() searches both wiki_pages AND ohdsi_papers collections
- Full PDF text is searchable via clinical SapBERT embeddings
- Script runnable as background process for overnight execution
</success_criteria>

<output>
After completion, create `.planning/quick/18-wiki-1826-pdf-chromadb-deep-search/18-SUMMARY.md`
</output>
