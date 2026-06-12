"""Custom Claude Agent SDK tools for the Abby study orchestrator (ADR-0020 Phase 5).

Each tool is a thin authenticated client over an existing Laravel route built in
Phases 1-4 (gate ledger, empirical calibration, cohort diagnostics, study
packages). The agent drives the protocol-to-publication workflow but never
decides scientific validity: gate approvals and overrides are human-only (the
StudyGatesTab UI), and the execute tools here (``evaluate_gates``,
``build_study_package``) are approval-gated writes routed through the harness's
``can_use_tool`` callback.
"""

from __future__ import annotations

import logging
from typing import Any

from claude_agent_sdk import tool

from app.agents.tool_base import AgentToolContext, error_result, request

logger = logging.getLogger(__name__)


def _require_study(ctx: AgentToolContext) -> dict[str, Any] | None:
    """Guard for study-scoped tools: a clear error if no study is selected."""
    if not ctx.context.get("study_slug"):
        return error_result(
            "No study is selected. A study_slug is required before using the Abby tools."
        )
    return None


def _slug(ctx: AgentToolContext) -> str:
    return str(ctx.context["study_slug"])


def build_tool_pack(ctx: AgentToolContext) -> list:
    """Read tools (auto-approved) + execute tools (approval-gated) for Abby."""

    @tool(
        "get_study_overview",
        "Get the study's metadata, status, and design (PICO / objectives). Use first to orient.",
        {},
    )
    async def get_study_overview(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "GET", f"studies/{_slug(ctx)}")

    @tool(
        "get_study_progress",
        "Get execution progress of the study's analyses (queued / running / completed / failed).",
        {},
    )
    async def get_study_progress(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "GET", f"studies/{_slug(ctx)}/progress")

    @tool(
        "get_gate_status",
        "Get the study's scientific gate ledger: each stage's status "
        "(pending/passed/failed/overridden/approved), the metrics evaluated, and any "
        "failure reasons. Use this to decide what is blocking the study.",
        {},
    )
    async def get_gate_status(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "GET", f"studies/{_slug(ctx)}/gates")

    @tool(
        "get_study_results",
        "Get the study's curated results (characterization, incidence_rate, effect_estimate, …) "
        "as projected into the Results tab — including each row's publishability and, for "
        "comparative effect estimates, the diagnostics that gate it. Pass publishable_only=true to "
        "see only the rows cleared for publication. Use this to discuss what the study found.",
        {"publishable_only": bool},
    )
    async def get_study_results(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        params = {"per_page": 100}
        if args.get("publishable_only"):
            params["publishable_only"] = True
        return await request(ctx, "GET", f"studies/{_slug(ctx)}/results", params=params)

    @tool(
        "get_manuscript",
        "Get the composed STROBE/RECORD manuscript for the study (title, sections, and which "
        "effect estimates are included vs. blinded). Use this to discuss or summarize the "
        "draft the study currently supports. Composition is read-only — it never unblinds a "
        "withheld estimate.",
        {},
    )
    async def get_manuscript(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "GET", f"studies/{_slug(ctx)}/manuscript")

    @tool(
        "evaluate_gates",
        "Recompute the study's estimation-derived gates (study diagnostics S5, empirical "
        "calibration S6) from the latest completed estimation execution. This only COMPUTES "
        "pass/fail from the diagnostics — it never approves a gate. Approving or overriding a "
        "failed gate is the principal investigator's or lead statistician's decision in the UI.",
        {},
    )
    async def evaluate_gates(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "POST", f"studies/{_slug(ctx)}/gates/evaluate", json_body={})

    @tool(
        "reproject_results",
        "Refresh the study's curated results from the latest completed executions and the "
        "current gate ledger. Idempotent and non-destructive: reviewer curation is preserved and "
        "only the publishability of comparative effect estimates moves with the gate state. Use "
        "this after evaluate_gates so the Results tab and manuscript reflect the new verdict. "
        "A WRITE — requires explicit human approval before execution.",
        {},
    )
    async def reproject_results(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "POST", f"studies/{_slug(ctx)}/results/reproject", json_body={})

    @tool(
        "build_study_package",
        "Build a reproducible study-package snapshot (definition hashes, compiled-SQL "
        "fingerprints, calibrated results, the gate-ledger decision trail). Use once the study "
        "has cleared its gates and is publication-ready. "
        "A WRITE — requires explicit human approval before execution.",
        {},
    )
    async def build_study_package(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "POST", f"studies/{_slug(ctx)}/package", json_body={})

    @tool(
        "open_in_publisher",
        "Seed (or reopen) an editorial draft in the Publisher from the study's composed "
        "manuscript, so the author can refine it. Returns the draft id. Use once the study's "
        "results are ready to write up. A WRITE — requires explicit human approval before "
        "execution.",
        {},
    )
    async def open_in_publisher(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_study(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "POST", f"studies/{_slug(ctx)}/manuscript/draft", json_body={})

    return [
        get_study_overview,
        get_study_progress,
        get_gate_status,
        get_study_results,
        get_manuscript,
        evaluate_gates,
        reproject_results,
        build_study_package,
        open_in_publisher,
    ]
