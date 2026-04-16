"""Bidirectional entity mapper between GSD, OpenProject, and GitHub.

Translates status values, builds work-package descriptions, and generates
label lists for sync operations.
"""
from __future__ import annotations

from .gsd_parser import PlanDetail, QuickTask, RoadmapPhase

# ---------------------------------------------------------------------------
# OpenProject status IDs
# ---------------------------------------------------------------------------

OP_STATUS_NEW = 1
OP_STATUS_IN_PROGRESS = 7
OP_STATUS_CLOSED = 12

# ---------------------------------------------------------------------------
# OpenProject type IDs
# ---------------------------------------------------------------------------

OP_TYPE_TASK = 1
OP_TYPE_MILESTONE = 2
OP_TYPE_SUMMARY = 3
OP_TYPE_FEATURE = 4
OP_TYPE_EPIC = 5

# ---------------------------------------------------------------------------
# GitHub label colors
# ---------------------------------------------------------------------------

LABEL_COLORS: dict[str, str] = {
    "phase": "5319E7",
    "plan": "1D76DB",
    "quick": "D93F0B",
    "req": "0E8A16",
    "in-progress": "FBCA04",
    "synced-by:n8n": "EDEDED",
}

# Sync marker appended to every description so n8n can detect managed content.
_SYNC_MARKER = "<!-- n8n-sync -->"


# ---------------------------------------------------------------------------
# Status mapping — GSD ↔ OpenProject
# ---------------------------------------------------------------------------


def gsd_status_to_op_status_id(status: str) -> int:
    """Map a GSD status string to an OpenProject status ID.

    pending   → OP_STATUS_NEW (1)
    executing → OP_STATUS_IN_PROGRESS (7)
    complete  → OP_STATUS_CLOSED (12)
    """
    mapping: dict[str, int] = {
        "pending": OP_STATUS_NEW,
        "executing": OP_STATUS_IN_PROGRESS,
        "complete": OP_STATUS_CLOSED,
    }
    return mapping.get(status, OP_STATUS_NEW)


def op_status_to_gsd_status(status_id: int) -> str:
    """Map an OpenProject status ID to a GSD status string.

    CLOSED (12)      → complete
    IN_PROGRESS (7)  → executing
    anything else    → pending
    """
    if status_id == OP_STATUS_CLOSED:
        return "complete"
    if status_id == OP_STATUS_IN_PROGRESS:
        return "executing"
    return "pending"


def op_status_name_to_gsd_status(name: str) -> str:
    """Map an OpenProject status name to a GSD status string.

    "Closed" / "Rejected"                          → complete
    "In progress" / "Developed" / similar active   → executing
    anything else                                   → pending
    """
    normalized = name.strip().lower()
    if normalized in ("closed", "rejected"):
        return "complete"
    if normalized in ("in progress", "developed", "in development", "testing", "review"):
        return "executing"
    return "pending"


# ---------------------------------------------------------------------------
# Status mapping — GSD ↔ GitHub
# ---------------------------------------------------------------------------


def gsd_status_to_gh_state(status: str) -> str:
    """Map a GSD status string to a GitHub issue state.

    complete → "closed"
    else     → "open"
    """
    return "closed" if status == "complete" else "open"


def gh_state_to_gsd_status(state: str) -> str:
    """Map a GitHub issue state to a GSD status string.

    "closed" → complete
    else     → pending
    """
    return "complete" if state == "closed" else "pending"


# ---------------------------------------------------------------------------
# Description builders — OpenProject work packages
# ---------------------------------------------------------------------------


def phase_to_wp_description(phase: RoadmapPhase) -> str:
    """Build a markdown description for a phase work package.

    Sections: Goal, Requirements, Depends on, Success Criteria, Plans,
    Completed date.  Ends with the n8n-sync marker.
    """
    lines: list[str] = []

    if phase.goal:
        lines.append(f"**Goal**: {phase.goal}")
        lines.append("")

    if phase.requirements:
        lines.append(f"**Requirements**: {', '.join(phase.requirements)}")
        lines.append("")

    if phase.depends_on:
        dep_str = ", ".join(f"Phase {n}" for n in phase.depends_on)
        lines.append(f"**Depends on**: {dep_str}")
        lines.append("")

    if phase.success_criteria:
        lines.append("**Success Criteria**")
        for i, criterion in enumerate(phase.success_criteria, start=1):
            lines.append(f"{i}. {criterion}")
        lines.append("")

    if phase.plans:
        lines.append("**Plans**")
        for plan_entry in phase.plans:
            lines.append(f"- {plan_entry}")
        lines.append("")

    if phase.completed_date:
        lines.append(f"**Completed**: {phase.completed_date}")
        lines.append("")

    lines.append(_SYNC_MARKER)
    return "\n".join(lines)


