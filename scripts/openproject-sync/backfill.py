#!/usr/bin/env python3
"""backfill.py — One-time import of GSD phases, plans, and quick tasks into
OpenProject and GitHub.

Usage:
    python backfill.py [--dry-run] [--map-existing]

Options:
    --dry-run       Preview all actions without creating anything.
    --map-existing  Map pre-existing OP/GH entities by title instead of creating.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Library imports (relative from scripts/openproject-sync/)
# ---------------------------------------------------------------------------

sys.path.insert(0, str(Path(__file__).parent))

from lib.gsd_parser import (
    PlanDetail,
    QuickTask,
    RoadmapPhase,
    parse_plan,
    parse_roadmap,
    parse_state,
)
from lib.gh_client import GhConfig, GitHubClient
from lib.mapper import (
    LABEL_COLORS,
    OP_TYPE_SUMMARY,
    OP_TYPE_TASK,
    OP_STATUS_CLOSED,
    gsd_status_to_op_status_id,
    phase_labels,
    phase_to_gh_issue_body,
    phase_to_wp_description,
    plan_labels,
    plan_to_wp_description,
    quick_task_to_wp_description,
)
from lib.op_client import OpConfig, OpenProjectClient
from lib.sync_db import EntityMapping, SyncDb

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PLANNING_DIR = Path("/home/smudoshi/Github/Parthenon/.planning")

OP_PROJECT_ID = 4

OP_API_KEY = os.environ.get(
    "OP_API_KEY",
    "bbbe16bf0c9297f1697b7fd30638d1539462f53fac64650c0125bfe321b128a7",
)
OP_BASE_URL = os.environ.get("OP_BASE_URL", "http://localhost:8090")

SYNC_DB_DSN = os.environ.get(
    "SYNC_DB_DSN",
    "dbname=parthenon user=claude_dev host=localhost",
)

GH_REPO = os.environ.get("GH_REPO", "sudoshi/Parthenon")

# All backfilled entities are "Closed" (all work is done)
BACKFILL_STATUS_ID = OP_STATUS_CLOSED  # 12


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _phase_slug(number: int, name: str) -> str:
    """Build the directory slug for a phase, e.g. '01-project-setup-...'."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return f"{number:02d}-{slug}"


def _phase_gsd_path(number: int, name: str) -> str:
    return f".planning/phases/{_phase_slug(number, name)}"


def _plan_gsd_path(phase_dir: Path, plan_filename: str) -> str:
    """Return .planning/phases/<phase-dir>/<plan-filename> relative path."""
    return f".planning/phases/{phase_dir.name}/{plan_filename}"


def _quick_gsd_path(task: QuickTask) -> str:
    """Return a stable gsd_path for a quick task based on its directory."""
    # directory may be a relative link like ./quick/1-create-...
    slug = task.directory.replace("./", "").strip("/")
    return f".planning/{slug}"


def _find_phase_dir(number: int, name: str) -> Optional[Path]:
    slug = _phase_slug(number, name)
    path = PLANNING_DIR / "phases" / slug
    if path.is_dir():
        return path
    # Fuzzy: find any dir starting with NN-
    prefix = f"{number:02d}-"
    candidates = [d for d in (PLANNING_DIR / "phases").iterdir()
                  if d.is_dir() and d.name.startswith(prefix)]
    return candidates[0] if candidates else None


def _collect_plan_files(phase_dir: Path) -> list[Path]:
    """Return all *-PLAN.md files in a phase directory, sorted."""
    return sorted(phase_dir.glob("*-PLAN.md"))


# ---------------------------------------------------------------------------
# Label bootstrapping
# ---------------------------------------------------------------------------

_STATIC_LABELS = [
    ("synced-by:n8n", LABEL_COLORS["synced-by:n8n"], "Managed by n8n sync workflow"),
    ("quick", LABEL_COLORS["quick"], "Quick task (outside normal phase/plan flow)"),
    ("in-progress", LABEL_COLORS["in-progress"], "Currently executing"),
]


