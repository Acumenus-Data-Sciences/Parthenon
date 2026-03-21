# Dataset Acquisition TUI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Python TUI that lets end users browse, select, and load publicly available OHDSI datasets into a fresh Parthenon Docker installation.

**Architecture:** A `datasets/` Python package at repo root with a registry of public datasets, a Rich/questionary TUI for a la carte selection with bundle presets, and per-category loader modules that delegate to existing artisan commands. Download infrastructure is extracted from `installer/demo_data.py`. The tool runs standalone (`python3 -m datasets`) or from the installer (Phase 5).

**Tech Stack:** Python 3.12, Rich (console UI), questionary (prompts), installer/utils.py (Docker/subprocess helpers)

**Spec:** `docs/superpowers/specs/2026-03-21-dataset-acquisition-tui-design.md`

---

## Implementation Notes

1. **Package name `datasets`** collides with the Hugging Face `datasets` library. If the AI service (which uses transformers/torch) ever installs it, imports will conflict. During implementation, if this causes issues, rename to `parthenon_datasets` with a global find-replace.

2. **`scripts/gis/load_all.py` hardcoded DSN** (line 22) must be updated to read from `DB_DSN` environment variable with fallback to the current hardcoded value. This is a prerequisite for the GIS loader.

3. **Reuse `installer/utils.py`** where possible. The TUI's system check (`_check_system`) should call `docker_daemon_running()` and `container_health("parthenon-php")` from `installer/utils.py` rather than reimplementing Docker checks. However, `_exec_php` and `_query_count` in `datasets/loaders/__init__.py` are dataset-specific wrappers (streaming support, psql COUNT) not available in the installer utils.

---

## File Map

### New files (create)

| File | Responsibility |
|------|---------------|
| `datasets/__init__.py` | Package marker, version string |
| `datasets/__main__.py` | Entry point for `python3 -m datasets` |
| `datasets/registry.py` | Dataset dataclass + full catalog + bundles + dependency validation |
| `datasets/downloads.py` | Download with progress/resume, decompress .gz, extract .tar.gz |
| `datasets/tui.py` | TUI screens: status check, bundle/a la carte selection, picker, confirmation |
| `datasets/loader.py` | Orchestrator: resolve deps, run loaders in order, summary |
| `datasets/loaders/__init__.py` | Loader interface protocol |
| `datasets/loaders/vocabulary.py` | Athena vocabulary (manual download prompt + artisan) |
| `datasets/loaders/eunomia.py` | GiBleed demo CDM |
| `datasets/loaders/synpuf.py` | Phase 2 stub |
| `datasets/loaders/synthea.py` | Phase 2 stub |
| `datasets/loaders/genomics.py` | GIAB VCF + ClinVar |
| `datasets/loaders/imaging.py` | DICOM datasets |
| `datasets/loaders/gis.py` | Census TIGER/Line via scripts/gis/load_all.py |
| `datasets/loaders/phenotypes.py` | OHDSI Phenotype Library |
| `parthenon-data` | Convenience shell script at repo root |

### Existing files (modify)

| File | Change |
|------|--------|
| `installer/cli.py` | Replace Phase 5 + 5b with single Phase 5 datasets integration |
| `installer/demo_data.py` | Replace body with thin shim importing from `datasets/` |

---

## Task 1: Package skeleton + downloads module

**Files:**
- Create: `datasets/__init__.py`
- Create: `datasets/__main__.py`
- Create: `datasets/downloads.py`

- [ ] **Step 1: Create package marker**

```python
# datasets/__init__.py
"""Parthenon Dataset Acquisition — public dataset browser and loader."""
__version__ = "1.0.0"
```

- [ ] **Step 2: Create `__main__.py` placeholder**

```python
# datasets/__main__.py
"""Entry point: python3 -m datasets"""
from datasets.tui import main

if __name__ == "__main__":
    main()
```

This will fail until `tui.py` exists — that's fine, we'll build bottom-up.

- [ ] **Step 3: Extract download infrastructure from `demo_data.py` into `datasets/downloads.py`**

Move these functions from `installer/demo_data.py` (lines 199-320) into `datasets/downloads.py`:
- `download_file()` (was `_download_file`) — HTTP download with Rich progress bar and resume
- `decompress_gz()` (was `_decompress_gz`) — gzip decompression with progress
- `extract_tarball()` (was `_extract_tarball`) — tar.gz extraction

Make them public (drop leading underscore). Keep the same signatures but add a `console` parameter instead of using module-level console:

```python
# datasets/downloads.py
"""Download infrastructure — HTTP resume, progress bars, decompression."""
from __future__ import annotations

import gzip
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import (
    Progress,
    BarColumn,
    DownloadColumn,
    TransferSpeedColumn,
    TimeRemainingColumn,
)


def download_file(
    url: str,
    dest: Path,
    *,
    label: str = "",
    console: Optional[Console] = None,
) -> bool:
    """Download a file with progress bar and HTTP Range resume support.
    Returns True on success, False on failure (non-fatal).
    """
    _console = console or Console()
    display = label or dest.name

    existing_size = 0
    if dest.exists():
        existing_size = dest.stat().st_size

    headers = {}
    if existing_size > 0:
        headers["Range"] = f"bytes={existing_size}-"
        _console.print(f"    [dim]Resuming {display} from {existing_size / (1024**2):.1f} MB...[/dim]")

    req = urllib.request.Request(url, headers=headers)

    try:
        resp = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as e:
        if e.code == 416:
            _console.print(f"    [green]Already downloaded:[/green] {display}")
            return True
        _console.print(f"    [red]Download failed ({e.code}):[/red] {display}")
        return False
    except Exception as e:
        _console.print(f"    [red]Download failed:[/red] {display} -- {e}")
        return False

    content_length = resp.headers.get("Content-Length")
    if resp.status == 206:
        total = existing_size + int(content_length) if content_length else None
        mode = "ab"
    else:
        total = int(content_length) if content_length else None
        mode = "wb"
        existing_size = 0

    dest.parent.mkdir(parents=True, exist_ok=True)

    with Progress(
        "[progress.description]{task.description}",
        BarColumn(),
        DownloadColumn(),
        TransferSpeedColumn(),
        TimeRemainingColumn(),
        console=_console,
    ) as progress:
        task = progress.add_task(f"    {display}", total=total, completed=existing_size)
        with open(dest, mode) as f:
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                f.write(chunk)
                progress.advance(task, len(chunk))

    return True


def decompress_gz(
    gz_path: Path,
    out_path: Path,
    *,
    console: Optional[Console] = None,
) -> bool:
    """Decompress a .gz file, showing progress."""
    _console = console or Console()
    _console.print(f"    [cyan]Decompressing[/cyan] {gz_path.name} -> {out_path.name}...")

    if out_path.exists() and out_path.stat().st_size > 0:
        _console.print(f"    [green]Already decompressed:[/green] {out_path.name}")
        return True

    try:
        total = gz_path.stat().st_size
        with Progress(
            "[progress.description]{task.description}",
            BarColumn(),
            DownloadColumn(),
            TransferSpeedColumn(),
            console=_console,
        ) as progress:
            task = progress.add_task(f"    {gz_path.name}", total=total)
            with gzip.open(gz_path, "rb") as f_in, open(out_path, "wb") as f_out:
                while True:
                    chunk = f_in.read(1024 * 512)
                    if not chunk:
                        break
                    f_out.write(chunk)
                    progress.update(task, completed=f_in.fileobj.tell())  # type: ignore[union-attr]
        return True
    except Exception as e:
        _console.print(f"    [red]Decompression failed:[/red] {e}")
        if out_path.exists():
            out_path.unlink()
        return False


def extract_tarball(
    tar_path: Path,
    extract_to: Path,
    *,
    console: Optional[Console] = None,
) -> bool:
    """Extract a .tar.gz archive."""
    import tarfile

    _console = console or Console()
    _console.print(f"    [cyan]Extracting[/cyan] {tar_path.name} -> {extract_to}/...")

    if extract_to.exists() and any(extract_to.iterdir()):
        _console.print(f"    [green]Already extracted:[/green] {extract_to.name}/")
        return True

    try:
        extract_to.mkdir(parents=True, exist_ok=True)
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(path=extract_to, filter="data")
        return True
    except Exception as e:
        _console.print(f"    [red]Extraction failed:[/red] {e}")
        return False
```

