#!/usr/bin/env python3
"""
OHDSI Paper Harvester for Abby Training Corpus
================================================
A multi-phase pipeline to discover and download publications by OHDSI
workgroup members, using open and legal sources only.

Architecture:
  Phase 1: Scrape OHDSI publications page -> extract PMIDs, DOIs, authors
  Phase 2: Resolve authors via OpenAlex API -> get all their publications
  Phase 3: Enrich with PubMed/PMC Entrez -> find PMCIDs for open-access PDFs
  Phase 4: Check Unpaywall -> find legal OA copies for remaining papers
  Phase 5: Download PDFs from PMC OA, publisher OA, and Unpaywall sources

Requirements:
  pip install requests beautifulsoup4

Configuration:
  - Set UNPAYWALL_EMAIL to your email (required by Unpaywall API ToS)
  - Set OPENALEX_EMAIL for polite pool (faster rate limits)
  - Optionally set OPENALEX_API_KEY for premium features
  - Set NCBI_API_KEY for higher Entrez rate limits (optional but recommended)
"""

import json
import os
import re
import sys
import time
import hashlib
import logging
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field, asdict
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

# --- Configuration ------------------------------------------------------------

CONFIG = {
    # YOUR email -- required by Unpaywall ToS, used for OpenAlex polite pool
    "email": os.environ.get("HARVESTER_EMAIL", "your-email@example.com"),
    # Optional: OpenAlex API key for premium features (content download, etc.)
    "openalex_api_key": os.environ.get("OPENALEX_API_KEY", ""),
    # Optional: NCBI API key for higher Entrez rate limits (10 req/s vs 3 req/s)
    "ncbi_api_key": os.environ.get("NCBI_API_KEY", ""),
    # Output directories
    "output_dir": "ohdsi_corpus",
    "pdf_dir": "ohdsi_corpus/pdfs",
    "metadata_dir": "ohdsi_corpus/metadata",
    # Rate limiting (seconds between requests)
    "openalex_delay": 0.15,   # ~6-7 req/s for polite pool
    "pubmed_delay": 0.35,     # 3 req/s without API key
    "unpaywall_delay": 0.1,   # 10 req/s
    "download_delay": float(os.environ.get("HARVESTER_DOWNLOAD_DELAY", "0.25")),
    "download_workers": int(os.environ.get("HARVESTER_DOWNLOAD_WORKERS", "6")),
    # Limits
    "max_works_per_author": 500,  # Cap per author to avoid runaway
    "openalex_per_page": 100,
}

# --- Logging ------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("harvester.log", mode="a"),
    ],
)
log = logging.getLogger("ohdsi_harvester")

# --- Data Classes -------------------------------------------------------------

@dataclass
class Author:
    name: str
    openalex_id: Optional[str] = None
    orcid: Optional[str] = None
    source: str = "ohdsi_publications"  # or "workgroup_lead", "co-author"

@dataclass
class Paper:
    title: str
    doi: Optional[str] = None
    pmid: Optional[str] = None
    pmcid: Optional[str] = None
    openalex_id: Optional[str] = None
    year: Optional[int] = None
    authors: list = field(default_factory=list)
    is_oa: bool = False
    oa_url: Optional[str] = None
    pdf_path: Optional[str] = None
    source: str = "ohdsi_bibliography"  # or "openalex_author_works"

# --- Session Setup ------------------------------------------------------------

session = requests.Session()
session.headers.update({
    "User-Agent": f"OHDSIHarvester/1.0 (mailto:{CONFIG['email']})",
})

# --- Phase 1: Scrape OHDSI Publications Page ---------------------------------