def ensure_labels(
    gh: GitHubClient,
    phases: list[RoadmapPhase],
    plans: list[tuple[RoadmapPhase, PlanDetail]],
    dry_run: bool,
) -> None:
    """Create all required GitHub labels if they don't exist yet."""
    needed: dict[str, tuple[str, str]] = {}  # name -> (color, description)

    for name, color, desc in _STATIC_LABELS:
        needed[name] = (color, desc)

    for phase in phases:
        lname = f"phase:{phase.number:02d}"
        needed[lname] = (LABEL_COLORS["phase"], f"Phase {phase.number:02d}")
        for req in phase.requirements:
            rname = f"req:{req}"
            needed[rname] = (LABEL_COLORS["req"], f"Requirement {req}")

    for phase, plan in plans:
        lname = f"plan:{plan.phase_number:02d}-{plan.plan_number:02d}"
        needed[lname] = (LABEL_COLORS["plan"], f"Plan {plan.phase_number:02d}-{plan.plan_number:02d}")
        for req in plan.requirements:
            rname = f"req:{req}"
            needed[rname] = (LABEL_COLORS["req"], f"Requirement {req}")

    if dry_run:
        print(f"  [dry-run] Would ensure {len(needed)} labels exist:")
        for lname in sorted(needed):
            print(f"    label: {lname}")
        return

    existing = {lbl["name"] for lbl in gh.list_labels()}
    created = 0
    for lname, (color, desc) in sorted(needed.items()):
        if lname not in existing:
            gh.create_label(lname, color, desc)
            created += 1
    print(f"  Labels: {created} created, {len(needed) - created} already existed")


# ---------------------------------------------------------------------------
# Milestone
# ---------------------------------------------------------------------------


def ensure_milestone(
    gh: GitHubClient,
    state: any,
    dry_run: bool,
) -> Optional[int]:
    """Find or create the GSD milestone in GitHub. Returns milestone number."""
    milestone_title = f"GSD: IRSF-NHS v5.4"
    if state.milestone:
        milestone_title = f"GSD: IRSF-NHS {state.milestone}"

    if dry_run:
        print(f"  [dry-run] Would find/create GitHub milestone: '{milestone_title}'")
        return None

    existing = gh.list_milestones(state="all")
    for ms in existing:
        if ms["title"] == milestone_title:
            print(f"  Milestone '{milestone_title}' already exists (#{ms['number']})")
            return int(ms["number"])

    ms = gh.create_milestone(
        title=milestone_title,
        description="Backfilled from GSD planning files",
        state="closed",
    )
    print(f"  Created milestone '{milestone_title}' (#{ms['number']})")
    return int(ms["number"])


# ---------------------------------------------------------------------------
# Phase backfill
# ---------------------------------------------------------------------------


def backfill_phase(
    phase: RoadmapPhase,
    op: OpenProjectClient,
    gh: GitHubClient,
    db: SyncDb,
    milestone_number: Optional[int],
    dry_run: bool,
    map_existing: bool,
) -> Optional[int]:
    """Create OP Summary Task WP + GH Issue for one phase. Returns OP WP id."""
    gsd_path = _phase_gsd_path(phase.number, phase.name)
    subject = f"Phase {phase.number:02d}: {phase.name}"

    # Idempotency check
    if not dry_run:
        existing = db.find_by_gsd_path(gsd_path)
        if existing:
            print(f"  [skip] Phase {phase.number:02d} already mapped (op_wp={existing.op_work_package_id})")
            return existing.op_work_package_id

    wp_description = phase_to_wp_description(phase)
    gh_body = phase_to_gh_issue_body(phase)
    labels = phase_labels(phase)
    status_id = BACKFILL_STATUS_ID  # all complete

    if dry_run:
        print(f"  [dry-run] Phase {phase.number:02d}: '{subject}'")
        print(f"    OP: Summary Task, status_id={status_id}, type_id={OP_TYPE_SUMMARY}")
        print(f"    GH: issue with labels={labels}, milestone={milestone_number}")
        return None

    op_wp_id: Optional[int] = None
    gh_issue_number: Optional[int] = None

    if map_existing:
        # Search for existing OP WP by subject
        wps = op.list_work_packages(OP_PROJECT_ID)
        for wp in wps:
            if wp.get("subject") == subject:
                op_wp_id = int(wp["id"])
                print(f"  [map] Phase {phase.number:02d} OP WP #{op_wp_id} (existing)")
                break
        # Search for existing GH issue by title
        issues = gh.list_issues(state="all")
        for issue in issues:
            if issue.get("title") == subject:
                gh_issue_number = int(issue["number"])
                print(f"  [map] Phase {phase.number:02d} GH Issue #{gh_issue_number} (existing)")
                break
    else:
        # Create OP work package
        wp = op.create_work_package(
            project_id=OP_PROJECT_ID,
            subject=subject,
            description=wp_description,
            type_id=OP_TYPE_SUMMARY,
            status_id=status_id,
        )
        op_wp_id = int(wp["id"])
        print(f"  Created OP WP #{op_wp_id}: {subject}")

        # Create GH issue (closed, since phase is complete)
        issue = gh.create_issue(
            title=subject,
            body=gh_body,
            labels=labels,
            milestone=milestone_number,
        )
        gh_issue_number = int(issue["number"])
        gh.close_issue(gh_issue_number)
        print(f"  Created GH Issue #{gh_issue_number}: {subject}")

    # Record in sync DB
    mapping = EntityMapping(
        entity_type="phase",
        gsd_path=gsd_path,
        op_project_id=OP_PROJECT_ID,
        op_work_package_id=op_wp_id,
        github_issue_number=gh_issue_number,
        github_milestone_number=milestone_number,
    )
    db.upsert_mapping(mapping)
    return op_wp_id