- [ ] **Step 4: Verify package imports work**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from datasets.downloads import download_file, decompress_gz, extract_tarball; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add datasets/__init__.py datasets/__main__.py datasets/downloads.py
git commit -m "feat(datasets): create package skeleton and download infrastructure"
```

---

## Task 2: Dataset registry

**Files:**
- Create: `datasets/registry.py`

- [ ] **Step 1: Create registry with dataclass, catalog, bundles, and dependency validation**

```python
# datasets/registry.py
"""Dataset catalog — definitions, bundles, and dependency validation."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class Dataset:
    """A single acquirable dataset."""

    key: str
    name: str
    category: str
    description: str
    size_estimate: str
    size_download_mb: int
    size_loaded_mb: int
    time_estimate: str
    source_url: str
    loader: str
    requires_registration: bool = False
    auto_downloadable: bool = True
    dependencies: list[str] = field(default_factory=list)
    checksum: Optional[str] = None
    phase: int = 1


# ── Category display order ─────────────────────────────────────────────────

CATEGORIES: list[tuple[str, str]] = [
    ("vocabulary", "Vocabulary"),
    ("cdm", "CDM Datasets"),
    ("genomics", "Genomics"),
    ("imaging", "Imaging"),
    ("gis", "GIS / Geospatial"),
    ("phenotypes", "Phenotypes"),
]


# ── Dataset catalog ────────────────────────────────────────────────────────

DATASETS: dict[str, Dataset] = {}


def _register(ds: Dataset) -> None:
    DATASETS[ds.key] = ds


# -- Vocabulary --
_register(Dataset(
    key="vocabulary",
    name="OMOP Vocabulary (Athena)",
    category="vocabulary",
    description="Standard OHDSI concept vocabulary — 7M+ concepts, relationships, ancestors",
    size_estimate="~4 GB download, ~16 GB loaded",
    size_download_mb=4_000,
    size_loaded_mb=16_000,
    time_estimate="~30 min",
    source_url="https://athena.ohdsi.org",
    loader="datasets.loaders.vocabulary",
    requires_registration=True,
    auto_downloadable=False,
))

# -- CDM Datasets --
_register(Dataset(
    key="eunomia",
    name="Eunomia GiBleed (2,694 patients)",
    category="cdm",
    description="OHDSI standard demo dataset — GI bleeding cohort with full CDM + Achilles",
    size_estimate="~38 MB",
    size_download_mb=15,
    size_loaded_mb=38,
    time_estimate="~2 min",
    source_url="https://github.com/OHDSI/EunomiaDatasets",
    loader="datasets.loaders.eunomia",
))

_register(Dataset(
    key="synpuf-1k",
    name="CMS SynPUF 1K sample",
    category="cdm",
    description="Synthetic Medicare claims — 1,000 patient sample in OMOP CDM format",
    size_estimate="~200 MB loaded",
    size_download_mb=100,
    size_loaded_mb=200,
    time_estimate="~10 min",
    source_url="https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files",
    loader="datasets.loaders.synpuf",
    dependencies=["vocabulary"],
    phase=2,
))

_register(Dataset(
    key="synpuf-full",
    name="CMS SynPUF (2.3M patients)",
    category="cdm",
    description="Full CMS Synthetic Public Use Files — 2.3 million patients in OMOP CDM",
    size_estimate="~10 GB loaded",
    size_download_mb=3_000,
    size_loaded_mb=10_000,
    time_estimate="~2 hrs",
    source_url="https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files",
    loader="datasets.loaders.synpuf",
    dependencies=["vocabulary"],
    phase=2,
))

_register(Dataset(
    key="synthea-1k",
    name="SyntheA 1K synthetic patients",
    category="cdm",
    description="Synthea-generated synthetic patients with full clinical history in OMOP CDM",
    size_estimate="~500 MB loaded",
    size_download_mb=200,
    size_loaded_mb=500,
    time_estimate="~15 min",
    source_url="https://github.com/synthetichealth/synthea",
    loader="datasets.loaders.synthea",
    dependencies=["vocabulary"],
    phase=2,
))

# -- Genomics --
_register(Dataset(
    key="clinvar",
    name="ClinVar variant database",
    category="genomics",
    description="NCBI ClinVar — clinical significance of human genetic variants",
    size_estimate="~500 MB",
    size_download_mb=200,
    size_loaded_mb=500,
    time_estimate="~10 min",
    source_url="https://www.ncbi.nlm.nih.gov/clinvar/",
    loader="datasets.loaders.genomics",
))

_GIAB_BASE_URL = "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release"
_GIAB_SAMPLES = [
    ("hg001", "HG001", "NA12878 — most characterized human genome",
     f"{_GIAB_BASE_URL}/NA12878_HG001/NISTv4.2.1/GRCh38/HG001_GRCh38_1_22_v4.2.1_benchmark.vcf.gz"),
    ("hg002", "HG002", "Ashkenazim Trio — Son (NA24385)",
     f"{_GIAB_BASE_URL}/AshkenazimTrio/HG002_NA24385_son/NISTv4.2.1/GRCh38/HG002_GRCh38_1_22_v4.2.1_benchmark.vcf.gz"),
    ("hg003", "HG003", "Ashkenazim Trio — Father (NA24149)",
     f"{_GIAB_BASE_URL}/AshkenazimTrio/HG003_NA24149_father/NISTv4.2.1/GRCh38/HG003_GRCh38_1_22_v4.2.1_benchmark.vcf.gz"),
    ("hg004", "HG004", "Ashkenazim Trio — Mother (NA24143)",
     f"{_GIAB_BASE_URL}/AshkenazimTrio/HG004_NA24143_mother/NISTv4.2.1/GRCh38/HG004_GRCh38_1_22_v4.2.1_benchmark.vcf.gz"),
    ("hg005", "HG005", "Chinese Trio — Son (NA24631)",
     f"{_GIAB_BASE_URL}/ChineseTrio/HG005_NA24631_son/NISTv4.2.1/GRCh38/HG005_GRCh38_1_22_v4.2.1_benchmark.vcf.gz"),
    ("hg006", "HG006", "Chinese Trio — Father (NA24694)",
     f"{_GIAB_BASE_URL}/ChineseTrio/HG006_NA24694_father/NISTv4.2.1/GRCh38/HG006_GRCh38_1_22_v4.2.1_benchmark.vcf.gz"),
    ("hg007", "HG007", "Chinese Trio — Mother (NA24695)",
     f"{_GIAB_BASE_URL}/ChineseTrio/HG007_NA24695_mother/NISTv4.2.1/GRCh38/HG007_GRCh38_1_22_v4.2.1_benchmark.vcf.gz"),
]

for _suffix, _sample_id, _desc, _url in _GIAB_SAMPLES:
    _register(Dataset(
        key=f"giab-{_suffix}",
        name=f"GIAB {_sample_id} ({_desc.split(' — ')[0]})",
        category="genomics",
        description=f"Genome in a Bottle {_sample_id} — {_desc}",
        size_estimate="~3.5 GB",
        size_download_mb=800,
        size_loaded_mb=3_500,
        time_estimate="~20 min",
        source_url=_url,
        loader="datasets.loaders.genomics",
    ))

# -- Imaging --
_register(Dataset(
    key="dicom-malocclusion",
    name="Class-3 Malocclusion CBCT",
    category="imaging",
    description="Orthodontic cone-beam CT imaging dataset (21 MB)",
    size_estimate="~21 MB",
    size_download_mb=21,
    size_loaded_mb=21,
    time_estimate="~1 min",
    source_url="https://github.com/sudoshi/parthenon-demo-data/releases",
    loader="datasets.loaders.imaging",
))

_register(Dataset(
    key="dicom-covid19",
    name="Harvard COVID-19 CT (1,000 studies)",
    category="imaging",
    description="The Cancer Imaging Archive — 1,000 subjects, 491K DICOM instances",
    size_estimate="~242 GB",
    size_download_mb=242_000,
    size_loaded_mb=242_000,
    time_estimate="~8-12 hrs",
    source_url="https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=80969742",
    loader="datasets.loaders.imaging",
    auto_downloadable=False,
))

# -- GIS --
_register(Dataset(
    key="gis-boundaries",
    name="US Census TIGER/Line boundaries",
    category="gis",
    description="Census tracts, counties, ZIP crosswalks, CDC SVI, EPA air quality, CMS hospitals",
    size_estimate="~100 MB",
    size_download_mb=50,
    size_loaded_mb=100,
    time_estimate="~15 min",
    source_url="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    loader="datasets.loaders.gis",
))

# -- Phenotypes --
_register(Dataset(
    key="phenotype-library",
    name="OHDSI Phenotype Library (1,100 definitions)",
    category="phenotypes",
    description="Community-curated cohort definitions from the OHDSI Phenotype Library",
    size_estimate="~5 MB",
    size_download_mb=5,
    size_loaded_mb=5,
    time_estimate="~2 min",
    source_url="https://github.com/OHDSI/PhenotypeLibrary",
    loader="datasets.loaders.phenotypes",
))


# ── Bundles ────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Bundle:
    """A recommended preset of datasets."""

    key: str
    name: str
    description: str
    dataset_keys: list[str]


BUNDLES: list[Bundle] = [
    Bundle(
        key="quick-start",
        name="Quick Start",
        description="Eunomia demo CDM + OHDSI Phenotype Library (~50 MB, ~5 min)",
        dataset_keys=["eunomia", "phenotype-library"],
    ),
    Bundle(
        key="research-ready",
        name="Research Ready",
        description="Eunomia + Vocabulary + ClinVar + GIAB HG001 + GIS + Phenotypes (~12 GB)",
        dataset_keys=[
            "eunomia", "vocabulary", "clinvar", "giab-hg001",
            "gis-boundaries", "phenotype-library",
        ],
    ),
    Bundle(
        key="genomics-focus",
        name="Genomics Focus",
        description="Eunomia + ClinVar + 2 GIAB samples + Phenotypes (~8 GB)",
        dataset_keys=[
            "eunomia", "clinvar", "giab-hg001", "giab-hg002",
            "phenotype-library",
        ],
    ),
    Bundle(
        key="full-platform",
        name="Full Platform",
        description="All auto-downloadable Phase 1 datasets (~50 GB)",
        dataset_keys=[
            k for k, ds in DATASETS.items()
            if ds.auto_downloadable and ds.phase == 1
        ],
    ),
]


# ── Dependency validation ──────────────────────────────────────────────────

def resolve_dependencies(selected_keys: list[str]) -> list[str]:
    """Return selected_keys in dependency order, adding missing dependencies.

    Raises ValueError if the dependency graph has a cycle.
    """
    # Collect all required keys (selected + transitive dependencies)
    required: set[str] = set()
    stack = list(selected_keys)
    while stack:
        key = stack.pop()
        if key in required:
            continue
        required.add(key)
        ds = DATASETS.get(key)
        if ds:
            for dep in ds.dependencies:
                if dep not in required:
                    stack.append(dep)

    # Topological sort (Kahn's algorithm)
    in_degree: dict[str, int] = {k: 0 for k in required}
    for k in required:
        ds = DATASETS.get(k)
        if ds:
            for dep in ds.dependencies:
                if dep in required:
                    in_degree[k] = in_degree.get(k, 0) + 1

    queue = [k for k, deg in in_degree.items() if deg == 0]
    result: list[str] = []

    while queue:
        queue.sort()  # deterministic order
        node = queue.pop(0)
        result.append(node)
        for k in required:
            ds = DATASETS.get(k)
            if ds and node in ds.dependencies:
                in_degree[k] -= 1
                if in_degree[k] == 0:
                    queue.append(k)

    if len(result) != len(required):
        raise ValueError(
            f"Dependency cycle detected among: {required - set(result)}"
        )

    return result


def get_added_dependencies(selected_keys: list[str]) -> list[str]:
    """Return dependency keys that are NOT in selected_keys but are required."""
    resolved = resolve_dependencies(selected_keys)
    return [k for k in resolved if k not in selected_keys]


# Validate at import time
try:
    resolve_dependencies(list(DATASETS.keys()))
except ValueError as e:
    raise ValueError(f"Dataset registry has invalid dependencies: {e}") from e
```

- [ ] **Step 2: Verify registry loads without errors**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from datasets.registry import DATASETS, BUNDLES, resolve_dependencies; print(f'{len(DATASETS)} datasets, {len(BUNDLES)} bundles'); print(resolve_dependencies(['synpuf-1k']))"`

Expected: `17 datasets, 4 bundles` and `['vocabulary', 'synpuf-1k']`

- [ ] **Step 3: Commit**

```bash
git add datasets/registry.py
git commit -m "feat(datasets): add dataset registry with catalog, bundles, and dependency resolution"
```

---

## Task 3: Loader interface + all loader modules

**Files:**
- Create: `datasets/loaders/__init__.py`
- Create: `datasets/loaders/vocabulary.py`
- Create: `datasets/loaders/eunomia.py`
- Create: `datasets/loaders/synpuf.py`
- Create: `datasets/loaders/synthea.py`
- Create: `datasets/loaders/genomics.py`
- Create: `datasets/loaders/imaging.py`
- Create: `datasets/loaders/gis.py`
- Create: `datasets/loaders/phenotypes.py`

- [ ] **Step 1: Create loader protocol**

```python
# datasets/loaders/__init__.py
"""Loader modules — each exposes is_loaded() and load()."""
from __future__ import annotations

from typing import Protocol
from pathlib import Path
from rich.console import Console


class DatasetLoader(Protocol):
    """Protocol that all loader modules implement."""

    def is_loaded(self) -> bool: ...
    def load(self, *, console: Console, downloads_dir: Path) -> bool: ...
```

- [ ] **Step 2: Create helper for running artisan/psql through Docker**

Add to `datasets/loaders/__init__.py` below the Protocol:

```python
import shlex
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent

# NOTE: For Docker/subprocess helpers, we reuse installer/utils.py where possible.
# _exec_php and _query_count are dataset-specific wrappers that add streaming and
# psql count support not available in installer/utils.py's exec_php().


def _exec_php(cmd: str, *, check: bool = True, stream: bool = False) -> subprocess.CompletedProcess | int:
    """Run artisan command inside the PHP container."""
    full_cmd = ["docker", "compose", "exec", "-T", "php", *shlex.split(cmd)]
    if stream:
        proc = subprocess.Popen(
            full_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, cwd=REPO_ROOT,
        )
        for line in proc.stdout:  # type: ignore[union-attr]
            print(line, end="", flush=True)
        proc.wait()
        return proc.returncode
    return subprocess.run(
        full_cmd, capture_output=True, text=True, check=check, cwd=REPO_ROOT,
    )


def _query_count(sql: str) -> int:
    """Run a COUNT query via psql in the postgres container. Returns count or 0 on error."""
    try:
        result = subprocess.run(
            ["docker", "compose", "exec", "-T", "postgres",
             "psql", "-U", "parthenon", "-d", "parthenon", "-tAc", sql],
            capture_output=True, text=True, check=True, cwd=REPO_ROOT,
        )
        return int(result.stdout.strip())
    except Exception:
        return 0
```

- [ ] **Step 3: Create eunomia loader**

```python
# datasets/loaders/eunomia.py
"""Eunomia GiBleed demo CDM loader."""
from __future__ import annotations

from pathlib import Path
from rich.console import Console
from . import _exec_php, _query_count


def is_loaded() -> bool:
    return _query_count("SELECT COUNT(*) FROM eunomia.person") > 0


def load(*, console: Console, downloads_dir: Path) -> bool:
    console.print("  [cyan]Loading Eunomia GiBleed dataset (2,694 patients)...[/cyan]")
    console.print("  Downloads from GitHub OHDSI, creates schemas, runs mini-Achilles.\n")
    rc = _exec_php("php artisan parthenon:load-eunomia --fresh --no-interaction", stream=True)
    return rc == 0
```

- [ ] **Step 4: Create vocabulary loader**

```python
# datasets/loaders/vocabulary.py
"""OMOP Vocabulary (Athena) loader — requires manual download."""
from __future__ import annotations

from pathlib import Path
import subprocess
from rich.console import Console
from . import _exec_php, _query_count, REPO_ROOT


def is_loaded() -> bool:
    return _query_count("SELECT COUNT(*) FROM omop.concept") > 0


def load(*, console: Console, downloads_dir: Path, zip_path: str | None = None) -> bool:
    """Load vocabulary. Pass zip_path for non-interactive mode."""
    if not zip_path:
        console.print(
            "  [bold yellow]OMOP Vocabulary requires manual download from Athena.[/bold yellow]\n"
            "  1. Go to [link=https://athena.ohdsi.org]https://athena.ohdsi.org[/link] (free registration)\n"
            "  2. Select your vocabularies and click Download\n"
            "  3. Enter the path to your downloaded ZIP below:\n"
        )

        import questionary
        zip_path = questionary.text(
            "  Path to Athena vocabulary ZIP (or 'skip' to skip):",
            validate=lambda p: True if p.strip().lower() == "skip" or Path(p.strip()).is_file() else "File not found",
        ).ask()

    if not zip_path or zip_path.strip().lower() == "skip":
        console.print("  [dim]Skipped vocabulary loading.[/dim]")
        return False

    zip_path = zip_path.strip()
    console.print(f"  [cyan]Loading vocabulary from {zip_path}...[/cyan]\n")

    # Copy ZIP into PHP container
    container_zip = "/var/www/html/storage/app/vocab-import.zip"
    cp_result = subprocess.run(
        ["docker", "compose", "cp", zip_path, f"php:{container_zip}"],
        capture_output=True, text=True, check=False, cwd=REPO_ROOT,
    )
    if cp_result.returncode != 0:
        console.print(f"  [red]Failed to copy ZIP into container.[/red]")
        return False

    rc = _exec_php(
        f"php artisan parthenon:load-vocabularies --zip={container_zip} --no-interaction",
        stream=True,
    )

    # Clean up
    subprocess.run(
        ["docker", "compose", "exec", "-T", "php", "rm", "-f", container_zip],
        capture_output=True, check=False, cwd=REPO_ROOT,
    )

    return rc == 0
```

- [ ] **Step 5: Create genomics loader (ClinVar + GIAB)**

```python
# datasets/loaders/genomics.py
"""Genomics loaders — ClinVar and GIAB VCF samples."""
from __future__ import annotations

from pathlib import Path
from rich.console import Console
from datasets.downloads import download_file, decompress_gz
from . import _exec_php, _query_count, REPO_ROOT


def is_loaded_clinvar() -> bool:
    return _query_count("SELECT COUNT(*) FROM app.clinvar_variants") > 0


def load_clinvar(*, console: Console, downloads_dir: Path) -> bool:
    console.print("  [cyan]Syncing ClinVar variant database...[/cyan]\n")
    rc = _exec_php("php artisan genomics:sync-clinvar --no-interaction", stream=True)
    return rc == 0


# GIAB sample URLs (keyed by dataset key suffix)
_GIAB_URLS: dict[str, tuple[str, str, str]] = {
    "hg001": (
        "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/NA12878_HG001/NISTv4.2.1/GRCh38/HG001_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG001_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG001_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg002": (
        "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/AshkenazimTrio/HG002_NA24385_son/NISTv4.2.1/GRCh38/HG002_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG002_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG002_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg003": (
        "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/AshkenazimTrio/HG003_NA24149_father/NISTv4.2.1/GRCh38/HG003_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG003_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG003_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg004": (
        "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/AshkenazimTrio/HG004_NA24143_mother/NISTv4.2.1/GRCh38/HG004_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG004_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG004_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg005": (
        "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/ChineseTrio/HG005_NA24631_son/NISTv4.2.1/GRCh38/HG005_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG005_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG005_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg006": (
        "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/ChineseTrio/HG006_NA24694_father/NISTv4.2.1/GRCh38/HG006_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG006_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG006_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg007": (
        "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release/ChineseTrio/HG007_NA24695_mother/NISTv4.2.1/GRCh38/HG007_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG007_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG007_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
}


def is_loaded_giab(sample_suffix: str) -> bool:
    sample_id = sample_suffix.upper()  # hg001 -> HG001
    return _query_count(
        f"SELECT COUNT(*) FROM app.genomic_uploads WHERE sample_name = '{sample_id}'"
    ) > 0


def load_giab(sample_suffix: str, *, console: Console, downloads_dir: Path) -> bool:
    url, gz_name, vcf_name = _GIAB_URLS[sample_suffix]
    sample_id = sample_suffix.upper()

    vcf_dir = REPO_ROOT / "vcf" / "giab_NISTv4.2.1"
    vcf_dir.mkdir(parents=True, exist_ok=True)
    gz_path = vcf_dir / gz_name
    vcf_path = vcf_dir / vcf_name

    console.print(f"  [cyan]Loading GIAB {sample_id}...[/cyan]")

    if vcf_path.exists() and vcf_path.stat().st_size > 0:
        console.print(f"  [green]VCF already on disk:[/green] {vcf_path.name}")
    else:
        if not download_file(url, gz_path, label=f"{sample_id}.vcf.gz", console=console):
            return False
        if not decompress_gz(gz_path, vcf_path, console=console):
            return False
        if gz_path.exists() and vcf_path.exists():
            gz_path.unlink()

    console.print(f"  [cyan]Importing {sample_id} VCF into database...[/cyan]\n")
    rc = _exec_php(
        f"php artisan genomics:import-vcf --dir=vcf/giab_NISTv4.2.1 --batch=500 --no-interaction",
        stream=True,
    )
    return rc == 0


# Dispatch functions used by the loader orchestrator
def is_loaded(dataset_key: str = "clinvar") -> bool:
    if dataset_key == "clinvar":
        return is_loaded_clinvar()
    suffix = dataset_key.replace("giab-", "")
    return is_loaded_giab(suffix)


def load(dataset_key: str = "clinvar", *, console: Console, downloads_dir: Path) -> bool:
    if dataset_key == "clinvar":
        return load_clinvar(console=console, downloads_dir=downloads_dir)
    suffix = dataset_key.replace("giab-", "")
    return load_giab(suffix, console=console, downloads_dir=downloads_dir)
```

- [ ] **Step 6: Create imaging loader**

```python
# datasets/loaders/imaging.py
"""DICOM imaging dataset loaders."""
from __future__ import annotations

from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from datasets.downloads import download_file, extract_tarball
from . import _exec_php, _query_count, REPO_ROOT

_MALOCCLUSION_URL = "https://github.com/sudoshi/parthenon-demo-data/releases/download/v1.0/class3-malocclusion.tar.gz"

_COVID19_INSTRUCTIONS = (
    "The Harvard COVID-19 CT dataset (242 GB) must be downloaded manually:\n\n"
    "  1. Visit The Cancer Imaging Archive (TCIA):\n"
    "     https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=80969742\n\n"
    "  2. Download using the NBIA Data Retriever\n"
    "  3. Set download directory to: dicom_samples/harvard_covid19/\n\n"
    "  4. After download, run:\n"
    "     docker compose exec php php artisan imaging:import-samples --dir=dicom_samples/harvard_covid19"
)


def is_loaded(dataset_key: str = "dicom-malocclusion") -> bool:
    if dataset_key == "dicom-malocclusion":
        return _query_count("SELECT COUNT(*) FROM app.imaging_studies") > 0
    # COVID-19 — check for substantial study count
    return _query_count("SELECT COUNT(*) FROM app.imaging_studies") > 100


def load(dataset_key: str = "dicom-malocclusion", *, console: Console, downloads_dir: Path) -> bool:
    if dataset_key == "dicom-covid19":
        console.print(Panel(
            _COVID19_INSTRUCTIONS,
            title="Manual Download Required — Harvard COVID-19 CT",
            border_style="yellow",
            padding=(1, 2),
        ))
        console.print("  [yellow]Skipping (manual download required).[/yellow]")
        return True  # Not a failure

    # Malocclusion
    extract_to = REPO_ROOT / "dicom_samples" / "Class-3-malocclusion"

    if extract_to.exists() and any(extract_to.iterdir()):
        console.print(f"  [green]Already on disk:[/green] {extract_to.relative_to(REPO_ROOT)}/")
    else:
        tar_path = downloads_dir / "class3-malocclusion.tar.gz"
        if not download_file(_MALOCCLUSION_URL, tar_path, label="class3-malocclusion.tar.gz", console=console):
            return False
        if not extract_tarball(tar_path, extract_to, console=console):
            return False
        if tar_path.exists():
            tar_path.unlink()

    console.print("  [cyan]Importing DICOM metadata...[/cyan]\n")
    rel_dir = str(extract_to.relative_to(REPO_ROOT))
    rc = _exec_php(
        f"php artisan imaging:import-samples --dir={rel_dir} --no-interaction",
        stream=True,
    )
    return rc == 0
```

- [ ] **Step 7: Create GIS loader**

```python
# datasets/loaders/gis.py
"""GIS boundary data loader — runs scripts/gis/load_all.py on the host.