def phase1_scrape_ohdsi_publications() -> tuple[list[Paper], list[Author]]:
    """
    Scrape the official OHDSI publications page to extract:
    - Paper metadata (title, DOI, PMID, PMCID, authors)
    - Author names from the bibliography
    """
    log.info("=" * 70)
    log.info("PHASE 1: Scraping OHDSI publications page")
    log.info("=" * 70)

    url = "https://www.ohdsi.org/publications/"
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    papers = []
    all_authors = {}

    # The publications are in an ordered list or numbered paragraphs
    # They follow a consistent citation format with PMIDs and DOIs
    content = soup.find("div", class_="entry-content") or soup.find("article") or soup
    text = content.get_text()

    # Extract individual citations using numbered pattern
    # Pattern: "N. Authors. Title. Journal. Year;..."
    citations = re.split(r'\n\s*(\d+)\.\s+', text)

    # Also try to find them in list items
    list_items = content.find_all("li") if content else []

    raw_citations = []
    if list_items and len(list_items) > 10:
        for li in list_items:
            raw_citations.append(li.get_text(strip=True))
    else:
        # Parse from split text
        i = 1
        while i < len(citations) - 1:
            try:
                num = int(citations[i])
                cite_text = citations[i + 1].strip()
                raw_citations.append(cite_text)
                i += 2
            except (ValueError, IndexError):
                i += 1

    log.info(f"Found {len(raw_citations)} raw citations")

    for cite_text in raw_citations:
        paper = Paper(title="")

        # Extract PMID
        pmid_match = re.search(r'PubMed PMID:\s*(\d+)', cite_text)
        if pmid_match:
            paper.pmid = pmid_match.group(1)

        # Extract PMCID
        pmcid_match = re.search(r'PMC\d+', cite_text)
        if pmcid_match:
            paper.pmcid = pmcid_match.group(0)

        # Extract DOI -- DOIs can contain dots, so we match until whitespace/semicolon
        # then strip any trailing period that's punctuation, not part of the DOI
        doi_match = re.search(r'doi:\s*(10\.\d{4,}/[^\s;]+)', cite_text, re.IGNORECASE)
        if doi_match:
            paper.doi = doi_match.group(1).rstrip('.')
            # If DOI ends with a period followed by nothing useful, strip it
            # But preserve dots that are part of the DOI (e.g., pnas.1510502113)
            if paper.doi.endswith('.'):
                paper.doi = paper.doi.rstrip('.')

        # Extract year
        year_match = re.search(r'\b(19|20)\d{2}\b', cite_text)
        if year_match:
            paper.year = int(year_match.group(0))

        # Extract title (typically after authors, before journal)
        # Authors end with a period, title ends with a period before journal name
        # This is a best-effort heuristic
        parts = cite_text.split('. ')
        if len(parts) >= 2:
            # First part is usually authors
            author_str = parts[0]
            paper.title = parts[1] if len(parts) > 1 else ""

            # Parse author names
            author_names = re.split(r',\s*', author_str)
            for name in author_names[:20]:  # cap at 20 authors per paper
                name = name.strip().rstrip('.')
                name = re.sub(r'\s+et\s+al$', '', name)
                if name and len(name) > 2 and not name.startswith('doi'):
                    # Normalize: "LastName AB" -> "LastName AB"
                    if name not in all_authors:
                        all_authors[name] = Author(name=name, source="ohdsi_publications")

        if paper.pmid or paper.doi:
            papers.append(paper)

    log.info(f"Extracted {len(papers)} papers with PMIDs/DOIs")
    log.info(f"Extracted {len(all_authors)} unique author name strings")

    return papers, list(all_authors.values())


# --- Phase 1b: Known OHDSI Workgroup Leads -----------------------------------