# ---------------------------------------------------------------------------
# Plan backfill
# ---------------------------------------------------------------------------


def backfill_plan(
    phase: RoadmapPhase,
    plan: PlanDetail,
    plan_file: Path,
    parent_wp_id: Optional[int],
    op: OpenProjectClient,
    gh: GitHubClient,
    db: SyncDb,
    milestone_number: Optional[int],
    dry_run: bool,
    map_existing: bool,
) -> None:
    """Create OP Task WP + GH Issue for one plan."""
    phase_dir = plan_file.parent
    gsd_path = _plan_gsd_path(phase_dir, plan_file.name)
    subject = f"Plan {plan.phase_number:02d}-{plan.plan_number:02d}: {phase.name}"
    if plan.objective:
        # Trim to a reasonable title length
        obj_short = plan.objective[:80].split("\n")[0]
        subject = f"Plan {plan.phase_number:02d}-{plan.plan_number:02d}: {obj_short}"

    # Idempotency check
    if not dry_run:
        existing = db.find_by_gsd_path(gsd_path)
        if existing:
            print(f"    [skip] Plan {plan.phase_number:02d}-{plan.plan_number:02d} already mapped")
            return

    wp_description = plan_to_wp_description(plan)
    labels = plan_labels(plan)

    if dry_run:
        print(f"    [dry-run] Plan {plan.phase_number:02d}-{plan.plan_number:02d}: '{subject}'")
        print(f"      OP: Task, parent_wp_id={parent_wp_id}, status_id={BACKFILL_STATUS_ID}")
        print(f"      GH: issue labels={labels}")
        return

    op_wp_id: Optional[int] = None
    gh_issue_number: Optional[int] = None

    if map_existing:
        wps = op.list_work_packages(OP_PROJECT_ID)
        for wp in wps:
            if wp.get("subject") == subject:
                op_wp_id = int(wp["id"])
                print(f"    [map] Plan WP #{op_wp_id} (existing)")
                break
        issues = gh.list_issues(state="all")
        for issue in issues:
            if issue.get("title") == subject:
                gh_issue_number = int(issue["number"])
                print(f"    [map] Plan Issue #{gh_issue_number} (existing)")
                break
    else:
        wp = op.create_work_package(
            project_id=OP_PROJECT_ID,
            subject=subject,
            description=wp_description,
            type_id=OP_TYPE_TASK,
            status_id=BACKFILL_STATUS_ID,
            parent_id=parent_wp_id,
        )
        op_wp_id = int(wp["id"])
        print(f"    Created OP WP #{op_wp_id}: {subject}")

        issue = gh.create_issue(
            title=subject,
            body=wp_description,
            labels=labels,
            milestone=milestone_number,
        )
        gh_issue_number = int(issue["number"])
        gh.close_issue(gh_issue_number)
        print(f"    Created GH Issue #{gh_issue_number}: {subject}")

    mapping = EntityMapping(
        entity_type="plan",
        gsd_path=gsd_path,
        op_project_id=OP_PROJECT_ID,
        op_work_package_id=op_wp_id,
        github_issue_number=gh_issue_number,
        github_milestone_number=milestone_number,
    )
    db.upsert_mapping(mapping)


# ---------------------------------------------------------------------------
# Quick task backfill
# ---------------------------------------------------------------------------