The GIS loading pipeline requires geopandas/shapely/fiona and connects directly
to PostgreSQL. Since the scripts/gis/ directory is not mounted into any Docker
container, and the python-ai container mounts only ./ai:/app, we run the script
on the host with the correct DSN pointing to Docker postgres.

Prerequisites: pip install geopandas shapely fiona psycopg2-binary requests pandas
(see scripts/gis/requirements.txt)
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path
from rich.console import Console
from . import _query_count, REPO_ROOT


def is_loaded() -> bool:
    return _query_count("SELECT COUNT(*) FROM app.gis_admin_boundaries") > 0


def load(*, console: Console, downloads_dir: Path) -> bool:
    console.print("  [cyan]Loading US Census TIGER/Line boundaries + CDC/EPA/CMS data...[/cyan]")
    console.print("  This downloads and processes Census tracts, counties, SVI, air quality, and hospitals.\n")

    # Check if geopandas is available on the host
    try:
        subprocess.run(
            ["python3", "-c", "import geopandas"],
            capture_output=True, check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        console.print(
            "  [yellow]GIS loading requires Python packages not currently installed.[/yellow]\n"
            "  Install them with:\n"
            "    pip install -r scripts/gis/requirements.txt\n"
            "  Then re-run: ./parthenon-data --only gis-boundaries\n"
        )
        return False

    # Run load_all.py on the host, overriding DSN to point to Docker postgres.
    # The default DSN in load_all.py is hardcoded for the dev host DB — we override
    # via environment variable to target the Docker postgres container.
    env = {
        **os.environ,
        "DB_DSN": "host=localhost port=5480 dbname=parthenon user=parthenon password=secret "
                  "options='-c search_path=gis,public,app,topology'",
    }

    script_path = REPO_ROOT / "scripts" / "gis" / "load_all.py"
    if not script_path.exists():
        console.print(f"  [red]GIS loader script not found: {script_path}[/red]")
        return False

    proc = subprocess.Popen(
        ["python3", str(script_path), "--fetch"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=REPO_ROOT,
        env=env,
    )
    for line in proc.stdout:  # type: ignore[union-attr]
        print(line, end="", flush=True)
    proc.wait()

    if proc.returncode != 0:
        console.print("  [red]GIS loading failed.[/red]")
        console.print("  [dim]Retry: ./parthenon-data --only gis-boundaries[/dim]")
        return False

    return True
```

> **Note:** The `scripts/gis/load_all.py` script currently has a hardcoded `DB_DSN` on line 22.
> During implementation, either (a) modify `load_all.py` to read `DB_DSN` from environment
> variable with fallback to the current hardcoded value, or (b) accept the env override approach
> shown above if the script already supports `os.environ.get("DB_DSN", ...)`.


- [ ] **Step 8: Create phenotypes loader**

```python
# datasets/loaders/phenotypes.py
"""OHDSI Phenotype Library loader."""
from __future__ import annotations

from pathlib import Path
from rich.console import Console
from . import _exec_php, _query_count


def is_loaded() -> bool:
    return _query_count("SELECT COUNT(*) FROM app.phenotype_library") > 0


def load(*, console: Console, downloads_dir: Path) -> bool:
    console.print("  [cyan]Syncing OHDSI Phenotype Library (1,100+ definitions)...[/cyan]\n")
    rc = _exec_php("php artisan phenotype:sync --no-interaction", stream=True)
    return rc == 0
```

- [ ] **Step 9: Create Phase 2 stubs for SynPUF and SyntheA**

```python
# datasets/loaders/synpuf.py
"""CMS SynPUF loader — Phase 2 (not yet implemented)."""
from __future__ import annotations

from pathlib import Path
from rich.console import Console


def is_loaded(**kwargs) -> bool:
    return False


def load(*, console: Console, downloads_dir: Path, **kwargs) -> bool:
    console.print("  [yellow]CMS SynPUF loading is coming in a future release.[/yellow]")
    console.print("  [dim]Track progress: https://github.com/sudoshi/Parthenon/issues[/dim]")
    return False
```

```python
# datasets/loaders/synthea.py
"""SyntheA synthetic patient loader — Phase 2 (not yet implemented)."""
from __future__ import annotations

from pathlib import Path
from rich.console import Console


def is_loaded(**kwargs) -> bool:
    return False


def load(*, console: Console, downloads_dir: Path, **kwargs) -> bool:
    console.print("  [yellow]SyntheA loading is coming in a future release.[/yellow]")
    console.print("  [dim]Track progress: https://github.com/sudoshi/Parthenon/issues[/dim]")
    return False
```

- [ ] **Step 10: Verify all loaders import cleanly**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from datasets.loaders import eunomia, vocabulary, genomics, imaging, gis, phenotypes, synpuf, synthea; print('All loaders OK')"`

Expected: `All loaders OK`

- [ ] **Step 11: Commit**

```bash
git add datasets/loaders/
git commit -m "feat(datasets): add all loader modules (vocabulary, eunomia, genomics, imaging, gis, phenotypes)"
```

---

## Task 4: Loader orchestrator

**Files:**
- Create: `datasets/loader.py`

- [ ] **Step 1: Create the orchestrator**

```python
# datasets/loader.py
"""Loader orchestrator — resolves dependencies, runs loaders, reports results."""
from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.table import Table

from datasets.registry import DATASETS, resolve_dependencies

REPO_ROOT = Path(__file__).parent.parent
DOWNLOADS_DIR = REPO_ROOT / "downloads"


def _load_module(loader_path: str):
    """Dynamically import a loader module."""
    return importlib.import_module(loader_path)


def detect_loaded(console: Console) -> dict[str, bool]:
    """Check which datasets are already loaded. Returns {key: is_loaded}."""
    status: dict[str, bool] = {}
    for key, ds in DATASETS.items():
        if ds.phase > 1:
            status[key] = False
            continue
        try:
            mod = _load_module(ds.loader)
            # Genomics/imaging loaders need the dataset_key
            if hasattr(mod, "is_loaded"):
                import inspect
                sig = inspect.signature(mod.is_loaded)
                if "dataset_key" in sig.parameters:
                    status[key] = mod.is_loaded(dataset_key=key)
                else:
                    status[key] = mod.is_loaded()
            else:
                status[key] = False
        except Exception:
            status[key] = False
    return status


def run_selected(
    selected_keys: list[str],
    *,
    console: Console,
) -> dict[str, bool]:
    """Run loaders for selected datasets in dependency order.

    Returns {key: success_bool}.
    """
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    ordered = resolve_dependencies(selected_keys)
    results: dict[str, bool] = {}

    for key in ordered:
        ds = DATASETS.get(key)
        if not ds:
            continue

        console.rule(f"[bold]{ds.name}[/bold]")

        if ds.phase > 1:
            console.print(f"  [yellow]{ds.name} is coming in a future release.[/yellow]\n")
            results[key] = False
            continue

        try:
            mod = _load_module(ds.loader)

            # Check if already loaded
            import inspect
            sig = inspect.signature(mod.is_loaded)
            if "dataset_key" in sig.parameters:
                already = mod.is_loaded(dataset_key=key)
            else:
                already = mod.is_loaded()

            if already:
                console.print(f"  [green]Already loaded — skipping.[/green]\n")
                results[key] = True
                continue

            # Run loader
            sig_load = inspect.signature(mod.load)
            if "dataset_key" in sig_load.parameters:
                success = mod.load(
                    dataset_key=key,
                    console=console,
                    downloads_dir=DOWNLOADS_DIR,
                )
            else:
                success = mod.load(
                    console=console,
                    downloads_dir=DOWNLOADS_DIR,
                )

            results[key] = success
            if success:
                console.print(f"\n  [green]Done.[/green]\n")
            else:
                console.print(f"\n  [red]Failed.[/red]\n")

        except Exception as e:
            console.print(f"  [red]Error: {e}[/red]\n")
            results[key] = False

    return results


def print_summary(results: dict[str, bool], *, console: Console) -> None:
    """Print a summary table of load results."""
    table = Table(title="Dataset Loading Results")
    table.add_column("Dataset", style="bold")
    table.add_column("Status", width=12)
    table.add_column("Retry Command", style="dim")

    for key, success in results.items():
        ds = DATASETS.get(key)
        name = ds.name if ds else key
        if success:
            table.add_row(name, "[green]Loaded[/green]", "")
        else:
            retry = f"python3 -m datasets --only {key}" if ds and ds.phase == 1 else "Coming soon"
            table.add_row(name, "[red]Failed[/red]", retry)

    console.print()
    console.print(table)

    failed = [k for k, v in results.items() if not v and DATASETS.get(k, None) and DATASETS[k].phase == 1]
    if failed:
        console.print(f"\n[yellow]{len(failed)} dataset(s) failed.[/yellow]")
    else:
        loaded = [k for k, v in results.items() if v]
        console.print(f"\n[green]All {len(loaded)} dataset(s) loaded successfully.[/green]")


def run_from_installer(cfg: dict[str, Any]) -> None:
    """Entry point for the installer (Phase 5)."""
    console = Console()
    dataset_keys = cfg.get("datasets")

    if isinstance(dataset_keys, list) and dataset_keys:
        # Non-interactive: load specified datasets
        results = run_selected(dataset_keys, console=console)
        print_summary(results, console=console)
    else:
        # Interactive: launch full TUI
        from datasets.tui import main
        main()
```

- [ ] **Step 2: Verify orchestrator imports**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from datasets.loader import detect_loaded, run_selected, print_summary; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add datasets/loader.py
git commit -m "feat(datasets): add loader orchestrator with dependency resolution and summary"
```

---

## Task 5: TUI

**Files:**
- Create: `datasets/tui.py`

- [ ] **Step 1: Create the full TUI with all 4 screens**

```python
# datasets/tui.py
"""Rich/questionary TUI for dataset selection and loading."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import questionary
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from installer.utils import (
    docker_daemon_running,
    container_health,
    free_disk_gb,
)
from datasets.registry import (
    BUNDLES,
    CATEGORIES,
    DATASETS,
    get_added_dependencies,
    resolve_dependencies,
)
from datasets.loader import detect_loaded, print_summary, run_selected

console = Console()
REPO_ROOT = Path(__file__).parent.parent


# ── Screen 1: System status ───────────────────────────────────────────────

def _check_system() -> bool:
    """Check Docker, PHP, Postgres, disk space. Returns True if all OK."""
    console.print(
        Panel(
            "[bold cyan]Parthenon Dataset Acquisition[/bold cyan]\n"
            "[dim]Browse and load public OHDSI datasets[/dim]",
            border_style="cyan",
            padding=(1, 4),
        )
    )
    console.print("  Checking system status...\n")

    checks_ok = True

    # Docker daemon (uses installer/utils.py)
    if docker_daemon_running():
        console.print("  [green]OK[/green] Docker running")
    else:
        console.print("  [red]FAIL[/red] Docker is not running")
        checks_ok = False

    # PHP container (uses installer/utils.py)
    php_status = container_health("parthenon-php")
    if php_status in ("healthy", "running"):
        console.print(f"  [green]OK[/green] PHP container ({php_status})")
    else:
        console.print(f"  [red]FAIL[/red] PHP container is {php_status} — run: docker compose up -d")
        checks_ok = False

    # Postgres container
    pg_status = container_health("parthenon-postgres")
    if pg_status in ("healthy", "running"):
        console.print(f"  [green]OK[/green] PostgreSQL reachable")
    else:
        console.print(f"  [red]FAIL[/red] PostgreSQL container is {pg_status}")
        checks_ok = False

    # Disk space (uses installer/utils.py)
    free_gb = free_disk_gb(REPO_ROOT)
    console.print(f"  [green]OK[/green] {free_gb:.0f} GB free disk space")

    if not checks_ok:
        console.print("\n  [red]System checks failed. Fix the issues above and retry.[/red]")
        return False

    # Already loaded
    console.print("\n  Detecting loaded datasets...")
    loaded = detect_loaded(console)
    loaded_names = [DATASETS[k].name for k, v in loaded.items() if v]
    if loaded_names:
        console.print(f"\n  [green]Already loaded ({len(loaded_names)}):[/green]")
        for name in loaded_names:
            console.print(f"    [green]OK[/green] {name}")
    else:
        console.print("\n  [dim]No datasets loaded yet.[/dim]")

    console.print()
    return True


# ── Screen 2: Selection mode ──────────────────────────────────────────────

def _choose_mode() -> str | None:
    """Ask user: bundle or a la carte. Returns 'bundle' or 'alacarte'."""
    return questionary.select(
        "How would you like to select datasets?",
        choices=[
            questionary.Choice("Start with a recommended bundle", value="bundle"),
            questionary.Choice("Pick individual datasets (a la carte)", value="alacarte"),
            questionary.Choice("Exit", value="exit"),
        ],
    ).ask()


def _choose_bundle() -> list[str] | None:
    """Show bundles and return pre-selected dataset keys."""
    table = Table(title="Recommended Bundles", show_lines=True)
    table.add_column("Bundle", style="bold cyan", width=18)
    table.add_column("Description", width=65)

    for bundle in BUNDLES:
        table.add_row(bundle.name, bundle.description)

    console.print()
    console.print(table)
    console.print()

    choices = [
        questionary.Choice(title=b.name, value=b.key)
        for b in BUNDLES
    ]
    choices.append(questionary.Choice(title="Back", value="back"))

    selected = questionary.select("Choose a bundle:", choices=choices).ask()

    if not selected or selected == "back":
        return None

    bundle = next(b for b in BUNDLES if b.key == selected)
    return list(bundle.dataset_keys)


# ── Screen 3: Dataset picker ─────────────────────────────────────────────

def _pick_datasets(preselected: list[str] | None = None) -> list[str] | None:
    """Checkbox picker grouped by category. Returns selected keys or None."""
    loaded = detect_loaded(console)
    preselected = preselected or []

    choices = []
    for cat_key, cat_label in CATEGORIES:
        # Category separator
        choices.append(questionary.Separator(f"── {cat_label} ──"))

        cat_datasets = [
            ds for ds in DATASETS.values()
            if ds.category == cat_key
        ]

        for ds in cat_datasets:
            # Build label
            label = f"{ds.name}  [{ds.size_estimate}]"

            if loaded.get(ds.key):
                label += "  [already loaded]"
            if not ds.auto_downloadable:
                label += "  [manual download]"
            if ds.phase > 1:
                label += "  [coming soon]"

            disabled = None
            if loaded.get(ds.key):
                disabled = "already loaded"
            elif ds.phase > 1:
                disabled = "coming soon"

            checked = ds.key in preselected and not loaded.get(ds.key)

            choices.append(
                questionary.Choice(
                    title=label,
                    value=ds.key,
                    checked=checked,
                    disabled=disabled,
                )
            )

    selected = questionary.checkbox(
        "Select datasets to install (space to toggle, enter to confirm):",
        choices=choices,
    ).ask()

    if not selected:
        return None

    # Show auto-added dependencies
    added = get_added_dependencies(selected)
    if added:
        console.print(f"\n  [cyan]Auto-adding dependencies:[/cyan]")
        for dep_key in added:
            dep = DATASETS[dep_key]
            console.print(f"    + {dep.name} (required)")
        selected = list(set(selected) | set(added))

    return selected


# ── Screen 4: Confirmation + execution ────────────────────────────────────

def _confirm_and_run(selected_keys: list[str]) -> None:
    """Show confirmation, then execute loaders."""
    ordered = resolve_dependencies(selected_keys)

    # Disk tally
    total_download = sum(DATASETS[k].size_download_mb for k in ordered if k in DATASETS)
    total_loaded = sum(DATASETS[k].size_loaded_mb for k in ordered if k in DATASETS)

    console.print(f"\n  [bold]Ready to install {len(ordered)} dataset(s):[/bold]\n")
    for i, key in enumerate(ordered, 1):
        ds = DATASETS[key]
        flags = ""
        if not ds.auto_downloadable:
            flags = "  [yellow](manual download)[/yellow]"
        console.print(f"    {i}. {ds.name}{flags}")

    console.print(f"\n  [dim]Download: ~{total_download / 1024:.1f} GB | Loaded: ~{total_loaded / 1024:.1f} GB[/dim]")

    proceed = questionary.confirm("\n  Proceed?", default=True).ask()
    if not proceed:
        console.print("  [dim]Cancelled.[/dim]")
        return

    console.print()
    results = run_selected(ordered, console=console)
    print_summary(results, console=console)


# ── Main entry point ──────────────────────────────────────────────────────

def main() -> None:
    """Main TUI entry point."""
    if not _check_system():
        sys.exit(1)

    mode = _choose_mode()
    if mode == "exit" or mode is None:
        return

    if mode == "bundle":
        preselected = _choose_bundle()
        if preselected is None:
            # User chose "Back" — fall through to a la carte
            preselected = None
    else:
        preselected = None

    selected = _pick_datasets(preselected)
    if not selected:
        console.print("  [dim]No datasets selected.[/dim]")
        return

    _confirm_and_run(selected)
```

- [ ] **Step 2: Verify TUI imports without errors**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from datasets.tui import main; print('TUI OK')"`

Expected: `TUI OK`

- [ ] **Step 3: Commit**

```bash
git add datasets/tui.py
git commit -m "feat(datasets): add TUI with system check, bundle selection, a la carte picker, and execution"
```

---

## Task 6: Entry points + convenience script

**Files:**
- Create: `parthenon-data` (shell script at repo root)
- Modify: `datasets/__main__.py` (already created but placeholder — verify it works)

- [ ] **Step 1: Update `__main__.py` with CLI argument support**

```python
# datasets/__main__.py
"""Entry point: python3 -m datasets"""
import argparse
import sys

from rich.console import Console


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Parthenon Dataset Acquisition — browse and load public OHDSI datasets",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="KEY",
        help="Load specific datasets by key (non-interactive)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available datasets and exit",
    )
    args = parser.parse_args()

    if args.list:
        from datasets.registry import DATASETS, CATEGORIES
        console = Console()
        for cat_key, cat_label in CATEGORIES:
            console.print(f"\n[bold]{cat_label}[/bold]")
            for ds in DATASETS.values():
                if ds.category == cat_key:
                    phase_tag = " [dim](coming soon)[/dim]" if ds.phase > 1 else ""
                    console.print(f"  {ds.key:25s} {ds.size_estimate:30s}{phase_tag}")
        return

    if args.only:
        from datasets.loader import run_selected, print_summary
        console = Console()
        results = run_selected(args.only, console=console)
        print_summary(results, console=console)
        sys.exit(0 if all(results.values()) else 1)

    # Default: interactive TUI
    from datasets.tui import main
    main()


if __name__ == "__main__":
    cli()
```

- [ ] **Step 2: Create convenience shell script**

```bash
#!/usr/bin/env bash
# parthenon-data — Dataset acquisition utility
# Usage: ./parthenon-data [--list] [--only key1 key2 ...]
set -euo pipefail
cd "$(dirname "$0")"
exec python3 -m datasets "$@"
```

Save to `/home/smudoshi/Github/Parthenon/parthenon-data` and make executable.

- [ ] **Step 3: Verify entry points**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -m datasets --list`

Expected: List of all datasets grouped by category.

Run: `./parthenon-data --list`

Expected: Same output.

- [ ] **Step 4: Commit**

```bash
git add datasets/__main__.py parthenon-data
git commit -m "feat(datasets): add CLI entry points and parthenon-data convenience script"
```

---

## Task 7: Installer integration + demo_data.py migration

**Files:**
- Modify: `installer/cli.py` (lines 265-333)
- Modify: `installer/demo_data.py` (entire file — replace with shim)

- [ ] **Step 1: Replace Phase 5 + 5b in `installer/cli.py` with unified datasets phase**

Replace the Phase 5 (Eunomia), Phase 5b (Vocabulary), and their state tracking with a single Phase 5 that delegates to the datasets module:

In `installer/cli.py`, replace lines from `# Phase 5 — Eunomia` through the end of Phase 5b vocabulary block (through `completed.append("vocabulary")`) with:

```python
    # -----------------------------------------------------------------------
    # Phase 5 — Dataset Acquisition
    # -----------------------------------------------------------------------
    if "datasets" not in completed:
        console.rule("[bold]Phase 5 — Dataset Acquisition[/bold]")

        # Determine which datasets to load
        dataset_keys = cfg.get("datasets")

        if not dataset_keys:
            # Build default list from legacy config flags
            dataset_keys = []
            if cfg.get("include_eunomia", True):
                dataset_keys.append("eunomia")

        if dataset_keys:
            from datasets.loader import run_selected, print_summary
            results = run_selected(dataset_keys, console=console)
            print_summary(results, console=console)
        else:
            console.print("[dim]No datasets selected during configuration.[/dim]")
            console.print(
                "  Run [bold]./parthenon-data[/bold] after installation to load datasets.\n"
            )

        # Handle vocabulary separately if ZIP was provided (legacy config path)
        vocab_zip = cfg.get("vocab_zip_path")
        if vocab_zip and "vocabulary" not in (dataset_keys or []):
            from datasets.loaders.vocabulary import load as load_vocab
            load_vocab(console=console, downloads_dir=REPO_ROOT / "downloads")

        completed.append("datasets")
        _save_state({"completed_phases": completed, "config": cfg})
```

Also remove the `eunomia` import at the top of the file (line 17: `from . import preflight, config, docker_ops, bootstrap, eunomia, utils`), changing it to:

```python
from . import preflight, config, docker_ops, bootstrap, utils
```

- [ ] **Step 2: Add REPO_ROOT to cli.py if not present**

Add near the top of `installer/cli.py` (after imports):

```python
REPO_ROOT = utils.REPO_ROOT
```

- [ ] **Step 3: Replace `demo_data.py` with thin shim**

```python
# installer/demo_data.py
"""Compatibility shim — delegates to datasets/ package.

This file preserves backward compatibility for code that imports from
installer.demo_data. All functionality has moved to the datasets/ package.
"""
from __future__ import annotations

from datasets.tui import main as run_standalone  # noqa: F401
from datasets.loader import run_selected as run  # noqa: F401

__all__ = ["run", "run_standalone"]
```

- [ ] **Step 4: Verify installer can import without errors**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from installer.cli import run; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Verify shim imports work**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from installer.demo_data import run, run_standalone; print('Shim OK')"`

Expected: `Shim OK`

- [ ] **Step 6: Commit**

```bash
git add installer/cli.py installer/demo_data.py
git commit -m "feat(datasets): integrate with installer Phase 5 and replace demo_data.py with shim"
```

---

## Task 8: Final verification

- [ ] **Step 1: Python syntax check on all new files**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -m py_compile datasets/__init__.py && python3 -m py_compile datasets/__main__.py && python3 -m py_compile datasets/registry.py && python3 -m py_compile datasets/downloads.py && python3 -m py_compile datasets/tui.py && python3 -m py_compile datasets/loader.py && python3 -m py_compile datasets/loaders/__init__.py && python3 -m py_compile datasets/loaders/eunomia.py && python3 -m py_compile datasets/loaders/vocabulary.py && python3 -m py_compile datasets/loaders/genomics.py && python3 -m py_compile datasets/loaders/imaging.py && python3 -m py_compile datasets/loaders/gis.py && python3 -m py_compile datasets/loaders/phenotypes.py && python3 -m py_compile datasets/loaders/synpuf.py && python3 -m py_compile datasets/loaders/synthea.py && echo "All files compile OK"`

Expected: `All files compile OK`

- [ ] **Step 2: Run `--list` to verify registry loads correctly**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -m datasets --list`

Expected: 17 datasets listed across 6 categories, with Phase 2 items marked "coming soon".

- [ ] **Step 3: Verify dependency resolution**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from datasets.registry import resolve_dependencies; print(resolve_dependencies(['synpuf-1k', 'eunomia']))"`

Expected: `['eunomia', 'vocabulary', 'synpuf-1k']` (vocabulary auto-added, eunomia first since no deps)

- [ ] **Step 4: Commit final state**

```bash
git add datasets/ parthenon-data installer/cli.py installer/demo_data.py
git commit -m "feat(datasets): complete dataset acquisition TUI with 17 datasets, bundles, and installer integration"
```
