from __future__ import annotations

import importlib.util
import io
import sys
import tarfile
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "OHDSI-scraper" / "harvester.py"
SPEC = importlib.util.spec_from_file_location("ohdsi_harvester_test", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
ohdsi_harvester = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = ohdsi_harvester
SPEC.loader.exec_module(ohdsi_harvester)


class DummyResponse:
    def __init__(self, *, text: str = "", content: bytes = b"", status_code: int = 200):
        self.text = text
        self.content = content
        self.status_code = status_code
        self.headers: dict[str, str] = {}

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"status={self.status_code}")


def build_tar_gz(files: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name, contents in files.items():
            encoded = contents
            info = tarfile.TarInfo(name=name)
            info.size = len(encoded)
            archive.addfile(info, io.BytesIO(encoded))
    return buffer.getvalue()


def test_download_pmc_pdf_uses_oa_package_and_extracts_primary_pdf(tmp_path, monkeypatch):
    package_bytes = build_tar_gz(
        {
            "PMC123/example_supplement.pdf": b"%PDF-supplement",
            "PMC123/example.pdf": b"%PDF-primary",
        }
    )

    def fake_session_get(url, params=None, timeout=None):
        assert url == "https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi"
        assert params == {"id": "PMC123"}
        return DummyResponse(
            text=(
                '<OA><records><record id="PMC123">'
                '<link format="tgz" href="ftp://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_package/example.tar.gz" />'
                "</record></records></OA>"
            )
        )

    def fake_requests_get(url, timeout=None, allow_redirects=None, headers=None):
        assert url == "https://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_package/example.tar.gz"
        return DummyResponse(content=package_bytes)

    monkeypatch.setattr(ohdsi_harvester, "session", type("Session", (), {"get": staticmethod(fake_session_get), "headers": {"User-Agent": "test-agent"}})())
    monkeypatch.setattr(ohdsi_harvester.requests, "get", fake_requests_get)
    monkeypatch.setitem(ohdsi_harvester.CONFIG, "pubmed_delay", 0.0)
    monkeypatch.setitem(ohdsi_harvester.CONFIG, "download_delay", 0.0)

    destination = tmp_path / "paper.pdf"
    assert ohdsi_harvester.download_pmc_pdf("PMC123", str(destination)) == (
        True,
        "pmc_oa_package",
        None,
    )
    assert destination.read_bytes() == b"%PDF-primary"


def test_phase4_unpaywall_enrichment_uses_europepmc_for_pmcid_records(monkeypatch):
    paper = ohdsi_harvester.Paper(
        title="Example",
        doi="10.1000/example",
        pmcid="PMC123",
    )

    monkeypatch.setattr(ohdsi_harvester, "unpaywall_lookup", lambda doi: None)
    monkeypatch.setattr(
        ohdsi_harvester,
        "europepmc_lookup",
        lambda pmcid=None, doi=None: "https://europepmc.org/articles/PMC123?pdf=render",
    )

    enriched = ohdsi_harvester.phase4_unpaywall_enrichment([paper])
    assert enriched[0].oa_url == "https://europepmc.org/articles/PMC123?pdf=render"
    assert enriched[0].is_oa is True