def backfill_quick_task(
    task: QuickTask,
    op: OpenProjectClient,
    gh: GitHubClient,
    db: SyncDb,
    milestone_number: Optional[int],
    dry_run: bool,
    map_existing: bool,
) -> None:
    """Create OP Task WP + GH Issue for a quick task."""
    gsd_path = _quick_gsd_path(task)
    # Use description as the subject (truncated); fall back to name if empty
    desc_short = (task.description[:90] if task.description else task.name).strip()
    subject = f"Quick: {desc_short}"

    # Idempotency check
    if not dry_run:
        existing = db.find_by_gsd_path(gsd_path)
        if existing:
            print(f"  [skip] Quick task '{task.name}' already mapped")
            return

    wp_description = quick_task_to_wp_description(task)
    labels = ["quick", "synced-by:n8n"]

    if dry_run:
        print(f"  [dry-run] Quick task: '{subject}' ({task.date})")
        return

    op_wp_id: Optional[int] = None
    gh_issue_number: Optional[int] = None

    if map_existing:
        wps = op.list_work_packages(OP_PROJECT_ID)
        for wp in wps:
            if wp.get("subject") == subject:
                op_wp_id = int(wp["id"])
                print(f"  [map] Quick task WP #{op_wp_id} (existing)")
                break
        issues = gh.list_issues(state="all")
        for issue in issues:
            if issue.get("title") == subject:
                gh_issue_number = int(issue["number"])
                print(f"  [map] Quick task Issue #{gh_issue_number} (existing)")
                break
    else:
        wp = op.create_work_package(
            project_id=OP_PROJECT_ID,
            subject=subject,
            description=wp_description,
            type_id=OP_TYPE_TASK,
            status_id=BACKFILL_STATUS_ID,
        )
        op_wp_id = int(wp["id"])
        print(f"  Created OP WP #{op_wp_id}: {subject}")

        issue = gh.create_issue(
            title=subject,
            body=wp_description,
            labels=labels,
            milestone=milestone_number,
        )
        gh_issue_number = int(issue["number"])
        gh.close_issue(gh_issue_number)
        print(f"  Created GH Issue #{gh_issue_number}: {subject}")

    mapping = EntityMapping(
        entity_type="quick_task",
        gsd_path=gsd_path,
        op_project_id=OP_PROJECT_ID,
        op_work_package_id=op_wp_id,
        github_issue_number=gh_issue_number,
        github_milestone_number=milestone_number,
    )
    db.upsert_mapping(mapping)


# ---------------------------------------------------------------------------
# "follows" relations between phase WPs
# ---------------------------------------------------------------------------


