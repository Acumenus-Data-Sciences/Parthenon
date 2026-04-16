"""GSD planning file parser.

Parses ROADMAP.md, STATE.md, and PLAN.md files into structured dataclasses.
Handles the real file formats used in this repository.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

import yaml


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class RoadmapPhase:
    """One phase entry from ROADMAP.md."""

    number: int
    name: str
    goal: str = ""
    status: str = "pending"          # pending | executing | complete
    completed_date: Optional[str] = None
    depends_on: list[int] = field(default_factory=list)
    requirements: list[str] = field(default_factory=list)
    success_criteria: list[str] = field(default_factory=list)
    plans: list[str] = field(default_factory=list)
    plan_count: int = 0


@dataclass
class QuickTask:
    """One row from the quick-tasks table in STATE.md."""

    name: str
    description: str
    date: str
    commit_hash: str
    directory: str


@dataclass
class ProjectState:
    """Parsed STATE.md."""

    milestone: str = ""
    status: str = ""
    total_phases: int = 0
    completed_phases: int = 0
    total_plans: int = 0
    completed_plans: int = 0
    percent: int = 0
    quick_tasks: list[QuickTask] = field(default_factory=list)


@dataclass
class PlanDetail:
    """Parsed PLAN.md for a single plan."""

    phase_number: int = 0
    plan_number: int = 0
    objective: str = ""
    requirements: list[str] = field(default_factory=list)
    must_have_truths: list[str] = field(default_factory=list)
    files_modified: list[str] = field(default_factory=list)
    duration_minutes: int = 0
    commit_hash: str = ""


# ---------------------------------------------------------------------------
# ROADMAP.md parser
# ---------------------------------------------------------------------------

# Matches: - [x] **Phase 4: Name** - Description (completed 2026-03-26)
#      or: - [ ] **Phase 4: Name** - Description
_PHASE_LIST_RE = re.compile(
    r"^- \[(?P<check>[xX ])\] \*\*Phase (?P<num>\d+(?:\.\d+)?): (?P<name>[^*]+)\*\*"
    r"(?:.*?\(completed (?P<date>\d{4}-\d{2}-\d{2})\))?",
    re.MULTILINE,
)

# Matches: ### Phase 4: Name
_PHASE_SECTION_RE = re.compile(
    r"^### Phase (?P<num>\d+(?:\.\d+)?): (?P<name>.+)$",
    re.MULTILINE,
)


def _parse_depends_on(line: str) -> list[int]:
    """Extract integer phase numbers from a 'Depends on' line.

    Handles forms like:
      Nothing (first phase)
      Phase 1
      Phase 2, Phase 3
      Phase 4, Phase 5, Phase 3
    """
    # Remove the label prefix
    text = re.sub(r"^\*\*Depends on\*\*\s*:\s*", "", line.strip())
    nums: list[int] = []
    for match in re.finditer(r"Phase (\d+)", text):
        nums.append(int(match.group(1)))
    return nums


def _parse_requirements(line: str) -> list[str]:
    """Extract requirement IDs from a 'Requirements' line.

    Example: **Requirements**: FOUND-05, FOUND-06
    """
    text = re.sub(r"^\*\*Requirements?\*\*\s*:\s*", "", line.strip())
    return [r.strip() for r in text.split(",") if r.strip()]


def parse_roadmap(content: str) -> list[RoadmapPhase]:
    """Parse ROADMAP.md content into a list of RoadmapPhase objects.

    Strategy:
    1. Scan the checkbox list to build base phase objects (number, name, status,
       completed_date).
    2. Scan each '### Phase N' detail section to fill goal, depends_on,
       requirements, success_criteria, and plans.
    """
    phases: dict[int, RoadmapPhase] = {}

    # --- Step 1: checkbox list ---
    for m in _PHASE_LIST_RE.finditer(content):
        raw_num = m.group("num")
        # Skip decimal phases (insertions like 2.1) for the primary list
        try:
            num = int(raw_num)
        except ValueError:
            continue
        checked = m.group("check").lower() == "x"
        status = "complete" if checked else "pending"
        date = m.group("date")
        name = m.group("name").strip()
        phases[num] = RoadmapPhase(
            number=num,
            name=name,
            status=status,
            completed_date=date,
        )

    # --- Step 2: detail sections ---
    # Split content into sections starting at each '### Phase N:' header
    sections = _PHASE_SECTION_RE.split(content)
    # After split, sections is: [pre, num, name, body, num, name, body, ...]
    it = iter(sections)
    next(it)  # skip preamble before first section
    while True:
        try:
            raw_num = next(it)
            _name = next(it)
            body = next(it)
        except StopIteration:
            break

        try:
            num = int(raw_num)
        except ValueError:
            continue

        if num not in phases:
            phases[num] = RoadmapPhase(number=num, name=_name.strip())

        phase = phases[num]
        _parse_section_body(phase, body)

    return sorted(phases.values(), key=lambda p: p.number)


def _parse_section_body(phase: RoadmapPhase, body: str) -> None:
    """Fill in goal, depends_on, requirements, success_criteria, plans from section body."""
    lines = body.splitlines()

    in_success_criteria = False

    for line in lines:
        stripped = line.strip()

        # Goal
        if stripped.startswith("**Goal**"):
            goal_text = re.sub(r"^\*\*Goal\*\*\s*:\s*", "", stripped)
            phase.goal = goal_text.strip()
            in_success_criteria = False
            continue

        # Depends on
        if stripped.startswith("**Depends on**") or stripped.startswith("**Depends On**"):
            phase.depends_on = _parse_depends_on(stripped)
            in_success_criteria = False
            continue

        # Requirements
        if stripped.startswith("**Requirements**") or stripped.startswith("**Requirement**"):
            phase.requirements = _parse_requirements(stripped)
            in_success_criteria = False
            continue

        # Success Criteria header
        if re.match(r"^\*\*Success Criteria\*\*", stripped):
            in_success_criteria = True
            continue

        # Numbered success criteria items (inside success criteria block)
        if in_success_criteria:
            num_match = re.match(r"^\d+\.\s+(.+)$", stripped)
            if num_match:
                phase.success_criteria.append(num_match.group(1).strip())
                continue
            # Any non-empty non-numbered line ends the block
            if stripped and not stripped.startswith("**"):
                pass  # allow blank lines to continue
            elif stripped.startswith("**"):
                in_success_criteria = False

        # Plans header / plan count line
        if re.match(r"^\*\*Plans?\*\*\s*:", stripped):
            # "Plans: 3 plans" or "Plans: TBD"
            count_match = re.search(r"(\d+)\s+plans?", stripped, re.IGNORECASE)
            if count_match:
                phase.plan_count = int(count_match.group(1))
            in_success_criteria = False
            continue

        # Plan list items: - [ ] 01-01: description  or  - [x] 01-01: description
        plan_match = re.match(r"^- \[[xX ]\] (\d{2}-\d{2}: .+)$", stripped)
        if plan_match:
            phase.plans.append(plan_match.group(1).strip())
            continue

    # Infer plan_count from plan list if not set from header
    if not phase.plan_count and phase.plans:
        phase.plan_count = len(phase.plans)


# ---------------------------------------------------------------------------
# STATE.md parser
# ---------------------------------------------------------------------------

_YAML_FRONT_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)

# Matches table rows: | 1 | Description | 2026-03-27 | abc1234 | [dir](./quick/...) |
_QT_ROW_RE = re.compile(
    r"^\|\s*(?P<name>[^|]+?)\s*\|"
    r"\s*(?P<desc>[^|]+?)\s*\|"
    r"\s*(?P<date>[^|]+?)\s*\|"
    r"\s*(?P<commit>[^|]+?)\s*\|"
    r"\s*(?P<directory>[^|]+?)\s*\|",
    re.MULTILINE,
)


def parse_state(content: str) -> ProjectState:
    """Parse STATE.md content into a ProjectState object."""
    state = ProjectState()

    # --- YAML frontmatter ---
    fm_match = _YAML_FRONT_RE.search(content)
    if fm_match:
        try:
            fm = yaml.safe_load(fm_match.group(1))
            if isinstance(fm, dict):
                state.milestone = str(fm.get("milestone", ""))
                state.status = str(fm.get("status", ""))
                progress = fm.get("progress", {})
                if isinstance(progress, dict):
                    state.total_phases = int(progress.get("total_phases", 0))
                    state.completed_phases = int(progress.get("completed_phases", 0))
                    state.total_plans = int(progress.get("total_plans", 0))
                    state.completed_plans = int(progress.get("completed_plans", 0))
                    state.percent = int(progress.get("percent", 0))
        except (yaml.YAMLError, TypeError, ValueError):
            pass

    # --- Quick Tasks table ---
    # Find the "### Quick Tasks Completed" section
    qt_section_match = re.search(
        r"### Quick Tasks Completed\s*\n(.*?)(?=\n## |\Z)",
        content,
        re.DOTALL,
    )
    section = qt_section_match.group(0) if qt_section_match else content

    for m in _QT_ROW_RE.finditer(section):
        name = m.group("name").strip()
        # Skip header row and separator rows
        if name.startswith("#") or re.match(r"^[-:]+$", name) or name.lower() == "#":
            continue
        desc = m.group("desc").strip()
        if desc.lower() in ("description", "---", ""):
            continue

        # Strip markdown links from directory column: [text](url) -> text
        raw_dir = m.group("directory").strip()
        link_match = re.match(r"\[([^\]]+)\]\(([^)]+)\)", raw_dir)
        directory = link_match.group(2) if link_match else raw_dir

        # Strip markdown links from commit column
        raw_commit = m.group("commit").strip()
        commit_link = re.match(r"\[([^\]]+)\]\(([^)]+)\)", raw_commit)
        commit_hash = commit_link.group(1) if commit_link else raw_commit

        state.quick_tasks.append(
            QuickTask(
                name=name,
                description=desc,
                date=m.group("date").strip(),
                commit_hash=commit_hash,
                directory=directory,
            )
        )

    return state


# ---------------------------------------------------------------------------
# PLAN.md parser
# ---------------------------------------------------------------------------

def _extract_yaml_frontmatter(content: str) -> tuple[dict, str]:
    """Return (frontmatter_dict, body_after_frontmatter)."""
    m = _YAML_FRONT_RE.search(content)
    if not m:
        return {}, content
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        fm = {}
    body = content[m.end():].lstrip("\n")
    return fm, body


def _parse_phase_plan_numbers(phase_str: str) -> tuple[int, int]:
    """Parse 'phase' frontmatter field like '01-project-setup-...' or '01' into int."""
    # phase field is like "01-project-setup-and-source-data-profiling"
    # plan field is an int already
    num_match = re.match(r"^(\d+)", str(phase_str))
    if num_match:
        return int(num_match.group(1)), 0
    return 0, 0


def parse_plan(content: str) -> PlanDetail:
    """Parse a PLAN.md file into a PlanDetail object."""
    fm, body = _extract_yaml_frontmatter(content)

    detail = PlanDetail()

    if isinstance(fm, dict):
        # Phase number from 'phase' key
        phase_raw = fm.get("phase", "")
        phase_num, _ = _parse_phase_plan_numbers(str(phase_raw))
        detail.phase_number = phase_num

        # Plan number from 'plan' key
        plan_raw = fm.get("plan", 0)
        try:
            detail.plan_number = int(plan_raw)
        except (TypeError, ValueError):
            detail.plan_number = 0

        # Requirements list
        reqs = fm.get("requirements", [])
        if isinstance(reqs, list):
            detail.requirements = [str(r) for r in reqs]
        elif reqs:
            detail.requirements = [str(reqs)]

        # files_modified
        files = fm.get("files_modified", [])
        if isinstance(files, list):
            detail.files_modified = [str(f) for f in files]

        # must_haves.truths
        must_haves = fm.get("must_haves", {})
        if isinstance(must_haves, dict):
            truths = must_haves.get("truths", [])
            if isinstance(truths, list):
                detail.must_have_truths = [str(t) for t in truths]

    # Objective from <objective>...</objective> tags in body
    obj_match = re.search(r"<objective>\s*(.*?)\s*</objective>", body, re.DOTALL)
    if obj_match:
        # Collapse internal whitespace/newlines to a single space for first line
        detail.objective = obj_match.group(1).strip()

    return detail
