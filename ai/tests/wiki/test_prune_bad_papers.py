from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import fitz


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "wiki_prune_bad_papers.py"
SPEC = importlib.util.spec_from_file_location("wiki_prune_bad_papers", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
wiki_prune_bad_papers = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = wiki_prune_bad_papers
SPEC.loader.exec_module(wiki_prune_bad_papers)


def write_pdf(path: Path) -> None:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "Example PDF")
    document.save(path)
    document.close()


def write_source_summary(path: Path, title: str, body_lines: list[str]) -> None:
    body = "\n".join(body_lines)
    path.write_text(
        "\n".join(
            [
                "---",
                f"title: {title}",
                f"slug: {path.stem}",
                "type: source_summary",
                "---",
                "",
                body,
                "",
            ]
        ),
        encoding="utf-8",
    )


def test_truncated_title_detected_from_first_page_preview(tmp_path):
    source_path = tmp_path / "paper.pdf"
    write_pdf(source_path)

    summary_path = tmp_path / "paper.md"
    write_source_summary(
        summary_path,
        "Offline and online data assimilation for real-time blood",
        [
            "Offline and online data assimilation for real-time blood",
            "glucose forecasting in type 2 diabetes",
            "Author Name",
        ],
    )

    record = wiki_prune_bad_papers.PaperRecord(
        slug="paper",
        title="Offline and online data assimilation for real-time blood",
        source_summary_path=summary_path,
        source_path=source_path,
    )

    assert wiki_prune_bad_papers.is_truncated_title(record) is True


def test_complete_title_not_flagged_when_preview_only_adds_authors(tmp_path):
    source_path = tmp_path / "paper.pdf"
    write_pdf(source_path)

    summary_path = tmp_path / "paper.md"
    write_source_summary(
        summary_path,
        "Comparison of First-Line Dual Combination Treatments in Hypertension: Real-World Evidence from Multinational Heterogeneous Cohorts",
        [
            "Comparison of First-Line Dual Combination Treatments in Hypertension: Real-World Evidence from Multinational Heterogeneous Cohorts",
            "Author Name",
        ],
    )

    record = wiki_prune_bad_papers.PaperRecord(
        slug="paper",
        title="Comparison of First-Line Dual Combination Treatments in Hypertension: Real-World Evidence from Multinational Heterogeneous Cohorts",
        source_summary_path=summary_path,
        source_path=source_path,
    )

    assert wiki_prune_bad_papers.is_truncated_title(record) is False


def test_evaluate_papers_flags_missing_invalid_and_junk_titles(tmp_path):
    workspace = tmp_path / "platform"
    summaries = workspace / "wiki" / "source_summaries"
    sources = workspace / "sources"
    summaries.mkdir(parents=True)
    sources.mkdir(parents=True)

    write_source_summary(summaries / "missing.md", "Good Title", ["Good Title"])

    invalid_summary = summaries / "invalid.md"
    write_source_summary(invalid_summary, "Received: 1 July 2025", ["Received: 1 July 2025"])
    (sources / "invalid.pdf").write_text("<html>not a pdf</html>", encoding="utf-8")

    valid_summary = summaries / "valid.md"
    write_source_summary(valid_summary, "Valid Title", ["Valid Title", "Author Name"])
    write_pdf(sources / "valid.pdf")

    records = {
        "missing": wiki_prune_bad_papers.PaperRecord(
            slug="missing",
            title="Good Title",
            source_summary_path=summaries / "missing.md",
            source_path=sources / "missing.pdf",
        ),
        "invalid": wiki_prune_bad_papers.PaperRecord(
            slug="invalid",
            title="Received: 1 July 2025",
            source_summary_path=invalid_summary,
            source_path=sources / "invalid.pdf",
        ),
        "valid": wiki_prune_bad_papers.PaperRecord(
            slug="valid",
            title="Valid Title",
            source_summary_path=valid_summary,
            source_path=sources / "valid.pdf",
        ),
    }

    issues = wiki_prune_bad_papers.evaluate_papers(records)
    issue_map = {issue.slug: set(issue.reasons) for issue in issues}

    assert issue_map["missing"] == {"missing_pdf"}
    assert issue_map["invalid"] == {"invalid_pdf", "received_title"}
    assert "valid" not in issue_map