def add_phase_relations(
    phases: list[RoadmapPhase],
    phase_wp_map: dict[int, int],
    op: OpenProjectClient,
    dry_run: bool,
) -> None:
    """Add 'follows' relations: phase N follows each of its depends_on phases."""
    for phase in phases:
        if not phase.depends_on:
            continue
        current_wp = phase_wp_map.get(phase.number)
        if not current_wp:
            continue
        for dep_num in phase.depends_on:
            dep_wp = phase_wp_map.get(dep_num)
            if not dep_wp:
                print(f"  [warn] Phase {phase.number} depends on Phase {dep_num}, but no WP id found — skipping relation")
                continue
            if dry_run:
                print(f"  [dry-run] relation: Phase {phase.number} (WP #{current_wp}) follows Phase {dep_num} (WP #{dep_wp})")
            else:
                try:
                    op.add_wp_relation(current_wp, dep_wp, relation_type="follows")
                    print(f"  Relation: WP #{current_wp} follows WP #{dep_wp}")
                except Exception as exc:
                    print(f"  [warn] Could not add relation WP #{current_wp} -> #{dep_wp}: {exc}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill GSD phases/plans/quick-tasks into OpenProject + GitHub"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no writes")
    parser.add_argument(
        "--map-existing",
        action="store_true",
        help="Map pre-existing entities by title instead of creating",
    )
    args = parser.parse_args()

    dry_run: bool = args.dry_run
    map_existing: bool = args.map_existing

    if dry_run:
        print("=== DRY RUN MODE — no writes will occur ===\n")

    # ------------------------------------------------------------------
    # Parse GSD files
    # ------------------------------------------------------------------
    print("Parsing GSD files...")
    roadmap_text = (PLANNING_DIR / "ROADMAP.md").read_text()
    state_text = (PLANNING_DIR / "STATE.md").read_text()

    phases = parse_roadmap(roadmap_text)
    state = parse_state(state_text)

    print(f"  Phases: {len(phases)}")
    print(f"  Quick tasks: {len(state.quick_tasks)}")

    # Collect all plan files
    plans_by_phase: dict[int, list[tuple[PlanDetail, Path]]] = {}
    all_plan_pairs: list[tuple[RoadmapPhase, PlanDetail]] = []

    for phase in phases:
        phase_dir = _find_phase_dir(phase.number, phase.name)
        if not phase_dir:
            print(f"  [warn] No directory found for Phase {phase.number:02d}")
            continue
        plan_files = _collect_plan_files(phase_dir)
        plan_pairs: list[tuple[PlanDetail, Path]] = []
        for pf in plan_files:
            plan_detail = parse_plan(pf.read_text())
            plan_pairs.append((plan_detail, pf))
            all_plan_pairs.append((phase, plan_detail))
        plans_by_phase[phase.number] = plan_pairs

    total_plans = sum(len(v) for v in plans_by_phase.values())
    print(f"  Plan files found: {total_plans}")

    # ------------------------------------------------------------------
    # Init clients
    # ------------------------------------------------------------------
    op = OpenProjectClient(OpConfig(base_url=OP_BASE_URL, api_key=OP_API_KEY, verify_ssl=False))
    gh = GitHubClient(GhConfig(repo=GH_REPO))
    db = SyncDb(SYNC_DB_DSN) if not dry_run else None  # type: ignore[assignment]

    # ------------------------------------------------------------------
    # Step 1: Ensure labels
    # ------------------------------------------------------------------
    print("\nStep 1: Ensuring GitHub labels...")
    ensure_labels(gh, phases, all_plan_pairs, dry_run)

    # ------------------------------------------------------------------
    # Step 2: Find/create GitHub milestone
    # ------------------------------------------------------------------
    print("\nStep 2: GitHub milestone...")
    milestone_number = ensure_milestone(gh, state, dry_run)

    # ------------------------------------------------------------------
    # Step 3: Phases
    # ------------------------------------------------------------------
    print("\nStep 3: Backfilling phases...")
    phase_wp_map: dict[int, int] = {}

    for phase in phases:
        wp_id = backfill_phase(
            phase=phase,
            op=op,
            gh=gh,
            db=db,
            milestone_number=milestone_number,
            dry_run=dry_run,
            map_existing=map_existing,
        )
        if wp_id is not None:
            phase_wp_map[phase.number] = wp_id

    # ------------------------------------------------------------------
    # Step 4: Plans
    # ------------------------------------------------------------------
    print("\nStep 4: Backfilling plans...")
    for phase in phases:
        plan_pairs = plans_by_phase.get(phase.number, [])
        if not plan_pairs:
            continue
        parent_wp_id = phase_wp_map.get(phase.number)
        for plan_detail, plan_file in plan_pairs:
            backfill_plan(
                phase=phase,
                plan=plan_detail,
                plan_file=plan_file,
                parent_wp_id=parent_wp_id,
                op=op,
                gh=gh,
                db=db,
                milestone_number=milestone_number,
                dry_run=dry_run,
                map_existing=map_existing,
            )

    # ------------------------------------------------------------------
    # Step 5: Quick tasks
    # ------------------------------------------------------------------
    print("\nStep 5: Backfilling quick tasks...")
    for task in state.quick_tasks:
        backfill_quick_task(
            task=task,
            op=op,
            gh=gh,
            db=db,
            milestone_number=milestone_number,
            dry_run=dry_run,
            map_existing=map_existing,
        )

    # ------------------------------------------------------------------
    # Step 6: Phase "follows" relations in OP
    # ------------------------------------------------------------------
    print("\nStep 6: Adding OP phase 'follows' relations...")
    if dry_run:
        add_phase_relations(phases, {}, op, dry_run=True)
    else:
        add_phase_relations(phases, phase_wp_map, op, dry_run=False)

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n=== Backfill complete ===")
    total_quick = len(state.quick_tasks)
    print(f"  Phases: {len(phases)}")
    print(f"  Plans:  {total_plans}")
    print(f"  Quick tasks: {total_quick}")
    print(f"  Total entities: {len(phases) + total_plans + total_quick}")

    if not dry_run and db is not None:
        health = db.get_health()
        print(f"\nSync DB health: {health}")
        db.close()


if __name__ == "__main__":
    main()