def get_known_workgroup_leads() -> list[Author]:
    """
    Return a curated list of known OHDSI workgroup leads and key contributors.
    This supplements the scraped author list with people who may not appear
    in the bibliography but are active workgroup leaders.
    
    NOTE: This list should be maintained and expanded. Consider scraping
    the OHDSI workgroups page or the Teams directory for a more complete list.
    """
    leads = [
        # Core leadership
        ("George Hripcsak", "0000-0002-8458-0424"),
        ("Patrick Ryan", "0000-0002-4255-0696"),
        ("Marc Suchard", "0000-0001-9818-479X"),
        ("Martijn Schuemie", "0000-0002-0817-5361"),
        ("Christian Reich", None),
        ("Jon Duke", None),
        ("Clair Blacketer", None),
        ("Frank DeFalco", None),

        # Workgroup leads (from 2024/2025 symposium pages)
        ("Anna Ostropolets", None),
        ("Daniel Harding", None),
        ("Seng Chan You", None),
        ("Jenna Reps", None),
        ("Ross Williams", None),
        ("Adam Black", None),
        ("Paul Nagy", None),
        ("Alison Callahan", None),
        ("Stephanie Leonard", None),
        ("Louisa Smith", None),
        ("Sally Baxter", None),
        ("Kerry Goetz", None),
        ("Michelle Hribar", None),
        ("Atif Adam", None),
        ("Jake Gillberg", None),
        ("Robert Koski", None),
        ("Faaizah Arshad", None),
        ("Jenny Lane", None),
        ("Evan Minty", None),
        ("Andrew Williams", None),
        ("Kyle Zollo-Venecek", None),
        ("Robert Miller", None),
        ("Asieh Golozar", None),
        ("Gowtham Rao", None),
        ("Joel Swerdel", None),
        ("Azza Shoaibi", None),
        ("Nigel Hughes", None),
        ("Peter Rijnbeek", None),
        ("Mui Van Zandt", None),
        ("Vojtech Huser", None),
        ("Dani Prieto-Alhambra", None),
        ("Talita Duarte-Salles", None),
        ("Daniel Morales", None),
        ("Anthony Sena", None),
        ("Kristin Kostka", None),
        ("Erica Voss", None),
        ("Cynthia Sung", None),
        ("Rae Woong Park", None),
        ("David Madigan", None),
        ("Harlan Krumholz", None),
    ]

    return [
        Author(name=name, orcid=orcid, source="workgroup_lead")
        for name, orcid in leads
    ]


# --- Phase 2: Resolve Authors & Get Works via OpenAlex -----------------------