def plan_to_wp_description(plan: PlanDetail) -> str:
    """Build a markdown description for a plan work package.

    Sections: Objective, Requirements, Acceptance Criteria (checkboxes from
    must_have_truths), Files Modified.  Ends with n8n-sync marker.
    """
    lines: list[str] = []

    if plan.objective:
        lines.append(f"**Objective**: {plan.objective}")
        lines.append("")

    if plan.requirements:
        lines.append(f"**Requirements**: {', '.join(plan.requirements)}")
        lines.append("")

    if plan.must_have_truths:
        lines.append("**Acceptance Criteria**")
        for truth in plan.must_have_truths:
            lines.append(f"- [ ] {truth}")
        lines.append("")

    if plan.files_modified:
        lines.append("**Files Modified**")
        for filepath in plan.files_modified:
            lines.append(f"- `{filepath}`")
        lines.append("")

    lines.append(_SYNC_MARKER)
    return "\n".join(lines)


def quick_task_to_wp_description(task: QuickTask) -> str:
    """Build a markdown description for a quick-task work package.

    Includes description, date, and commit hash.  Ends with n8n-sync marker.
    """
    lines: list[str] = []

    lines.append(f"**Quick Task**: {task.description}")
    lines.append("")
    lines.append(f"**Date**: {task.date}")
    lines.append("")

    if task.commit_hash:
        lines.append(f"**Commit**: `{task.commit_hash}`")
        lines.append("")

    lines.append(_SYNC_MARKER)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Description builders — GitHub issues
# ---------------------------------------------------------------------------


def phase_to_gh_issue_body(phase: RoadmapPhase) -> str:
    """Build a GitHub issue body for a phase.

    Sections: H2 header, goal, Success Criteria checkboxes, Plans list.
    Ends with a "Synced from .planning/ROADMAP.md" attribution note.
    """
    lines: list[str] = []

    lines.append(f"## Phase {phase.number}: {phase.name}")
    lines.append("")

    if phase.goal:
        lines.append(phase.goal)
        lines.append("")

    if phase.success_criteria:
        lines.append("### Success Criteria")
        lines.append("")
        for criterion in phase.success_criteria:
            lines.append(f"- [ ] {criterion}")
        lines.append("")

    if phase.plans:
        lines.append("### Plans")
        lines.append("")
        for plan_entry in phase.plans:
            lines.append(f"- {plan_entry}")
        lines.append("")

    lines.append("---")
    lines.append("*Synced from .planning/ROADMAP.md*")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Label generators
# ---------------------------------------------------------------------------


def phase_labels(phase: RoadmapPhase) -> list[str]:
    """Return GitHub label names for a phase issue.

    Always includes: phase:<NN>, synced-by:n8n
    Adds:            req:<ID> for each requirement
    Adds:            in-progress when status is executing
    """
    labels: list[str] = [
        f"phase:{phase.number:02d}",
        "synced-by:n8n",
    ]
    for req in phase.requirements:
        labels.append(f"req:{req}")
    if phase.status == "executing":
        labels.append("in-progress")
    return labels


def plan_labels(plan: PlanDetail) -> list[str]:
    """Return GitHub label names for a plan issue.

    Always includes: phase:<NN>, plan:<NN-NN>, synced-by:n8n
    Adds:            req:<ID> for each requirement
    """
    labels: list[str] = [
        f"phase:{plan.phase_number:02d}",
        f"plan:{plan.phase_number:02d}-{plan.plan_number:02d}",
        "synced-by:n8n",
    ]
    for req in plan.requirements:
        labels.append(f"req:{req}")
    return labels
