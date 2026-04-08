# OHDSI Paper Harvester for Abby Training Corpus

A multi-phase Python pipeline to discover and download publications by OHDSI
workgroup members using **only open and legal sources**.

## Architecture

```
Phase 1: Scrape OHDSI publications page -> PMIDs, DOIs, author names
Phase 2: Resolve authors via OpenAlex -> discover all their publications  
Phase 3: Enrich with PubMed/PMC Entrez -> find PMCIDs for OA full text
Phase 4: Check Unpaywall -> find legal OA copies for remaining papers
Phase 5: Download PDFs from PMC, publisher OA, and Unpaywall sources
```

## Data Sources

| Source | What it provides | Rate limit | Auth required? |
|--------|-----------------|------------|----------------|
| OHDSI Publications page | Seed bibliography (~700+ papers) | N/A | No |
| OpenAlex API | Author resolution + all their works | ~10 req/s (polite) | Free API key recommended |
| PubMed/PMC Entrez | PMCID lookups for free full text | 3-10 req/s | API key optional |
| Unpaywall | Legal OA PDF URLs for paywalled papers | 10 req/s | Email only |
| PMC OA Subset | Free full-text PDFs | Generous | No |

## Setup

### 1. Install dependencies

```bash
pip install requests beautifulsoup4
```

### 2. Configure environment variables

```bash
# REQUIRED: Your email (for Unpaywall ToS and OpenAlex polite pool)
export HARVESTER_EMAIL="sanjay@acumenus.net"

# RECOMMENDED: Free OpenAlex API key (get at https://openalex.org/login)
export OPENALEX_API_KEY="your_key_here"

# OPTIONAL: NCBI API key for faster PubMed access (10 vs 3 req/s)
# Get one at: https://www.ncbi.nlm.nih.gov/account/settings/
export NCBI_API_KEY="your_key_here"
```

### 3. Run the pipeline

```bash
# Full pipeline
python harvester.py --email sanjay@acumenus.net

# Test with a small author sample first
python harvester.py --email sanjay@acumenus.net --author-limit 5

# Metadata only (skip PDF downloads)
python harvester.py --email sanjay@acumenus.net --skip-download

# Resume from a specific phase
python harvester.py --email sanjay@acumenus.net --start-phase 3

# Custom output directory
python harvester.py --email sanjay@acumenus.net --output-dir /data/ohdsi_corpus
```

## Output Structure

```
ohdsi_corpus/
├-- pdfs/                          # Downloaded PDF files
│   ├-- 10.1234_example.pdf
│   └-- ...
├-- metadata/
│   ├-- state_phase1.json          # State after Phase 1 (resumable)
│   ├-- state_phase2.json          # State after Phase 2
│   ├-- state_phase3.json          # ...
│   ├-- state_phase4.json
│   ├-- state_phase5.json          # Final state with PDF paths
│   ├-- papers_phase1.csv          # Quick-inspect CSV
│   └-- papers_phase5.csv          # Final summary CSV
└-- harvester.log                  # Full log
```

## Validated CSV Downloader

If you already have validated PubMed-style CSVs with free full text articles,
use the dedicated downloader instead of re-scraping:

```bash
# Dedupe only, no network calls
python OHDSI-scraper/download_validated_papers.py --manifest-only

# Resolve PMC/Unpaywall and download PDFs
python OHDSI-scraper/download_validated_papers.py \
  --email sanjay@acumenus.net
```

Default inputs are `OHDSI-scraper/csv-*.csv`. The script writes:

- `validated_oa_corpus/metadata/deduped_manifest.csv`
- `validated_oa_corpus/metadata/duplicate_groups.csv`
- `validated_oa_corpus/metadata/summary.json`
- `validated_oa_corpus/metadata/downloaded_paper_metadata.csv`
- `validated_oa_corpus/pdfs/*.pdf`

To extract a CSV metadata inventory from the downloaded PDFs:

```bash
python OHDSI-scraper/extract_downloaded_metadata.py
```

## Estimated Yield

Based on the OHDSI community structure:

| Metric | Estimate |
|--------|----------|
| OHDSI bibliography papers | ~700+ |
| Unique workgroup lead authors | ~50-100 |
| Total unique papers (all authors) | ~5,000-15,000 |
| Open Access (PMC + Unpaywall) | ~40-60% |
| Downloadable PDFs | ~2,000-9,000 |

## Expanding the Author List

The pipeline includes a curated list of ~45 known workgroup leads. To expand:

1. **Scrape the OHDSI Teams directory** -- join the MS Teams environment and
   export the member list
2. **Mine the OHDSI Forum** -- scrape forums.ohdsi.org for active contributor
   usernames and match to publications
3. **Use OpenAlex co-author graphs** -- for each resolved author, pull their
   co-authors who also publish OHDSI-tagged work
4. **OHDSI Collaborator Showcase posters** -- parse poster author lists from
   symposium archives

## Training Corpus Prep for Abby

After downloading, you'll want to:

1. **Extract text from PDFs**: Use `pymupdf` or `pdfplumber` for text extraction
2. **Convert to training format**: Chunk into passages, add metadata (title, authors, year, DOI)
3. **Deduplicate**: Some papers may appear in multiple author feeds
4. **Quality filter**: Remove papers with poor text extraction (scanned, image-heavy)

Example text extraction add-on:

```python
import fitz  # pymupdf

def extract_text(pdf_path):
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text
```

## Legal Notes

This pipeline uses **only legal, open-access sources**:
- PMC Open Access Subset: explicitly licensed for text mining
- Unpaywall: indexes legal OA copies only  
- OpenAlex: open metadata, no content downloads without API key
- Publisher OA: uses publisher-provided open access URLs

No paywalled content is accessed or downloaded.

## Troubleshooting

- **"Could not resolve author"**: Name disambiguation is hard. Add ORCIDs to
  `get_known_workgroup_leads()` for better matching.
- **Low PDF yield**: Many clinical journals are paywalled. Focus on PMC-indexed
  papers for highest yield.
- **Rate limited**: Reduce request rates in CONFIG or add API keys.
- **Resuming after failure**: Use `--start-phase N` to resume from the last
  completed phase.