def openalex_search_author(name: str) -> Optional[dict]:
    """Search OpenAlex for an author by name, return top result."""
    time.sleep(CONFIG["openalex_delay"])
    params = {
        "search": name,
        "per_page": 1,
        "mailto": CONFIG["email"],
    }
    if CONFIG["openalex_api_key"]:
        params["api_key"] = CONFIG["openalex_api_key"]

    try:
        resp = session.get(
            "https://api.openalex.org/authors",
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results:
            return results[0]
    except Exception as e:
        log.warning(f"OpenAlex author search failed for '{name}': {e}")
    return None


def openalex_get_author_by_orcid(orcid: str) -> Optional[dict]:
    """Look up an OpenAlex author by ORCID."""
    time.sleep(CONFIG["openalex_delay"])
    params = {"mailto": CONFIG["email"]}
    if CONFIG["openalex_api_key"]:
        params["api_key"] = CONFIG["openalex_api_key"]

    try:
        resp = session.get(
            f"https://api.openalex.org/authors/https://orcid.org/{orcid}",
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.warning(f"OpenAlex ORCID lookup failed for '{orcid}': {e}")
    return None


def openalex_get_author_works(author_id: str) -> list[dict]:
    """Get all works for an OpenAlex author ID, paginated."""
    works = []
    cursor = "*"
    page = 0

    while cursor and len(works) < CONFIG["max_works_per_author"]:
        time.sleep(CONFIG["openalex_delay"])
        params = {
            "filter": f"authorships.author.id:{author_id}",
            "per_page": CONFIG["openalex_per_page"],
            "cursor": cursor,
            "mailto": CONFIG["email"],
            "select": "id,doi,title,publication_year,open_access,authorships,ids",
        }
        if CONFIG["openalex_api_key"]:
            params["api_key"] = CONFIG["openalex_api_key"]

        try:
            resp = session.get(
                "https://api.openalex.org/works",
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            results = data.get("results", [])
            if not results:
                break
            works.extend(results)

            cursor = data.get("meta", {}).get("next_cursor")
            page += 1
            if page % 5 == 0:
                log.info(f"  ... fetched {len(works)} works so far")
        except Exception as e:
            log.warning(f"OpenAlex works fetch failed at page {page}: {e}")
            break

    return works[:CONFIG["max_works_per_author"]]


def phase2_resolve_authors_and_works(
    authors: list[Author],
    existing_papers: list[Paper],
) -> tuple[list[Author], list[Paper]]:
    """
    For each author:
    1. Resolve to OpenAlex ID (via ORCID or name search)
    2. Fetch all their publications
    3. Deduplicate against existing papers
    """
    log.info("=" * 70)
    log.info("PHASE 2: Resolving authors via OpenAlex and fetching works")
    log.info("=" * 70)

    # Build identifier sets for deduplication across seed papers and coauthored works.
    known_dois = {p.doi.lower() for p in existing_papers if p.doi}
    known_pmids = {p.pmid for p in existing_papers if p.pmid}
    known_openalex_ids = {p.openalex_id for p in existing_papers if p.openalex_id}

    resolved_authors = []
    new_papers = []

    for i, author in enumerate(authors):
        log.info(f"[{i+1}/{len(authors)}] Resolving: {author.name}")

        # Try ORCID first, then name search
        oa_author = None
        if author.orcid:
            oa_author = openalex_get_author_by_orcid(author.orcid)

        if not oa_author:
            oa_author = openalex_search_author(author.name)

        if not oa_author:
            log.warning(f"  Could not resolve: {author.name}")
            continue

        author.openalex_id = oa_author.get("id")
        orcid = oa_author.get("orcid")
        if orcid:
            author.orcid = orcid.replace("https://orcid.org/", "")

        works_count = oa_author.get("works_count", 0)
        log.info(f"  Resolved -> {author.openalex_id} ({works_count} total works)")

        # Fetch their works
        works = openalex_get_author_works(author.openalex_id)
        log.info(f"  Retrieved {len(works)} works")

        for work in works:
            openalex_id = work.get("id")
            if openalex_id and openalex_id in known_openalex_ids:
                continue

            doi = work.get("doi", "")
            if doi:
                doi = doi.replace("https://doi.org/", "")
                if doi.lower() in known_dois:
                    continue  # already have this paper

            # Extract PMID from IDs
            pmid = None
            work_ids = work.get("ids", {})
            if isinstance(work_ids, dict):
                pmid_url = work_ids.get("pmid", "")
                if pmid_url:
                    pmid = pmid_url.replace("https://pubmed.ncbi.nlm.nih.gov/", "")
                    if pmid in known_pmids:
                        continue

            oa_info = work.get("open_access", {})
            paper = Paper(
                title=work.get("title", "") or "",
                doi=doi if doi else None,
                pmid=pmid,
                openalex_id=openalex_id,
                year=work.get("publication_year"),
                is_oa=oa_info.get("is_oa", False),
                oa_url=oa_info.get("oa_url"),
                source="openalex_author_works",
            )
            new_papers.append(paper)
            if openalex_id:
                known_openalex_ids.add(openalex_id)
            if doi:
                known_dois.add(doi.lower())
            if pmid:
                known_pmids.add(pmid)

        resolved_authors.append(author)

    log.info(f"Resolved {len(resolved_authors)} authors")
    log.info(f"Discovered {len(new_papers)} new papers from author works")

    return resolved_authors, new_papers


# --- Phase 3: Enrich with PubMed/PMC -----------------------------------------

def pubmed_id_converter(ids: list[str], id_type: str = "pmid") -> dict:
    """
    Use NCBI ID Converter API to get PMCIDs from PMIDs (or vice versa).
    Returns a dict mapping input IDs to PMCIDs.
    """
    if not ids:
        return {}

    results = {}
    batch_size = 200  # NCBI limit

    for i in range(0, len(ids), batch_size):
        batch = ids[i:i + batch_size]
        time.sleep(CONFIG["pubmed_delay"])

        params = {
            "ids": ",".join(batch),
            "format": "json",
            "tool": "ohdsi_harvester",
            "email": CONFIG["email"],
        }
        if CONFIG["ncbi_api_key"]:
            params["api_key"] = CONFIG["ncbi_api_key"]

        try:
            resp = session.get(
                "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/",
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            for record in data.get("records", []):
                pmid = record.get("pmid", "")
                pmcid = record.get("pmcid", "")
                doi = record.get("doi", "")
                if pmid:
                    results[pmid] = {"pmcid": pmcid, "doi": doi}
        except Exception as e:
            log.warning(f"NCBI ID converter batch failed: {e}")

    return results


def phase3_enrich_with_pubmed(papers: list[Paper]) -> list[Paper]:
    """
    For papers with PMIDs but no PMCIDs, check if PMC has them.
    PMC = PubMed Central = free full text.
    """
    log.info("=" * 70)
    log.info("PHASE 3: Enriching papers with PubMed/PMC metadata")
    log.info("=" * 70)

    # Collect PMIDs that need PMCID lookup
    pmids_needing_pmcid = [
        p.pmid for p in papers
        if p.pmid and not p.pmcid
    ]

    log.info(f"Looking up PMCIDs for {len(pmids_needing_pmcid)} papers with PMIDs")

    if pmids_needing_pmcid:
        conversions = pubmed_id_converter(pmids_needing_pmcid)
        enriched = 0
        for paper in papers:
            if paper.pmid and paper.pmid in conversions:
                info = conversions[paper.pmid]
                if info["pmcid"]:
                    paper.pmcid = info["pmcid"]
                    paper.is_oa = True
                    enriched += 1
                if info["doi"] and not paper.doi:
                    paper.doi = info["doi"]
        log.info(f"Found PMCIDs for {enriched} papers (these have free full text in PMC)")

    # Count OA status
    oa_count = sum(1 for p in papers if p.is_oa or p.pmcid)
    log.info(f"Total papers with OA access: {oa_count}/{len(papers)}")

    return papers


# --- Phase 4: Unpaywall Lookup -----------------------------------------------

def unpaywall_lookup(doi: str) -> Optional[str]:
    """Check Unpaywall for a legal OA PDF URL for a given DOI."""
    time.sleep(CONFIG["unpaywall_delay"])
    try:
        resp = session.get(
            f"https://api.unpaywall.org/v2/{quote(doi, safe='')}",
            params={"email": CONFIG["email"]},
            timeout=15,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()

        # Try best_oa_location first
        best = data.get("best_oa_location")
        if best and best.get("url_for_pdf"):
            return best["url_for_pdf"]

        # Fall back to any OA location with a PDF
        for loc in data.get("oa_locations", []):
            pdf_url = loc.get("url_for_pdf")
            if pdf_url:
                return pdf_url

    except Exception as e:
        log.debug(f"Unpaywall lookup failed for DOI {doi}: {e}")
    return None


def phase4_unpaywall_enrichment(papers: list[Paper]) -> list[Paper]:
    """
    For papers that have DOIs but no OA URL yet, check Unpaywall.
    """
    log.info("=" * 70)
    log.info("PHASE 4: Checking Unpaywall for legal OA copies")
    log.info("=" * 70)

    papers_needing_oa = [
        p for p in papers
        if p.doi and not p.oa_url and not p.pmcid
    ]

    log.info(f"Checking Unpaywall for {len(papers_needing_oa)} papers without OA access")

    found = 0
    for i, paper in enumerate(papers_needing_oa):
        if i > 0 and i % 100 == 0:
            log.info(f"  ... checked {i}/{len(papers_needing_oa)}, found {found} OA")

        pdf_url = unpaywall_lookup(paper.doi)
        if pdf_url:
            paper.oa_url = pdf_url
            paper.is_oa = True
            found += 1

    log.info(f"Found {found} additional OA papers via Unpaywall")

    # Final tally
    total_oa = sum(1 for p in papers if p.is_oa or p.pmcid or p.oa_url)
    log.info(f"Total papers with OA access: {total_oa}/{len(papers)}")

    return papers


# --- Phase 5: Download PDFs --------------------------------------------------

def download_pdf(url: str, filepath: str) -> bool:
    """Download a PDF from a URL to a local file.

    Validates the response is an actual PDF by checking both the Content-Type
    header and the file magic bytes (%PDF-).  HTML pages, login walls, and
    cookie consent pages are rejected.
    """
    try:
        time.sleep(CONFIG["download_delay"])
        resp = requests.get(
            url,
            timeout=60,
            allow_redirects=True,
            headers={"User-Agent": session.headers["User-Agent"]},
        )
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "").lower()

        # Reject HTML responses outright (login pages, cookie walls, error pages)
        if "html" in content_type or "xml" in content_type:
            log.debug(f"Rejected HTML/XML response from {url}: {content_type}")
            return False

        # Accept if Content-Type says PDF or octet-stream
        type_ok = "pdf" in content_type or "octet-stream" in content_type

        # Always verify the actual bytes start with the PDF magic header
        is_pdf = resp.content[:5] == b"%PDF-"

        if type_ok and is_pdf:
            with open(filepath, "wb") as f:
                f.write(resp.content)
            os.chmod(filepath, 0o644)
            return True

        if not is_pdf:
            log.debug(f"Not a valid PDF (bad magic bytes) from {url}: content_type={content_type}")
        else:
            log.debug(f"Unexpected content type from {url}: {content_type}")
    except Exception as e:
        log.debug(f"Download failed from {url}: {e}")
    return False


def pmc_pdf_url(pmcid: str) -> str:
    """Construct a PMC PDF download URL."""
    return f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/"


def _paper_identity_key(paper: Paper) -> str:
    """Return a stable per-paper identity string for filename disambiguation."""
    primary_id = paper.doi or paper.pmcid or paper.pmid or paper.openalex_id or ""
    if primary_id:
        return primary_id

    return "|".join(
        [
            (paper.title or "").strip().lower(),
            str(paper.year or ""),
            paper.oa_url or "",
        ]
    )


def _safe_pdf_path(pdf_dir: Path, paper: Paper) -> str:
    preferred_label = paper.doi or paper.pmcid or paper.pmid or paper.openalex_id
    if not preferred_label:
        preferred_label = paper.title or "paper"

    safe_label = re.sub(r"[^\w\-.]+", "_", preferred_label).strip("._") or "paper"
    safe_label = safe_label[:96]

    fingerprint = hashlib.sha1(_paper_identity_key(paper).encode("utf-8")).hexdigest()[:12]
    safe_filename = f"{safe_label}__{fingerprint}.pdf"
    return str(pdf_dir / safe_filename)


def _download_one_paper(pdf_dir: Path, paper: Paper) -> tuple[Paper, bool]:
    filepath = _safe_pdf_path(pdf_dir, paper)

    if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
        paper.pdf_path = filepath
        return paper, True

    success = False

    if paper.pmcid:
        success = download_pdf(pmc_pdf_url(paper.pmcid), filepath)

    if not success and paper.oa_url:
        success = download_pdf(paper.oa_url, filepath)

    if success:
        paper.pdf_path = filepath

    return paper, success


def _pdf_preference_key(path: Path) -> tuple[int, int, int, str]:
    """Prefer canonical-looking filenames when duplicate content is found."""
    name = path.name.lower()
    return (
        1 if name.startswith("https_openalex.org_") else 0,
        1 if "annotation_" in name else 0,
        len(name),
        name,
    )


def dedupe_downloaded_pdf_content(papers: list[Paper], pdf_dir: Path) -> tuple[int, int]:
    """Remove exact duplicate PDF binaries and clear duplicate paper references.

    Returns ``(removed_files, cleared_paper_refs)``.
    """
    papers_by_path: dict[str, list[Paper]] = {}
    for paper in papers:
        if paper.pdf_path:
            papers_by_path.setdefault(paper.pdf_path, []).append(paper)

    existing_paths = [Path(path) for path in papers_by_path if Path(path).exists()]
    files_by_hash: dict[str, list[Path]] = {}
    for path in existing_paths:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        files_by_hash.setdefault(digest, []).append(path)

    removed_files = 0
    cleared_refs = 0

    for paths in files_by_hash.values():
        if len(paths) <= 1:
            continue

        canonical = min(paths, key=_pdf_preference_key)
        for duplicate in paths:
            if duplicate == canonical:
                continue

            try:
                duplicate.unlink()
                removed_files += 1
            except FileNotFoundError:
                pass

            for paper in papers_by_path.get(str(duplicate), []):
                paper.pdf_path = None
                cleared_refs += 1

    return removed_files, cleared_refs


def phase5_download_pdfs(papers: list[Paper]) -> list[Paper]:
    """
    Download PDFs from available OA sources:
    1. PMC (for papers with PMCIDs)
    2. Direct OA URLs (from OpenAlex or Unpaywall)
    """
    log.info("=" * 70)
    log.info("PHASE 5: Downloading PDFs")
    log.info("=" * 70)

    pdf_dir = Path(CONFIG["pdf_dir"])
    pdf_dir.mkdir(parents=True, exist_ok=True)

    downloadable = [p for p in papers if p.pmcid or p.oa_url]
    log.info(f"Attempting to download {len(downloadable)} papers")
    log.info(
        f"Using {CONFIG['download_workers']} download workers "
        f"with {CONFIG['download_delay']:.2f}s delay"
    )

    downloaded = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=CONFIG["download_workers"]) as pool:
        futures = [pool.submit(_download_one_paper, pdf_dir, paper) for paper in downloadable]
        for i, future in enumerate(as_completed(futures), start=1):
            _, success = future.result()
            if success:
                downloaded += 1
            else:
                failed += 1

            if i % 50 == 0 or i == len(downloadable):
                log.info(f"  ... processed {i}/{len(downloadable)}, downloaded {downloaded}")

    removed_files, cleared_refs = dedupe_downloaded_pdf_content(papers, pdf_dir)
    if removed_files:
        log.info(
            "Removed %d exact-duplicate PDF files and cleared %d duplicate paper references",
            removed_files,
            cleared_refs,
        )

    log.info(f"Downloaded: {downloaded}, Failed: {failed}")
    return papers


# --- Utility: Save/Load State ------------------------------------------------

def save_state(papers: list[Paper], authors: list[Author], phase: str):
    """Save current state to JSON for resumability."""
    meta_dir = Path(CONFIG["metadata_dir"])
    meta_dir.mkdir(parents=True, exist_ok=True)

    state = {
        "phase": phase,
        "paper_count": len(papers),
        "author_count": len(authors),
        "papers": [asdict(p) for p in papers],
        "authors": [asdict(a) for a in authors],
    }

    filepath = meta_dir / f"state_{phase}.json"
    with open(filepath, "w") as f:
        json.dump(state, f, indent=2, default=str)
    log.info(f"Saved state to {filepath}")

    # Also save a summary CSV for quick inspection
    csv_path = meta_dir / f"papers_{phase}.csv"
    with open(csv_path, "w") as f:
        f.write("doi,pmid,pmcid,year,is_oa,has_pdf,title\n")
        for p in papers:
            has_pdf = "yes" if p.pdf_path else "no"
            title = (p.title or "").replace('"', "'")[:100]
            f.write(f'"{p.doi}","{p.pmid}","{p.pmcid}",{p.year or ""},'
                    f'{p.is_oa},{has_pdf},"{title}"\n')
    log.info(f"Saved summary CSV to {csv_path}")


def load_state(phase: str) -> Optional[tuple[list[Paper], list[Author]]]:
    """Load state from a previous phase."""
    filepath = Path(CONFIG["metadata_dir"]) / f"state_{phase}.json"
    if not filepath.exists():
        return None

    with open(filepath) as f:
        state = json.load(f)

    papers = [Paper(**p) for p in state["papers"]]
    authors = [Author(**a) for a in state["authors"]]
    log.info(f"Loaded state from {filepath}: {len(papers)} papers, {len(authors)} authors")
    return papers, authors


# --- Main Pipeline ------------------------------------------------------------

def run_pipeline(
    start_phase: int = 1,
    end_phase: int = 5,
    skip_download: bool = False,
    author_limit: Optional[int] = None,
):
    """
    Run the full pipeline, optionally starting from a specific phase.
    """
    log.info("OHDSI Paper Harvester -- Starting Pipeline")
    log.info(f"  Phases: {start_phase} -> {end_phase}")
    log.info(f"  Output: {CONFIG['output_dir']}")
    log.info(f"  Email: {CONFIG['email']}")

    # Create output directories
    Path(CONFIG["output_dir"]).mkdir(parents=True, exist_ok=True)
    Path(CONFIG["pdf_dir"]).mkdir(parents=True, exist_ok=True)
    Path(CONFIG["metadata_dir"]).mkdir(parents=True, exist_ok=True)

    papers = []
    authors = []

    # -- Phase 1 --
    if start_phase <= 1 and end_phase >= 1:
        ohdsi_papers, ohdsi_authors = phase1_scrape_ohdsi_publications()
        workgroup_leads = get_known_workgroup_leads()

        # Merge author lists, dedup by name
        author_names = set()
        for a in ohdsi_authors + workgroup_leads:
            if a.name not in author_names:
                authors.append(a)
                author_names.add(a.name)

        papers = ohdsi_papers
        save_state(papers, authors, "phase1")
    else:
        prev = load_state("phase1")
        if prev:
            papers, authors = prev

    # -- Phase 2 --
    if start_phase <= 2 and end_phase >= 2:
        # Apply author limit if set (for testing)
        working_authors = authors[:author_limit] if author_limit else authors

        resolved_authors, new_papers = phase2_resolve_authors_and_works(
            working_authors, papers
        )
        papers.extend(new_papers)
        authors = resolved_authors
        save_state(papers, authors, "phase2")
    elif start_phase > 2:
        prev = load_state("phase2")
        if prev:
            papers, authors = prev

    # -- Phase 3 --
    if start_phase <= 3 and end_phase >= 3:
        papers = phase3_enrich_with_pubmed(papers)
        save_state(papers, authors, "phase3")
    elif start_phase > 3:
        prev = load_state("phase3")
        if prev:
            papers, authors = prev

    # -- Phase 4 --
    if start_phase <= 4 and end_phase >= 4:
        papers = phase4_unpaywall_enrichment(papers)
        save_state(papers, authors, "phase4")
    elif start_phase > 4:
        prev = load_state("phase4")
        if prev:
            papers, authors = prev

    # -- Phase 5 --
    if start_phase <= 5 and end_phase >= 5 and not skip_download:
        papers = phase5_download_pdfs(papers)
        save_state(papers, authors, "phase5")

    # -- Final Summary --
    log.info("=" * 70)
    log.info("PIPELINE COMPLETE -- Summary")
    log.info("=" * 70)
    log.info(f"Total papers:     {len(papers)}")
    log.info(f"With DOI:         {sum(1 for p in papers if p.doi)}")
    log.info(f"With PMID:        {sum(1 for p in papers if p.pmid)}")
    log.info(f"With PMCID:       {sum(1 for p in papers if p.pmcid)}")
    log.info(f"Open Access:      {sum(1 for p in papers if p.is_oa)}")
    log.info(f"PDFs Downloaded:  {sum(1 for p in papers if p.pdf_path)}")
    log.info(f"Authors tracked:  {len(authors)}")

    return papers, authors


# --- CLI ----------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="OHDSI Paper Harvester -- Download publications by OHDSI community members"
    )
    parser.add_argument(
        "--start-phase", type=int, default=1, choices=[1, 2, 3, 4, 5],
        help="Phase to start from (1=scrape, 2=OpenAlex, 3=PubMed, 4=Unpaywall, 5=Download)"
    )
    parser.add_argument(
        "--end-phase", type=int, default=5, choices=[1, 2, 3, 4, 5],
        help="Phase to end at"
    )
    parser.add_argument(
        "--skip-download", action="store_true",
        help="Skip PDF download phase (useful for metadata-only runs)"
    )
    parser.add_argument(
        "--author-limit", type=int, default=None,
        help="Limit number of authors to process (for testing)"
    )
    parser.add_argument(
        "--email", type=str, default=None,
        help="Your email (required by Unpaywall/OpenAlex)"
    )
    parser.add_argument(
        "--output-dir", type=str, default=None,
        help="Output directory"
    )

    args = parser.parse_args()

    if args.email:
        CONFIG["email"] = args.email
    if args.output_dir:
        CONFIG["output_dir"] = args.output_dir
        CONFIG["pdf_dir"] = f"{args.output_dir}/pdfs"
        CONFIG["metadata_dir"] = f"{args.output_dir}/metadata"

    run_pipeline(
        start_phase=args.start_phase,
        end_phase=args.end_phase,
        skip_download=args.skip_download,
        author_limit=args.author_limit,
    )


if __name__ == "__main__":
    main()
