"""Render NerEvalReport to a markdown file via a Jinja2 template."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any

import jinja2

if TYPE_CHECKING:
    from runtime.nlp.eval.runner import NerEvalReport

_HERE = Path(__file__).resolve().parent
_TEMPLATE_PATH = _HERE / "report_template.md.j2"


def _build_context(report: NerEvalReport) -> dict[str, Any]:
    runs = {r.name: r for r in report.runs}
    return {
        "n_notes": report.n_notes,
        "n_gold_spans": report.n_gold_spans,
        "runs": runs,
        "ordered_runs": list(report.runs),
        "graduation_threshold_pp": 5.0,
        "_pct": lambda x: f"{(x * 100):.1f}%",
    }


def render_report(report: NerEvalReport, out_dir: Path) -> Path:
    """Render ``report`` to ``out_dir/ner_backend_comparison.md``."""
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(_HERE),
        autoescape=False,
        undefined=jinja2.StrictUndefined,
    )
    tpl = env.get_template("report_template.md.j2")
    body = tpl.render(**_build_context(report))
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "ner_backend_comparison.md"
    out.write_text(body, encoding="utf-8")
    return out
