# OpenProject Bidirectional Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bidirectional sync between OpenProject (source of truth), GitHub Issues/PRs/Milestones, and GSD `.planning/` files via n8n workflows with Authentik OAuth2 auth.

**Architecture:** Six n8n workflows (5 event-driven + 1 reconciliation cron) sync entities through a `sync` schema in host PG17. OpenProject webhooks and GitHub webhooks trigger real-time sync; a 30-min reconciliation loop catches missed events. Loop prevention via commit markers, labels, and service account detection.

**Tech Stack:** n8n 2.14.2 (Acropolis), OpenProject v17 API v3, GitHub REST API (via `gh` CLI and HTTP), PostgreSQL 17, Authentik OAuth2

**Existing State:**
- OpenProject: Parthenon project (id: 4), 31 WPs, 9 versions, 7 types, 14 statuses
- GitHub: 7 milestones (v1.0.4–v1.0.10), ~22 issues
- n8n: 5 existing workflows at `acropolis/config/n8n/workflows/`
- API access: `apikey:bbbe16bf0c9297f1697b7fd30638d1539462f53fac64650c0125bfe321b128a7` (admin, user id 4)
- API quirk: Must pass `Host: projects.acumenus.net` + `X-Forwarded-Proto: https` when calling from inside container

---

## File Structure

```
scripts/openproject-sync/
├── schema.sql                    — sync schema DDL (entity_map + sync_log tables)
├── backfill.py                   — One-time backfill: GSD → OP + GitHub → sync table
├── lib/
│   ├── __init__.py
│   ├── op_client.py              — OpenProject API v3 client (CRUD for projects, WPs, versions)
│   ├── gh_client.py              — GitHub API client (issues, milestones, labels)
│   ├── gsd_parser.py             — Parse ROADMAP.md, STATE.md, PLAN.md into structured data
│   ├── sync_db.py                — sync.entity_map and sync.sync_log CRUD via psycopg2
│   └── mapper.py                 — Bidirectional mapping logic (GSD ↔ OP ↔ GitHub)
├── tests/
│   ├── test_gsd_parser.py        — Unit tests for GSD file parsing
│   ├── test_mapper.py            — Unit tests for entity mapping
│   └── test_sync_db.py           — Integration tests for sync schema
├── requirements.txt              — psycopg2-binary, requests, PyYAML
└── README.md                     — Setup and usage docs

acropolis/config/n8n/workflows/
├── op-sync-from-op.json          — Workflow 1+2: OP webhook → GitHub + GSD
├── op-sync-from-gh.json          — Workflow 3+4: GitHub webhook → OP
├── op-sync-from-push.json        — Workflow 5: Git push webhook → OP
├── op-sync-reconcile.json        — Workflow 6: 30-min reconciliation cron
└── (existing workflows unchanged)
```

---

### Task 1: Create sync schema in host PG17

**Files:**
- Create: `scripts/openproject-sync/schema.sql`

- [ ] **Step 1: Write the schema DDL**

```sql
-- scripts/openproject-sync/schema.sql
-- Sync state for OpenProject ↔ GitHub ↔ GSD bidirectional sync

CREATE SCHEMA IF NOT EXISTS sync;

CREATE TABLE sync.entity_map (
    id SERIAL PRIMARY KEY,
    op_project_id INTEGER,
    op_work_package_id INTEGER,
    op_version_id INTEGER,
    github_issue_number INTEGER,
    github_milestone_number INTEGER,
    gsd_path TEXT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('milestone','phase','plan','quick','requirement','version')),
    op_updated_at TIMESTAMPTZ,
    gh_updated_at TIMESTAMPTZ,
    gsd_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_entity_map_op_wp ON sync.entity_map(op_work_package_id) WHERE op_work_package_id IS NOT NULL;
CREATE UNIQUE INDEX idx_entity_map_gh_issue ON sync.entity_map(github_issue_number) WHERE github_issue_number IS NOT NULL;
CREATE UNIQUE INDEX idx_entity_map_gsd ON sync.entity_map(gsd_path) WHERE gsd_path IS NOT NULL;
CREATE INDEX idx_entity_map_type ON sync.entity_map(entity_type);

CREATE TABLE sync.sync_log (
    id SERIAL PRIMARY KEY,
    workflow TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('op->gh','op->gsd','gh->op','gsd->op','reconcile')),
    entity_map_id INTEGER REFERENCES sync.entity_map(id),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_created ON sync.sync_log(created_at DESC);
CREATE INDEX idx_sync_log_workflow ON sync.sync_log(workflow);

-- Health check view
CREATE OR REPLACE VIEW sync.health AS
SELECT
    (SELECT MAX(created_at) FROM sync.sync_log WHERE workflow = 'reconcile') AS last_reconciliation,
    (SELECT COUNT(*) FROM sync.entity_map) AS entities_tracked,
    (SELECT COUNT(*) FROM sync.sync_log WHERE action = 'conflict_resolved' AND created_at > NOW() - INTERVAL '24 hours') AS conflicts_last_24h,
    (SELECT COUNT(*) FROM sync.sync_log WHERE action = 'error' AND created_at > NOW() - INTERVAL '24 hours') AS errors_last_24h;
```

- [ ] **Step 2: Apply schema to host PG17**

Run: `psql -U claude_dev -d parthenon -f scripts/openproject-sync/schema.sql`
Expected: `CREATE SCHEMA`, `CREATE TABLE` x2, `CREATE INDEX` x5, `CREATE VIEW`

- [ ] **Step 3: Verify schema**

Run: `psql -U claude_dev -d parthenon -c "\dt sync.*"`
Expected: Two tables: `entity_map`, `sync_log`

Run: `psql -U claude_dev -d parthenon -c "SELECT * FROM sync.health"`
Expected: One row with all NULLs/zeros (no data yet)

- [ ] **Step 4: Commit**

```bash
git add scripts/openproject-sync/schema.sql
git commit -m "feat(sync): create sync schema for OpenProject bidirectional sync"
```

---

### Task 2: Build GSD parser library

**Files:**
- Create: `scripts/openproject-sync/lib/__init__.py`
- Create: `scripts/openproject-sync/lib/gsd_parser.py`
- Create: `scripts/openproject-sync/tests/test_gsd_parser.py`
- Create: `scripts/openproject-sync/requirements.txt`

- [ ] **Step 1: Write requirements.txt**

```
psycopg2-binary>=2.9
requests>=2.31
PyYAML>=6.0
```

- [ ] **Step 2: Write failing tests for GSD parser**

```python
# scripts/openproject-sync/tests/test_gsd_parser.py
import pytest
from pathlib import Path

from lib.gsd_parser import parse_roadmap, parse_state, parse_plan, RoadmapPhase, ProjectState, PlanDetail


FIXTURES = Path(__file__).parent / "fixtures"


class TestParseRoadmap:
    def test_parses_phase_count(self, parthenon_roadmap):
        phases = parse_roadmap(parthenon_roadmap)
        assert len(phases) == 12

    def test_phase_has_required_fields(self, parthenon_roadmap):
        phases = parse_roadmap(parthenon_roadmap)
        p1 = phases[0]
        assert isinstance(p1, RoadmapPhase)
        assert p1.number == 1
        assert "Project Setup" in p1.name
        assert p1.status == "complete"
        assert p1.completed_date is not None

    def test_phase_dependencies_parsed(self, parthenon_roadmap):
        phases = parse_roadmap(parthenon_roadmap)
        p4 = phases[3]  # Phase 4 depends on 2 and 3
        assert 2 in p4.depends_on
        assert 3 in p4.depends_on

    def test_phase_requirements_parsed(self, parthenon_roadmap):
        phases = parse_roadmap(parthenon_roadmap)
        p1 = phases[0]
        assert "FOUND-05" in p1.requirements or "FOUND-06" in p1.requirements

    def test_phase_plans_parsed(self, parthenon_roadmap):
        phases = parse_roadmap(parthenon_roadmap)
        p1 = phases[0]
        assert len(p1.plans) >= 2
        assert "01-01" in p1.plans[0]

    def test_phase_success_criteria_parsed(self, parthenon_roadmap):
        phases = parse_roadmap(parthenon_roadmap)
        p1 = phases[0]
        assert len(p1.success_criteria) >= 1


class TestParseState:
    def test_parses_progress(self, parthenon_state):
        state = parse_state(parthenon_state)
        assert isinstance(state, ProjectState)
        assert state.total_phases == 12
        assert state.completed_phases == 12
        assert state.status in ("executing", "completed")

    def test_parses_quick_tasks(self, parthenon_state):
        state = parse_state(parthenon_state)
        assert len(state.quick_tasks) >= 1


@pytest.fixture
def parthenon_roadmap():
    path = Path("/home/smudoshi/Github/Parthenon/.planning/ROADMAP.md")
    return path.read_text()


@pytest.fixture
def parthenon_state():
    path = Path("/home/smudoshi/Github/Parthenon/.planning/STATE.md")
    return path.read_text()
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd scripts/openproject-sync && python -m pytest tests/test_gsd_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.gsd_parser'`

- [ ] **Step 4: Implement GSD parser**

```python
# scripts/openproject-sync/lib/__init__.py
```

```python
# scripts/openproject-sync/lib/gsd_parser.py
"""Parse GSD planning files (ROADMAP.md, STATE.md, PLAN.md) into structured data."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RoadmapPhase:
    number: int
    name: str
    goal: str
    status: str  # pending, executing, complete
    completed_date: Optional[str]
    depends_on: list[int] = field(default_factory=list)
    requirements: list[str] = field(default_factory=list)
    success_criteria: list[str] = field(default_factory=list)
    plans: list[str] = field(default_factory=list)
    plan_count: int = 0


@dataclass
class QuickTask:
    name: str
    description: str
    date: Optional[str]
    commit_hash: Optional[str]
    directory: Optional[str]


@dataclass
class ProjectState:
    milestone: str
    status: str
    total_phases: int
    completed_phases: int
    total_plans: int
    completed_plans: int
    percent: int
    quick_tasks: list[QuickTask] = field(default_factory=list)


@dataclass
class PlanDetail:
    phase_number: int
    plan_number: int
    objective: str
    requirements: list[str] = field(default_factory=list)
    must_have_truths: list[str] = field(default_factory=list)
    files_modified: list[str] = field(default_factory=list)
    duration_minutes: Optional[int] = None
    commit_hash: Optional[str] = None


def parse_roadmap(content: str) -> list[RoadmapPhase]:
    """Parse ROADMAP.md content into a list of RoadmapPhase objects."""
    phases: list[RoadmapPhase] = []

    # Parse the checkbox list for phase names and completion status
    checkbox_pattern = re.compile(
        r"- \[(x| )\] \*\*Phase (\d+):\s*(.+?)\*\*\s*-\s*(.+?)(?:\(completed (\d{4}-\d{2}-\d{2})\))?$",
        re.MULTILINE,
    )
    for match in checkbox_pattern.finditer(content):
        checked, num, name, desc, comp_date = match.groups()
        phases.append(
            RoadmapPhase(
                number=int(num),
                name=name.strip(),
                goal=desc.strip(),
                status="complete" if checked == "x" else "pending",
                completed_date=comp_date,
            )
        )

    # Parse phase details sections
    detail_sections = re.split(r"### Phase (\d+):", content)
    # detail_sections alternates: [preamble, "1", content, "2", content, ...]
    for i in range(1, len(detail_sections) - 1, 2):
        phase_num = int(detail_sections[i])
        section = detail_sections[i + 1]

        phase = next((p for p in phases if p.number == phase_num), None)
        if phase is None:
            continue

        # Goal
        goal_match = re.search(r"\*\*Goal\*\*:\s*(.+)", section)
        if goal_match:
            phase.goal = goal_match.group(1).strip()

        # Dependencies
        dep_match = re.search(r"\*\*Depends on\*\*:\s*(.+)", section)
        if dep_match:
            dep_text = dep_match.group(1)
            phase.depends_on = [
                int(d) for d in re.findall(r"Phase (\d+)", dep_text)
            ]
            if not phase.depends_on:
                phase.depends_on = [
                    int(d) for d in re.findall(r"(\d+)", dep_text)
                    if d.isdigit() and "nothing" not in dep_text.lower()
                ]

        # Requirements
        req_match = re.search(r"\*\*Requirements\*\*:\s*(.+)", section)
        if req_match:
            phase.requirements = re.findall(r"[A-Z]+-\d+", req_match.group(1))

        # Success criteria
        criteria = re.findall(r"\d+\.\s+(.+)", section.split("**Plans**")[0] if "**Plans**" in section else section)
        # Filter out plan lines
        phase.success_criteria = [
            c.strip()
            for c in criteria
            if not c.strip().startswith("0") and "plan" not in c.lower()[:10]
        ]

        # Plans
        plan_lines = re.findall(r"- \[[ x]\] (\d+-\d+):\s*(.+)", section)
        phase.plans = [f"{num}: {desc.strip()}" for num, desc in plan_lines]
        phase.plan_count = len(phase.plans) if phase.plans else 0

    return phases


def parse_state(content: str) -> ProjectState:
    """Parse STATE.md content into a ProjectState object."""
    # Parse YAML frontmatter
    fm_match = re.search(r"---\n(.+?)\n---", content, re.DOTALL)
    fm = {}
    if fm_match:
        for line in fm_match.group(1).splitlines():
            if ":" in line and not line.startswith(" "):
                key, val = line.split(":", 1)
                fm[key.strip()] = val.strip()

    # Parse progress block from frontmatter
    progress_match = re.search(
        r"progress:\s*\n((?:\s+.+\n)+)", content
    )
    progress = {}
    if progress_match:
        for line in progress_match.group(1).splitlines():
            if ":" in line:
                key, val = line.strip().split(":", 1)
                progress[key.strip()] = val.strip()

    # Parse quick tasks table
    quick_tasks: list[QuickTask] = []
    qt_pattern = re.compile(
        r"\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})?\s*\|\s*(\w+)?\s*\|"
    )
    in_qt = False
    for line in content.splitlines():
        if "Quick Tasks Completed" in line:
            in_qt = True
            continue
        if in_qt and line.startswith("|") and not line.startswith("| #") and not line.startswith("|--"):
            m = qt_pattern.match(line)
            if m:
                quick_tasks.append(
                    QuickTask(
                        name=m.group(1),
                        description=m.group(2).strip(),
                        date=m.group(3),
                        commit_hash=m.group(4),
                        directory=None,
                    )
                )
        if in_qt and line.strip() == "":
            in_qt = False

    return ProjectState(
        milestone=fm.get("milestone_name", fm.get("milestone", "")),
        status=fm.get("status", ""),
        total_phases=int(progress.get("total_phases", 0)),
        completed_phases=int(progress.get("completed_phases", 0)),
        total_plans=int(progress.get("total_plans", 0)),
        completed_plans=int(progress.get("completed_plans", 0)),
        percent=int(progress.get("percent", 0)),
        quick_tasks=quick_tasks,
    )


def parse_plan(content: str) -> PlanDetail:
    """Parse a PLAN.md file into a PlanDetail object."""
    # Parse YAML frontmatter
    fm_match = re.search(r"---\n(.+?)\n---", content, re.DOTALL)
    fm_text = fm_match.group(1) if fm_match else ""

    phase_match = re.search(r"phase:\s*(\S+)", fm_text)
    plan_match = re.search(r"plan:\s*(\d+)", fm_text)

    phase_num = 0
    if phase_match:
        num_match = re.search(r"(\d+)", phase_match.group(1))
        phase_num = int(num_match.group(1)) if num_match else 0

    plan_num = int(plan_match.group(1)) if plan_match else 0

    # Requirements
    req_match = re.search(r"requirements:\s*\[(.+?)\]", fm_text)
    requirements = re.findall(r"[A-Z]+-\d+", req_match.group(1)) if req_match else []

    # Must-have truths
    truths: list[str] = []
    truths_match = re.search(r"truths:\s*\n((?:\s+-\s+.+\n)+)", fm_text)
    if truths_match:
        truths = [
            line.strip().lstrip("- ").strip('"').strip("'")
            for line in truths_match.group(1).splitlines()
            if line.strip().startswith("-")
        ]

    # Files modified
    files_match = re.search(r"files_modified:\s*\n((?:\s+-\s+.+\n)+)", fm_text)
    files_modified = []
    if files_match:
        files_modified = [
            line.strip().lstrip("- ").strip('"')
            for line in files_match.group(1).splitlines()
            if line.strip().startswith("-")
        ]

    # Objective from body
    obj_match = re.search(r"<objective>\s*(.+?)\s*</objective>", content, re.DOTALL)
    objective = obj_match.group(1).strip() if obj_match else ""

    return PlanDetail(
        phase_number=phase_num,
        plan_number=plan_num,
        objective=objective,
        requirements=requirements,
        must_have_truths=truths,
        files_modified=files_modified,
    )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scripts/openproject-sync && python -m pytest tests/test_gsd_parser.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/openproject-sync/lib/ scripts/openproject-sync/tests/test_gsd_parser.py scripts/openproject-sync/requirements.txt
git commit -m "feat(sync): GSD parser for ROADMAP.md, STATE.md, and PLAN.md"
```

---

### Task 3: Build OpenProject API client

**Files:**
- Create: `scripts/openproject-sync/lib/op_client.py`

- [ ] **Step 1: Write the OpenProject client**

```python
# scripts/openproject-sync/lib/op_client.py
"""OpenProject API v3 client for project, work package, and version CRUD."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)


@dataclass
class OpConfig:
    base_url: str  # e.g. "https://projects.acumenus.net"
    api_key: str
    verify_ssl: bool = True


class OpenProjectClient:
    def __init__(self, config: OpConfig) -> None:
        self.config = config
        self.session = requests.Session()
        self.session.auth = ("apikey", config.api_key)
        self.session.headers.update({
            "Content-Type": "application/json",
        })
        if not config.verify_ssl:
            self.session.verify = False

    def _url(self, path: str) -> str:
        return f"{self.config.base_url}/api/v3{path}"

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        resp = self.session.get(self._url(path), params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, data: dict) -> dict:
        resp = self.session.post(self._url(path), json=data)
        resp.raise_for_status()
        return resp.json()

    def _patch(self, path: str, data: dict) -> dict:
        resp = self.session.patch(self._url(path), json=data)
        resp.raise_for_status()
        return resp.json()

    # --- Projects ---

    def get_project(self, project_id: int) -> dict:
        return self._get(f"/projects/{project_id}")

    def list_projects(self) -> list[dict]:
        data = self._get("/projects", params={"pageSize": 100})
        return data["_embedded"]["elements"]

    def create_subproject(self, parent_id: int, identifier: str, name: str, description: str = "") -> dict:
        return self._post("/projects", {
            "name": name,
            "identifier": identifier,
            "description": {"raw": description},
            "statusExplanation": {"raw": ""},
            "_links": {
                "parent": {"href": f"/api/v3/projects/{parent_id}"},
            },
        })

    # --- Versions ---

    def list_versions(self, project_id: int) -> list[dict]:
        data = self._get(f"/projects/{project_id}/versions")
        return data["_embedded"]["elements"]

    def create_version(self, project_id: int, name: str, description: str = "", status: str = "open") -> dict:
        return self._post(f"/projects/{project_id}/versions", {
            "name": name,
            "description": description,
            "status": status,
        })

    # --- Work Packages ---

    def list_work_packages(self, project_id: int, page_size: int = 100) -> list[dict]:
        all_wps: list[dict] = []
        offset = 1
        while True:
            data = self._get(
                f"/projects/{project_id}/work_packages",
                params={"pageSize": page_size, "offset": offset},
            )
            elements = data["_embedded"]["elements"]
            all_wps.extend(elements)
            if len(elements) < page_size:
                break
            offset += 1
        return all_wps

    def get_work_package(self, wp_id: int) -> dict:
        return self._get(f"/work_packages/{wp_id}")

    def create_work_package(
        self,
        project_id: int,
        subject: str,
        description: str = "",
        type_id: int = 1,
        status_id: int = 1,
        parent_id: Optional[int] = None,
        version_id: Optional[int] = None,
    ) -> dict:
        payload: dict[str, Any] = {
            "subject": subject,
            "description": {"raw": description},
            "_links": {
                "type": {"href": f"/api/v3/types/{type_id}"},
                "status": {"href": f"/api/v3/statuses/{status_id}"},
            },
        }
        if parent_id:
            payload["_links"]["parent"] = {"href": f"/api/v3/work_packages/{parent_id}"}
        if version_id:
            payload["_links"]["version"] = {"href": f"/api/v3/versions/{version_id}"}
        return self._post(f"/projects/{project_id}/work_packages", payload)

    def update_work_package(self, wp_id: int, updates: dict) -> dict:
        return self._patch(f"/work_packages/{wp_id}", updates)

    def update_wp_status(self, wp_id: int, status_id: int) -> dict:
        return self._patch(f"/work_packages/{wp_id}", {
            "_links": {"status": {"href": f"/api/v3/statuses/{status_id}"}},
        })

    def add_wp_relation(self, from_id: int, to_id: int, relation_type: str = "follows") -> dict:
        return self._post("/relations", {
            "_links": {
                "from": {"href": f"/api/v3/work_packages/{from_id}"},
                "to": {"href": f"/api/v3/work_packages/{to_id}"},
            },
            "type": relation_type,
        })

    # --- Webhooks ---

    def list_webhooks(self) -> list[dict]:
        """List configured webhooks. Requires admin."""
        data = self._get("/webhooks")
        return data.get("_embedded", {}).get("elements", [])

    # --- Types and Statuses ---

    def list_types(self) -> list[dict]:
        data = self._get("/types")
        return data["_embedded"]["elements"]

    def list_statuses(self) -> list[dict]:
        data = self._get("/statuses")
        return data["_embedded"]["elements"]
```

- [ ] **Step 2: Smoke test the client against live OP**

Run:
```bash
cd scripts/openproject-sync && python3 -c "
from lib.op_client import OpenProjectClient, OpConfig
client = OpenProjectClient(OpConfig(
    base_url='https://projects.acumenus.net',
    api_key='bbbe16bf0c9297f1697b7fd30638d1539462f53fac64650c0125bfe321b128a7',
))
projects = client.list_projects()
print(f'Projects: {len(projects)}')
for p in projects:
    print(f'  {p[\"id\"]}: {p[\"name\"]}')
types = client.list_types()
print(f'Types: {[t[\"name\"] for t in types]}')
statuses = client.list_statuses()
print(f'Statuses: {[s[\"name\"] for s in statuses]}')
"
```
Expected: Lists projects (including Parthenon id: 4), 7 types, 14 statuses

- [ ] **Step 3: Commit**

```bash
git add scripts/openproject-sync/lib/op_client.py
git commit -m "feat(sync): OpenProject API v3 client"
```

---

### Task 4: Build GitHub API client

**Files:**
- Create: `scripts/openproject-sync/lib/gh_client.py`

- [ ] **Step 1: Write the GitHub client**

```python
# scripts/openproject-sync/lib/gh_client.py
"""GitHub API client for issues, milestones, and labels via gh CLI or REST API."""

from __future__ import annotations

import json
import logging
import subprocess
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

REPO = "sudoshi/Parthenon"


@dataclass
class GhConfig:
    repo: str = REPO


class GitHubClient:
    """GitHub client using gh CLI (already authenticated on this machine)."""

    def __init__(self, config: Optional[GhConfig] = None) -> None:
        self.repo = (config or GhConfig()).repo

    def _run(self, args: list[str]) -> str:
        cmd = ["gh"] + args + ["-R", self.repo]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()

    def _api(self, path: str, method: str = "GET", data: Optional[dict] = None) -> Any:
        cmd = ["gh", "api", path, "--method", method]
        if data:
            cmd.extend(["--input", "-"])
            result = subprocess.run(
                cmd, capture_output=True, text=True, input=json.dumps(data), check=True,
            )
        else:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout) if result.stdout.strip() else {}

    # --- Milestones ---

    def list_milestones(self, state: str = "all") -> list[dict]:
        return self._api(f"repos/{self.repo}/milestones?state={state}&per_page=100")

    def create_milestone(self, title: str, description: str = "", state: str = "open") -> dict:
        return self._api(f"repos/{self.repo}/milestones", method="POST", data={
            "title": title,
            "description": description,
            "state": state,
        })

    def update_milestone(self, number: int, updates: dict) -> dict:
        return self._api(f"repos/{self.repo}/milestones/{number}", method="PATCH", data=updates)

    def close_milestone(self, number: int) -> dict:
        return self.update_milestone(number, {"state": "closed"})

    # --- Issues ---

    def list_issues(self, state: str = "all", per_page: int = 100) -> list[dict]:
        issues: list[dict] = []
        page = 1
        while True:
            batch = self._api(
                f"repos/{self.repo}/issues?state={state}&per_page={per_page}&page={page}"
            )
            issues.extend(batch)
            if len(batch) < per_page:
                break
            page += 1
        return issues

    def create_issue(
        self,
        title: str,
        body: str = "",
        labels: Optional[list[str]] = None,
        milestone: Optional[int] = None,
    ) -> dict:
        payload: dict = {"title": title, "body": body}
        if labels:
            payload["labels"] = labels
        if milestone:
            payload["milestone"] = milestone
        return self._api(f"repos/{self.repo}/issues", method="POST", data=payload)

    def update_issue(self, number: int, updates: dict) -> dict:
        return self._api(f"repos/{self.repo}/issues/{number}", method="PATCH", data=updates)

    def close_issue(self, number: int) -> dict:
        return self.update_issue(number, {"state": "closed"})

    # --- Labels ---

    def list_labels(self) -> list[dict]:
        return self._api(f"repos/{self.repo}/labels?per_page=100")

    def create_label(self, name: str, color: str = "0E8A16", description: str = "") -> dict:
        return self._api(f"repos/{self.repo}/labels", method="POST", data={
            "name": name,
            "color": color,
            "description": description,
        })

    def ensure_label(self, name: str, color: str = "0E8A16", description: str = "") -> dict:
        """Create label if it doesn't exist, return existing one if it does."""
        existing = self.list_labels()
        for label in existing:
            if label["name"] == name:
                return label
        return self.create_label(name, color, description)
```

- [ ] **Step 2: Smoke test the client**

Run:
```bash
cd scripts/openproject-sync && python3 -c "
from lib.gh_client import GitHubClient
gh = GitHubClient()
milestones = gh.list_milestones()
print(f'Milestones: {len(milestones)}')
for m in milestones:
    print(f'  #{m[\"number\"]}: {m[\"title\"]} ({m[\"state\"]})')
issues = gh.list_issues(state='open')
print(f'Open issues: {len(issues)}')
"
```
Expected: Lists 7+ milestones and open issues

- [ ] **Step 3: Commit**

```bash
git add scripts/openproject-sync/lib/gh_client.py
git commit -m "feat(sync): GitHub API client using gh CLI"
```

---

### Task 5: Build sync database client

**Files:**
- Create: `scripts/openproject-sync/lib/sync_db.py`
- Create: `scripts/openproject-sync/tests/test_sync_db.py`

- [ ] **Step 1: Write failing tests**

```python
# scripts/openproject-sync/tests/test_sync_db.py
import os
import pytest
from lib.sync_db import SyncDb, EntityMapping


@pytest.fixture
def db():
    dsn = os.environ.get("SYNC_DB_DSN", "dbname=parthenon user=claude_dev")
    sdb = SyncDb(dsn)
    yield sdb
    # Clean up test data
    sdb.execute("DELETE FROM sync.entity_map WHERE gsd_path LIKE 'test/%'")
    sdb.execute("DELETE FROM sync.sync_log WHERE workflow = 'test'")


class TestSyncDb:
    def test_upsert_and_lookup_by_gsd(self, db):
        mapping = EntityMapping(
            entity_type="phase",
            gsd_path="test/phases/01-setup",
            op_work_package_id=999,
            github_issue_number=999,
        )
        row_id = db.upsert_mapping(mapping)
        assert row_id > 0

        found = db.find_by_gsd_path("test/phases/01-setup")
        assert found is not None
        assert found.op_work_package_id == 999

    def test_lookup_by_op_wp(self, db):
        mapping = EntityMapping(
            entity_type="plan",
            gsd_path="test/phases/01-setup/01-01",
            op_work_package_id=998,
        )
        db.upsert_mapping(mapping)

        found = db.find_by_op_wp(998)
        assert found is not None
        assert found.gsd_path == "test/phases/01-setup/01-01"

    def test_log_action(self, db):
        db.log_action("test", "op->gh", None, "created", {"subject": "Test WP"})
        # No assertion needed — just verify it doesn't throw

    def test_health(self, db):
        health = db.get_health()
        assert "entities_tracked" in health
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/openproject-sync && python -m pytest tests/test_sync_db.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement sync database client**

```python
# scripts/openproject-sync/lib/sync_db.py
"""CRUD operations for sync.entity_map and sync.sync_log tables."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import psycopg2
import psycopg2.extras


@dataclass
class EntityMapping:
    entity_type: str
    gsd_path: Optional[str] = None
    op_project_id: Optional[int] = None
    op_work_package_id: Optional[int] = None
    op_version_id: Optional[int] = None
    github_issue_number: Optional[int] = None
    github_milestone_number: Optional[int] = None
    op_updated_at: Optional[datetime] = None
    gh_updated_at: Optional[datetime] = None
    gsd_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    sync_hash: Optional[str] = None
    id: Optional[int] = None


class SyncDb:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self._conn: Optional[psycopg2.extensions.connection] = None

    @property
    def conn(self) -> psycopg2.extensions.connection:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.dsn)
            self._conn.autocommit = True
        return self._conn

    def execute(self, sql: str, params: Optional[tuple] = None) -> None:
        with self.conn.cursor() as cur:
            cur.execute(sql, params)

    def upsert_mapping(self, m: EntityMapping) -> int:
        """Insert or update an entity mapping. Returns the row id."""
        now = datetime.now(timezone.utc)
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO sync.entity_map (
                    entity_type, gsd_path, op_project_id, op_work_package_id, op_version_id,
                    github_issue_number, github_milestone_number,
                    op_updated_at, gh_updated_at, gsd_updated_at,
                    last_synced_at, sync_hash
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (gsd_path) WHERE gsd_path IS NOT NULL
                DO UPDATE SET
                    op_work_package_id = COALESCE(EXCLUDED.op_work_package_id, sync.entity_map.op_work_package_id),
                    op_version_id = COALESCE(EXCLUDED.op_version_id, sync.entity_map.op_version_id),
                    github_issue_number = COALESCE(EXCLUDED.github_issue_number, sync.entity_map.github_issue_number),
                    github_milestone_number = COALESCE(EXCLUDED.github_milestone_number, sync.entity_map.github_milestone_number),
                    op_updated_at = COALESCE(EXCLUDED.op_updated_at, sync.entity_map.op_updated_at),
                    gh_updated_at = COALESCE(EXCLUDED.gh_updated_at, sync.entity_map.gh_updated_at),
                    gsd_updated_at = COALESCE(EXCLUDED.gsd_updated_at, sync.entity_map.gsd_updated_at),
                    last_synced_at = %s,
                    sync_hash = COALESCE(EXCLUDED.sync_hash, sync.entity_map.sync_hash)
                RETURNING id
            """, (
                m.entity_type, m.gsd_path, m.op_project_id, m.op_work_package_id, m.op_version_id,
                m.github_issue_number, m.github_milestone_number,
                m.op_updated_at, m.gh_updated_at, m.gsd_updated_at,
                now, m.sync_hash, now,
            ))
            return cur.fetchone()[0]

    def find_by_gsd_path(self, path: str) -> Optional[EntityMapping]:
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM sync.entity_map WHERE gsd_path = %s", (path,))
            row = cur.fetchone()
            return self._row_to_mapping(row) if row else None

    def find_by_op_wp(self, wp_id: int) -> Optional[EntityMapping]:
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM sync.entity_map WHERE op_work_package_id = %s", (wp_id,))
            row = cur.fetchone()
            return self._row_to_mapping(row) if row else None

    def find_by_gh_issue(self, issue_number: int) -> Optional[EntityMapping]:
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM sync.entity_map WHERE github_issue_number = %s", (issue_number,))
            row = cur.fetchone()
            return self._row_to_mapping(row) if row else None

    def find_all(self) -> list[EntityMapping]:
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM sync.entity_map ORDER BY id")
            return [self._row_to_mapping(row) for row in cur.fetchall()]

    def log_action(
        self, workflow: str, direction: str, entity_map_id: Optional[int],
        action: str, details: Optional[dict] = None,
    ) -> None:
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO sync.sync_log (workflow, direction, entity_map_id, action, details)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                workflow, direction, entity_map_id, action,
                psycopg2.extras.Json(details or {}),
            ))

    def get_health(self) -> dict:
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT * FROM sync.health")
            row = cur.fetchone()
            return dict(row) if row else {}

    def _row_to_mapping(self, row: dict) -> EntityMapping:
        return EntityMapping(
            id=row["id"],
            entity_type=row["entity_type"],
            gsd_path=row["gsd_path"],
            op_project_id=row["op_project_id"],
            op_work_package_id=row["op_work_package_id"],
            op_version_id=row["op_version_id"],
            github_issue_number=row["github_issue_number"],
            github_milestone_number=row["github_milestone_number"],
            op_updated_at=row["op_updated_at"],
            gh_updated_at=row["gh_updated_at"],
            gsd_updated_at=row["gsd_updated_at"],
            last_synced_at=row["last_synced_at"],
            sync_hash=row["sync_hash"],
        )

    def close(self) -> None:
        if self._conn and not self._conn.closed:
            self._conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/openproject-sync && python -m pytest tests/test_sync_db.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/openproject-sync/lib/sync_db.py scripts/openproject-sync/tests/test_sync_db.py
git commit -m "feat(sync): sync database client for entity_map and sync_log"
```

---

### Task 6: Build entity mapper

**Files:**
- Create: `scripts/openproject-sync/lib/mapper.py`
- Create: `scripts/openproject-sync/tests/test_mapper.py`

- [ ] **Step 1: Write failing tests**

```python
# scripts/openproject-sync/tests/test_mapper.py
import pytest
from lib.mapper import (
    gsd_status_to_op_status_id,
    gsd_status_to_gh_state,
    op_status_to_gsd_status,
    gh_state_to_gsd_status,
    phase_to_wp_description,
    OP_STATUS_NEW,
    OP_STATUS_IN_PROGRESS,
    OP_STATUS_CLOSED,
)
from lib.gsd_parser import RoadmapPhase


class TestStatusMapping:
    def test_gsd_pending_to_op(self):
        assert gsd_status_to_op_status_id("pending") == OP_STATUS_NEW

    def test_gsd_executing_to_op(self):
        assert gsd_status_to_op_status_id("executing") == OP_STATUS_IN_PROGRESS

    def test_gsd_complete_to_op(self):
        assert gsd_status_to_op_status_id("complete") == OP_STATUS_CLOSED

    def test_gsd_pending_to_gh(self):
        assert gsd_status_to_gh_state("pending") == "open"

    def test_gsd_complete_to_gh(self):
        assert gsd_status_to_gh_state("complete") == "closed"

    def test_op_closed_to_gsd(self):
        assert op_status_to_gsd_status(OP_STATUS_CLOSED) == "complete"

    def test_gh_closed_to_gsd(self):
        assert gh_state_to_gsd_status("closed") == "complete"


class TestDescriptionBuilder:
    def test_phase_description_includes_goal(self):
        phase = RoadmapPhase(
            number=1, name="Setup", goal="Scaffold the project",
            status="complete", completed_date="2026-03-26",
            depends_on=[], requirements=["FOUND-01"],
            success_criteria=["Project runs"], plans=["01-01: Scaffold"],
        )
        desc = phase_to_wp_description(phase)
        assert "Scaffold the project" in desc
        assert "FOUND-01" in desc
        assert "Project runs" in desc
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/openproject-sync && python -m pytest tests/test_mapper.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement mapper**

```python
# scripts/openproject-sync/lib/mapper.py
"""Bidirectional mapping logic between GSD, OpenProject, and GitHub entities."""

from __future__ import annotations

from lib.gsd_parser import RoadmapPhase, PlanDetail, QuickTask

# OpenProject status IDs (from /api/v3/statuses)
OP_STATUS_NEW = 1
OP_STATUS_IN_PROGRESS = 7
OP_STATUS_CLOSED = 12

# OpenProject type IDs (from /api/v3/types)
OP_TYPE_TASK = 1
OP_TYPE_MILESTONE = 2
OP_TYPE_SUMMARY = 3
OP_TYPE_FEATURE = 4
OP_TYPE_EPIC = 5

# GitHub label colors
LABEL_COLORS = {
    "phase": "5319E7",
    "plan": "1D76DB",
    "quick": "D93F0B",
    "req": "0E8A16",
    "in-progress": "FBCA04",
    "synced-by:n8n": "EDEDED",
}


def gsd_status_to_op_status_id(status: str) -> int:
    return {
        "pending": OP_STATUS_NEW,
        "executing": OP_STATUS_IN_PROGRESS,
        "complete": OP_STATUS_CLOSED,
    }.get(status, OP_STATUS_NEW)


def gsd_status_to_gh_state(status: str) -> str:
    return "closed" if status == "complete" else "open"


def op_status_to_gsd_status(status_id: int) -> str:
    if status_id == OP_STATUS_CLOSED:
        return "complete"
    if status_id == OP_STATUS_IN_PROGRESS:
        return "executing"
    return "pending"


def op_status_name_to_gsd_status(name: str) -> str:
    name_lower = name.lower()
    if name_lower in ("closed", "rejected"):
        return "complete"
    if name_lower in ("in progress", "developed", "in testing", "tested"):
        return "executing"
    return "pending"


def gh_state_to_gsd_status(state: str) -> str:
    return "complete" if state == "closed" else "pending"


def phase_to_wp_description(phase: RoadmapPhase) -> str:
    """Build an OpenProject work package description from a GSD phase."""
    parts = [f"**Goal:** {phase.goal}"]

    if phase.requirements:
        parts.append(f"\n**Requirements:** {', '.join(phase.requirements)}")

    if phase.depends_on:
        deps = ", ".join(f"Phase {d}" for d in phase.depends_on)
        parts.append(f"\n**Depends on:** {deps}")

    if phase.success_criteria:
        parts.append("\n**Success Criteria:**")
        for i, criterion in enumerate(phase.success_criteria, 1):
            parts.append(f"{i}. {criterion}")

    if phase.plans:
        parts.append("\n**Plans:**")
        for plan in phase.plans:
            parts.append(f"- {plan}")

    if phase.completed_date:
        parts.append(f"\n**Completed:** {phase.completed_date}")

    parts.append("\n<!-- n8n-sync -->")
    return "\n".join(parts)


def plan_to_wp_description(plan: PlanDetail) -> str:
    """Build an OpenProject work package description from a GSD plan."""
    parts = []
    if plan.objective:
        parts.append(f"**Objective:** {plan.objective}")

    if plan.requirements:
        parts.append(f"\n**Requirements:** {', '.join(plan.requirements)}")

    if plan.must_have_truths:
        parts.append("\n**Acceptance Criteria:**")
        for truth in plan.must_have_truths:
            parts.append(f"- [ ] {truth}")

    if plan.files_modified:
        parts.append("\n**Files Modified:**")
        for f in plan.files_modified:
            parts.append(f"- `{f}`")

    parts.append("\n<!-- n8n-sync -->")
    return "\n".join(parts)


def quick_task_to_wp_description(task: QuickTask) -> str:
    """Build an OpenProject work package description from a GSD quick task."""
    parts = [f"**Quick Task:** {task.description}"]
    if task.date:
        parts.append(f"\n**Date:** {task.date}")
    if task.commit_hash:
        parts.append(f"\n**Commit:** `{task.commit_hash}`")
    parts.append("\n<!-- n8n-sync -->")
    return "\n".join(parts)


def phase_to_gh_issue_body(phase: RoadmapPhase) -> str:
    """Build a GitHub issue body from a GSD phase."""
    parts = [f"## Phase {phase.number}: {phase.name}", f"\n{phase.goal}"]

    if phase.success_criteria:
        parts.append("\n### Success Criteria")
        for criterion in phase.success_criteria:
            parts.append(f"- [ ] {criterion}")

    if phase.plans:
        parts.append("\n### Plans")
        for plan in phase.plans:
            parts.append(f"- {plan}")

    parts.append(f"\n---\n_Synced from `.planning/ROADMAP.md`_")
    return "\n".join(parts)


def phase_labels(phase: RoadmapPhase) -> list[str]:
    """Generate GitHub labels for a phase."""
    labels = [f"phase:{phase.number:02d}", "synced-by:n8n"]
    for req in phase.requirements:
        labels.append(f"req:{req}")
    return labels


def plan_labels(plan: PlanDetail) -> list[str]:
    """Generate GitHub labels for a plan."""
    labels = [f"phase:{plan.phase_number:02d}", f"plan:{plan.phase_number:02d}-{plan.plan_number:02d}", "synced-by:n8n"]
    for req in plan.requirements:
        labels.append(f"req:{req}")
    return labels
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/openproject-sync && python -m pytest tests/test_mapper.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/openproject-sync/lib/mapper.py scripts/openproject-sync/tests/test_mapper.py
git commit -m "feat(sync): bidirectional entity mapper (GSD/OP/GitHub status + description)"
```

---

### Task 7: Build backfill script

**Files:**
- Create: `scripts/openproject-sync/backfill.py`

- [ ] **Step 1: Write the backfill script**

```python
#!/usr/bin/env python3
"""One-time backfill: import GSD phases, plans, and quick tasks into OpenProject and GitHub.

Existing OP work packages (31) and GitHub issues/milestones are left as-is.
This script creates NEW entities for GSD phases/plans that don't yet exist in OP/GH,
and populates the sync.entity_map table.

Usage:
    python backfill.py --dry-run          # Preview what would be created
    python backfill.py                     # Execute backfill
    python backfill.py --map-existing      # Map existing OP WPs and GH issues to sync table only
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from lib.gsd_parser import parse_roadmap, parse_state, parse_plan
from lib.op_client import OpenProjectClient, OpConfig
from lib.gh_client import GitHubClient, GhConfig
from lib.sync_db import SyncDb, EntityMapping
from lib.mapper import (
    gsd_status_to_op_status_id,
    gsd_status_to_gh_state,
    phase_to_wp_description,
    plan_to_wp_description,
    quick_task_to_wp_description,
    phase_to_gh_issue_body,
    phase_labels,
    plan_labels,
    OP_TYPE_SUMMARY,
    OP_TYPE_TASK,
    LABEL_COLORS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PLANNING_DIR = Path("/home/smudoshi/Github/Parthenon/.planning")
OP_PROJECT_ID = 4  # Existing Parthenon project in OpenProject


def ensure_labels(gh: GitHubClient, phases: list) -> None:
    """Create all needed GitHub labels if they don't exist."""
    needed = set()
    needed.add("synced-by:n8n")
    needed.add("quick")
    for phase in phases:
        needed.add(f"phase:{phase.number:02d}")
        for req in phase.requirements:
            needed.add(f"req:{req}")
        for i in range(1, phase.plan_count + 1):
            needed.add(f"plan:{phase.number:02d}-{i:02d}")

    existing = {l["name"] for l in gh.list_labels()}
    for label in sorted(needed):
        if label not in existing:
            prefix = label.split(":")[0] if ":" in label else label
            color = LABEL_COLORS.get(prefix, "EDEDED")
            logger.info(f"  Creating label: {label}")
            gh.create_label(label, color)


def find_or_create_gsd_milestone(gh: GitHubClient, title: str, dry_run: bool) -> int | None:
    """Find existing GSD milestone on GitHub or create one."""
    milestones = gh.list_milestones()
    for m in milestones:
        if m["title"] == title:
            return m["number"]
    if dry_run:
        logger.info(f"  [DRY RUN] Would create GitHub milestone: {title}")
        return None
    m = gh.create_milestone(title, state="closed")
    logger.info(f"  Created GitHub milestone #{m['number']}: {title}")
    return m["number"]


def backfill(dry_run: bool = False, map_existing: bool = False) -> None:
    # Initialize clients
    op = OpenProjectClient(OpConfig(
        base_url="https://projects.acumenus.net",
        api_key=os.environ.get("OP_API_KEY", "bbbe16bf0c9297f1697b7fd30638d1539462f53fac64650c0125bfe321b128a7"),
    ))
    gh = GitHubClient()
    db = SyncDb(os.environ.get("SYNC_DB_DSN", "dbname=parthenon user=claude_dev"))

    # Parse GSD files
    roadmap_content = (PLANNING_DIR / "ROADMAP.md").read_text()
    state_content = (PLANNING_DIR / "STATE.md").read_text()
    phases = parse_roadmap(roadmap_content)
    state = parse_state(state_content)

    logger.info(f"Parsed {len(phases)} phases, {len(state.quick_tasks)} quick tasks")
    logger.info(f"Project milestone: {state.milestone}")

    if map_existing:
        logger.info("--- Mapping existing OP WPs and GH issues to sync table ---")
        map_existing_entities(op, gh, db, phases)
        return

    # Step 1: Ensure GitHub labels exist
    logger.info("--- Ensuring GitHub labels ---")
    if not dry_run:
        ensure_labels(gh, phases)

    # Step 2: Create/find GSD milestone on GitHub
    milestone_title = f"GSD: {state.milestone}" if state.milestone else "GSD: IRSF-NHS v5.4"
    gh_milestone_num = find_or_create_gsd_milestone(gh, milestone_title, dry_run)

    # Step 3: Backfill phases as Summary Task WPs + GitHub Issues
    logger.info(f"--- Backfilling {len(phases)} phases ---")
    phase_wp_ids: dict[int, int] = {}  # phase_number -> OP WP id

    for phase in phases:
        gsd_path = f".planning/phases/{phase.number:02d}-{phase.name.lower().replace(' ', '-')[:30]}"

        existing = db.find_by_gsd_path(gsd_path)
        if existing and existing.op_work_package_id:
            logger.info(f"  Phase {phase.number} already mapped (WP {existing.op_work_package_id})")
            phase_wp_ids[phase.number] = existing.op_work_package_id
            continue

        wp_desc = phase_to_wp_description(phase)
        op_status = gsd_status_to_op_status_id(phase.status)
        gh_body = phase_to_gh_issue_body(phase)
        labels = phase_labels(phase)

        if dry_run:
            logger.info(f"  [DRY RUN] Phase {phase.number}: {phase.name} -> OP Summary Task + GH Issue")
            continue

        # Create OP work package
        wp = op.create_work_package(
            project_id=OP_PROJECT_ID,
            subject=f"Phase {phase.number:02d}: {phase.name}",
            description=wp_desc,
            type_id=OP_TYPE_SUMMARY,
            status_id=op_status,
        )
        wp_id = wp["id"]
        phase_wp_ids[phase.number] = wp_id
        logger.info(f"  Created OP WP #{wp_id}: Phase {phase.number}: {phase.name}")

        # Create GitHub Issue
        gh_issue = gh.create_issue(
            title=f"Phase {phase.number:02d}: {phase.name}",
            body=gh_body,
            labels=labels,
            milestone=gh_milestone_num,
        )
        gh_num = gh_issue["number"]
        if phase.status == "complete":
            gh.close_issue(gh_num)
        logger.info(f"  Created GH Issue #{gh_num}: Phase {phase.number}")

        # Record in sync table
        db.upsert_mapping(EntityMapping(
            entity_type="phase",
            gsd_path=gsd_path,
            op_project_id=OP_PROJECT_ID,
            op_work_package_id=wp_id,
            github_issue_number=gh_num,
            github_milestone_number=gh_milestone_num,
        ))
        db.log_action("backfill", "gsd->op", None, "created", {
            "phase": phase.number, "op_wp": wp_id, "gh_issue": gh_num,
        })

    # Step 4: Backfill plans as child Task WPs + GitHub Issues
    logger.info("--- Backfilling plans ---")
    phase_dirs = sorted(PLANNING_DIR.glob("phases/*/"))
    for phase_dir in phase_dirs:
        plan_files = sorted(phase_dir.glob("*-PLAN.md"))
        for plan_file in plan_files:
            plan_content = plan_file.read_text()
            plan = parse_plan(plan_content)
            if plan.phase_number == 0:
                continue

            gsd_path = str(plan_file.relative_to(PLANNING_DIR))
            existing = db.find_by_gsd_path(gsd_path)
            if existing and existing.op_work_package_id:
                logger.info(f"  Plan {plan.phase_number}-{plan.plan_number:02d} already mapped")
                continue

            parent_wp_id = phase_wp_ids.get(plan.phase_number)
            wp_desc = plan_to_wp_description(plan)
            labels = plan_labels(plan)

            if dry_run:
                logger.info(f"  [DRY RUN] Plan {plan.phase_number}-{plan.plan_number:02d}: {plan.objective[:50]}")
                continue

            # Create OP child WP
            wp = op.create_work_package(
                project_id=OP_PROJECT_ID,
                subject=f"{plan.phase_number:02d}-{plan.plan_number:02d}: {plan.objective[:80]}",
                description=wp_desc,
                type_id=OP_TYPE_TASK,
                status_id=gsd_status_to_op_status_id("complete"),
                parent_id=parent_wp_id,
            )
            wp_id = wp["id"]

            # Create GitHub Issue
            gh_issue = gh.create_issue(
                title=f"Plan {plan.phase_number:02d}-{plan.plan_number:02d}: {plan.objective[:60]}",
                body=wp_desc.replace("<!-- n8n-sync -->", "_Synced from GSD_"),
                labels=labels,
                milestone=gh_milestone_num,
            )
            gh_num = gh_issue["number"]
            gh.close_issue(gh_num)

            logger.info(f"  Created Plan {plan.phase_number}-{plan.plan_number:02d}: WP #{wp_id}, Issue #{gh_num}")

            db.upsert_mapping(EntityMapping(
                entity_type="plan",
                gsd_path=gsd_path,
                op_project_id=OP_PROJECT_ID,
                op_work_package_id=wp_id,
                github_issue_number=gh_num,
                github_milestone_number=gh_milestone_num,
            ))

    # Step 5: Backfill quick tasks
    logger.info(f"--- Backfilling {len(state.quick_tasks)} quick tasks ---")
    for qt in state.quick_tasks:
        gsd_path = f".planning/quick/{qt.name}"
        existing = db.find_by_gsd_path(gsd_path)
        if existing:
            logger.info(f"  Quick task {qt.name} already mapped")
            continue

        desc = quick_task_to_wp_description(qt)

        if dry_run:
            logger.info(f"  [DRY RUN] Quick task: {qt.name} — {qt.description[:50]}")
            continue

        wp = op.create_work_package(
            project_id=OP_PROJECT_ID,
            subject=f"Quick: {qt.description[:80]}",
            description=desc,
            type_id=OP_TYPE_TASK,
            status_id=gsd_status_to_op_status_id("complete"),
        )
        wp_id = wp["id"]

        gh_issue = gh.create_issue(
            title=f"Quick: {qt.description[:60]}",
            body=desc.replace("<!-- n8n-sync -->", "_Synced from GSD_"),
            labels=["quick", "synced-by:n8n"],
            milestone=gh_milestone_num,
        )
        gh_num = gh_issue["number"]
        gh.close_issue(gh_num)

        logger.info(f"  Created Quick task: WP #{wp_id}, Issue #{gh_num}")

        db.upsert_mapping(EntityMapping(
            entity_type="quick",
            gsd_path=gsd_path,
            op_project_id=OP_PROJECT_ID,
            op_work_package_id=wp_id,
            github_issue_number=gh_num,
            github_milestone_number=gh_milestone_num,
        ))

    # Step 6: Add "follows" relations between phases in OP
    if not dry_run:
        logger.info("--- Adding phase dependency relations ---")
        for phase in phases:
            if not phase.depends_on:
                continue
            wp_id = phase_wp_ids.get(phase.number)
            if not wp_id:
                continue
            for dep in phase.depends_on:
                dep_wp_id = phase_wp_ids.get(dep)
                if dep_wp_id:
                    try:
                        op.add_wp_relation(wp_id, dep_wp_id, "follows")
                        logger.info(f"  Phase {phase.number} follows Phase {dep}")
                    except Exception as e:
                        logger.warning(f"  Relation Phase {phase.number}->Phase {dep} failed: {e}")

    # Summary
    mappings = db.find_all()
    logger.info(f"\n--- Backfill complete ---")
    logger.info(f"Total entities in sync table: {len(mappings)}")
    logger.info(f"  Phases: {sum(1 for m in mappings if m.entity_type == 'phase')}")
    logger.info(f"  Plans: {sum(1 for m in mappings if m.entity_type == 'plan')}")
    logger.info(f"  Quick tasks: {sum(1 for m in mappings if m.entity_type == 'quick')}")

    db.close()


def map_existing_entities(op, gh, db, phases) -> None:
    """Map existing OP WPs and GH issues to sync table without creating new ones."""
    wps = op.list_work_packages(OP_PROJECT_ID)
    issues = gh.list_issues(state="all")

    logger.info(f"Found {len(wps)} existing OP WPs and {len(issues)} GH issues")

    for wp in wps:
        subject = wp["subject"]
        # Try to match by phase number in subject
        import re
        phase_match = re.search(r"Phase (\d+)", subject)
        if phase_match:
            phase_num = int(phase_match.group(1))
            phase = next((p for p in phases if p.number == phase_num), None)
            if phase:
                gsd_path = f".planning/phases/{phase.number:02d}-{phase.name.lower().replace(' ', '-')[:30]}"
                db.upsert_mapping(EntityMapping(
                    entity_type="phase",
                    gsd_path=gsd_path,
                    op_project_id=OP_PROJECT_ID,
                    op_work_package_id=wp["id"],
                ))
                logger.info(f"  Mapped OP WP #{wp['id']} -> {gsd_path}")

    logger.info("--- Existing entity mapping complete ---")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill GSD -> OpenProject + GitHub")
    parser.add_argument("--dry-run", action="store_true", help="Preview without creating")
    parser.add_argument("--map-existing", action="store_true", help="Map existing entities only")
    args = parser.parse_args()
    backfill(dry_run=args.dry_run, map_existing=args.map_existing)
```

- [ ] **Step 2: Test with dry-run**

Run: `cd scripts/openproject-sync && python backfill.py --dry-run`
Expected: Lists all phases, plans, and quick tasks that would be created, without touching OP or GitHub

- [ ] **Step 3: Commit**

```bash
git add scripts/openproject-sync/backfill.py
git commit -m "feat(sync): backfill script for GSD -> OpenProject + GitHub import"
```

---

### Task 8: Build n8n workflow — OP → GitHub + GSD (Workflows 1 & 2)

**Files:**
- Create: `acropolis/config/n8n/workflows/op-sync-from-op.json`

- [ ] **Step 1: Write the n8n workflow JSON**

```json
{
  "id": "op-sync-from-op",
  "name": "OpenProject Sync: OP → GitHub + GSD",
  "active": true,
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "op-sync",
        "options": {
          "rawBody": true
        }
      },
      "id": "webhook-op",
      "name": "OP Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300],
      "webhookId": "op-sync"
    },
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body || $input.first().json;\nconst action = body.action || 'unknown';\nconst wp = body.work_package || {};\nconst wpId = wp.id;\nconst subject = wp.subject || '';\nconst status = wp._links?.status?.title || '';\nconst updatedBy = wp._links?.updatedBy?.title || '';\n\n// Loop prevention: skip if updated by service account\nif (updatedBy === 'svc-n8n-sync' || updatedBy === 'n8n Sync') {\n  return [];\n}\n\n// Skip if description contains n8n-sync marker and was just synced\nconst desc = wp.description?.raw || '';\n\nreturn [{\n  json: {\n    action,\n    wpId,\n    subject,\n    status,\n    description: desc,\n    projectId: wp._links?.project?.href?.split('/').pop(),\n    typeTitle: wp._links?.type?.title || 'Task',\n    parentId: wp._links?.parent?.href?.split('/').pop() || null\n  }\n}];"
      },
      "id": "parse-op-event",
      "name": "Parse OP Event",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "=http://host.docker.internal:5432",
        "options": {}
      },
      "id": "placeholder-lookup",
      "name": "Lookup Sync Table",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, 300],
      "parameters": {
        "jsCode": "// This node queries the sync.entity_map table via the Parthenon API\n// or directly via a Postgres node (preferred)\nconst wpId = $input.first().json.wpId;\n\n// Pass through for now — actual DB lookup added when Postgres node is wired\nreturn [{\n  json: {\n    ...$input.first().json,\n    syncLookup: { wpId, found: false, githubIssue: null, gsdPath: null }\n  }\n}];"
      }
    },
    {
      "parameters": {
        "conditions": {
          "conditions": [
            {
              "id": "is-status-change",
              "leftValue": "={{ $json.action }}",
              "rightValue": "work_package:updated",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "if-update",
      "name": "Is Update?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [900, 300]
    },
    {
      "parameters": {
        "jsCode": "// Sync to GitHub: update issue status and title\nconst data = $input.first().json;\nconst ghIssue = data.syncLookup?.githubIssue;\nconst status = data.status;\n\nconst ghState = ['Closed', 'Rejected'].includes(status) ? 'closed' : 'open';\n\nreturn [{\n  json: {\n    ...data,\n    ghAction: ghIssue ? 'update' : 'create',\n    ghState,\n    ghIssueNumber: ghIssue\n  }\n}];"
      },
      "id": "sync-to-gh",
      "name": "Sync to GitHub",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1120, 200]
    },
    {
      "parameters": {},
      "id": "no-op",
      "name": "No Action",
      "type": "n8n-nodes-base.noOp",
      "typeVersion": 1,
      "position": [1120, 420]
    }
  ],
  "connections": {
    "OP Webhook": {
      "main": [
        [{ "node": "Parse OP Event", "type": "main", "index": 0 }]
      ]
    },
    "Parse OP Event": {
      "main": [
        [{ "node": "Lookup Sync Table", "type": "main", "index": 0 }]
      ]
    },
    "Lookup Sync Table": {
      "main": [
        [{ "node": "Is Update?", "type": "main", "index": 0 }]
      ]
    },
    "Is Update?": {
      "main": [
        [{ "node": "Sync to GitHub", "type": "main", "index": 0 }],
        [{ "node": "No Action", "type": "main", "index": 0 }]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "timezone": "America/New_York"
  },
  "tags": [
    { "name": "sync" },
    { "name": "openproject" }
  ]
}
```

Note: This is a scaffold workflow. The actual Postgres lookup and GitHub API calls will be wired via n8n's Postgres and HTTP Request nodes in the n8n UI after importing. The Code nodes contain the core logic.

- [ ] **Step 2: Commit**

```bash
git add acropolis/config/n8n/workflows/op-sync-from-op.json
git commit -m "feat(sync): n8n workflow scaffold — OP → GitHub + GSD"
```

---

### Task 9: Build n8n workflow — GitHub → OP (Workflows 3 & 4)

**Files:**
- Create: `acropolis/config/n8n/workflows/op-sync-from-gh.json`

- [ ] **Step 1: Write the n8n workflow JSON**

```json
{
  "id": "op-sync-from-gh",
  "name": "OpenProject Sync: GitHub → OP",
  "active": true,
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "gh-sync",
        "options": {
          "rawBody": true
        }
      },
      "id": "webhook-gh",
      "name": "GitHub Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300],
      "webhookId": "gh-sync"
    },
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body || $input.first().json;\nconst action = body.action || 'unknown';\nconst eventType = $input.first().headers?.['x-github-event'] || 'unknown';\n\n// Loop prevention: skip if issue has synced-by:n8n label and was just created by sync\nconst labels = (body.issue?.labels || body.pull_request?.labels || []).map(l => l.name);\nif (labels.includes('synced-by:n8n') && ['opened', 'labeled'].includes(action)) {\n  return [];\n}\n\nconst result = {\n  eventType,\n  action,\n  issueNumber: body.issue?.number || body.pull_request?.number,\n  title: body.issue?.title || body.pull_request?.title || '',\n  state: body.issue?.state || body.pull_request?.state || '',\n  body: body.issue?.body || body.pull_request?.body || '',\n  labels,\n  milestoneNumber: body.issue?.milestone?.number || null,\n  merged: body.pull_request?.merged || false,\n  prUrl: body.pull_request?.html_url || null\n};\n\nreturn [{ json: result }];"
      },
      "id": "parse-gh-event",
      "name": "Parse GitHub Event",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "conditions": {
          "conditions": [
            {
              "id": "is-pr-merge",
              "leftValue": "={{ $json.eventType }}",
              "rightValue": "pull_request",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "is-pr",
      "name": "Is PR Event?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [680, 300]
    },
    {
      "parameters": {
        "jsCode": "// Handle PR merged: update linked OP work packages\nconst data = $input.first().json;\nif (!data.merged) return [];\n\n// Extract issue references from PR body (e.g., 'Closes #123', 'Fixes #456')\nconst body = data.body || '';\nconst linkedIssues = [];\nconst pattern = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#(\\d+)/gi;\nlet match;\nwhile ((match = pattern.exec(body)) !== null) {\n  linkedIssues.push(parseInt(match[1]));\n}\n\nreturn [{\n  json: {\n    ...data,\n    linkedIssues,\n    action: 'pr_merged'\n  }\n}];"
      },
      "id": "handle-pr",
      "name": "Handle PR Merge",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [900, 200]
    },
    {
      "parameters": {
        "jsCode": "// Handle issue created/updated/closed: sync to OP\nconst data = $input.first().json;\nconst action = data.action;\n\n// Map GitHub state to OP status\nlet opStatusId = 1; // New\nif (data.state === 'closed') opStatusId = 12; // Closed\nelse if (data.labels.includes('in-progress')) opStatusId = 7; // In progress\n\nreturn [{\n  json: {\n    ...data,\n    opStatusId,\n    opAction: action === 'opened' ? 'create' : 'update'\n  }\n}];"
      },
      "id": "handle-issue",
      "name": "Handle Issue",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [900, 420]
    }
  ],
  "connections": {
    "GitHub Webhook": {
      "main": [
        [{ "node": "Parse GitHub Event", "type": "main", "index": 0 }]
      ]
    },
    "Parse GitHub Event": {
      "main": [
        [{ "node": "Is PR Event?", "type": "main", "index": 0 }]
      ]
    },
    "Is PR Event?": {
      "main": [
        [{ "node": "Handle PR Merge", "type": "main", "index": 0 }],
        [{ "node": "Handle Issue", "type": "main", "index": 0 }]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "timezone": "America/New_York"
  },
  "tags": [
    { "name": "sync" },
    { "name": "github" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add acropolis/config/n8n/workflows/op-sync-from-gh.json
git commit -m "feat(sync): n8n workflow scaffold — GitHub → OP (issues + PR merge)"
```

---

### Task 10: Build n8n workflow — Git Push → OP (Workflow 5)

**Files:**
- Create: `acropolis/config/n8n/workflows/op-sync-from-push.json`

- [ ] **Step 1: Write the n8n workflow JSON**

```json
{
  "id": "op-sync-from-push",
  "name": "OpenProject Sync: Git Push → OP",
  "active": true,
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "gh-push",
        "options": {
          "rawBody": true
        }
      },
      "id": "webhook-push",
      "name": "Push Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300],
      "webhookId": "gh-push"
    },
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body || $input.first().json;\nconst commits = body.commits || [];\n\n// Loop prevention: skip commits from n8n sync\nconst syncCommits = commits.filter(c => c.message.includes('[op-sync]'));\nif (syncCommits.length === commits.length) {\n  return []; // All commits are sync-originated\n}\n\n// Filter for .planning/ file changes only\nconst planningChanges = [];\nfor (const commit of commits) {\n  if (commit.message.includes('[op-sync]')) continue;\n  const allFiles = [\n    ...(commit.added || []),\n    ...(commit.modified || []),\n  ];\n  const planFiles = allFiles.filter(f => f.startsWith('.planning/'));\n  if (planFiles.length > 0) {\n    planningChanges.push({\n      hash: commit.id,\n      message: commit.message,\n      files: planFiles\n    });\n  }\n}\n\nif (planningChanges.length === 0) return [];\n\nreturn [{\n  json: {\n    changes: planningChanges,\n    totalFiles: planningChanges.reduce((sum, c) => sum + c.files.length, 0)\n  }\n}];"
      },
      "id": "filter-planning",
      "name": "Filter .planning/ Changes",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "jsCode": "// Categorize changed files and determine which OP entities to update\nconst data = $input.first().json;\nconst updates = [];\n\nfor (const change of data.changes) {\n  for (const file of change.files) {\n    if (file.includes('ROADMAP.md')) {\n      updates.push({ type: 'roadmap', file, commit: change.hash });\n    } else if (file.includes('STATE.md')) {\n      updates.push({ type: 'state', file, commit: change.hash });\n    } else if (file.includes('PLAN.md')) {\n      // Extract phase/plan numbers from path\n      const match = file.match(/phases\\/(\\d+)-[^/]+\\/(\\d+)-(\\d+)-PLAN/);\n      if (match) {\n        updates.push({\n          type: 'plan',\n          file,\n          phase: parseInt(match[1]),\n          plan: parseInt(match[3]),\n          commit: change.hash\n        });\n      }\n    }\n  }\n}\n\nreturn [{ json: { updates } }];"
      },
      "id": "categorize",
      "name": "Categorize Changes",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [680, 300]
    }
  ],
  "connections": {
    "Push Webhook": {
      "main": [
        [{ "node": "Filter .planning/ Changes", "type": "main", "index": 0 }]
      ]
    },
    "Filter .planning/ Changes": {
      "main": [
        [{ "node": "Categorize Changes", "type": "main", "index": 0 }]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "timezone": "America/New_York"
  },
  "tags": [
    { "name": "sync" },
    { "name": "git" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add acropolis/config/n8n/workflows/op-sync-from-push.json
git commit -m "feat(sync): n8n workflow scaffold — Git push → OP (.planning/ changes)"
```

---

### Task 11: Build n8n workflow — Reconciliation (Workflow 6)

**Files:**
- Create: `acropolis/config/n8n/workflows/op-sync-reconcile.json`

- [ ] **Step 1: Write the n8n workflow JSON**

```json
{
  "id": "op-sync-reconcile",
  "name": "OpenProject Sync: Reconciliation (every 30 min)",
  "active": true,
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "*/30 * * * *"
            }
          ]
        }
      },
      "id": "cron-trigger",
      "name": "Every 30 Minutes",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [240, 300]
    },
    {
      "parameters": {
        "jsCode": "// Fetch current state from all three sources and reconcile\n// This is the safety net — catches anything webhooks missed\n\nconst now = new Date().toISOString();\n\nreturn [{\n  json: {\n    startedAt: now,\n    phase: 'fetch',\n    // The actual reconciliation logic calls the Python sync library\n    // via HTTP to a local endpoint on host.docker.internal\n    reconcileUrl: 'http://host.docker.internal:9878/reconcile'\n  }\n}];"
      },
      "id": "init",
      "name": "Init Reconciliation",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.reconcileUrl }}",
        "options": {
          "timeout": 120000
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "since",
              "value": "={{ new Date(Date.now() - 35 * 60 * 1000).toISOString() }}"
            }
          ]
        }
      },
      "id": "run-reconcile",
      "name": "Run Reconciliation",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [680, 300]
    },
    {
      "parameters": {
        "conditions": {
          "conditions": [
            {
              "id": "has-conflicts",
              "leftValue": "={{ $json.conflicts }}",
              "rightValue": "0",
              "operator": {
                "type": "number",
                "operation": "gt"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "if-conflicts",
      "name": "Any Conflicts?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [900, 300]
    },
    {
      "parameters": {
        "jsCode": "const data = $input.first().json;\nconst summary = `Reconciliation: ${data.synced || 0} synced, ${data.conflicts || 0} conflicts (OP won), ${data.errors || 0} errors`;\nreturn [{ json: { summary, alert: true } }];"
      },
      "id": "log-conflicts",
      "name": "Log Conflicts",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1120, 200]
    },
    {
      "parameters": {},
      "id": "idle",
      "name": "All Clean",
      "type": "n8n-nodes-base.noOp",
      "typeVersion": 1,
      "position": [1120, 420]
    }
  ],
  "connections": {
    "Every 30 Minutes": {
      "main": [
        [{ "node": "Init Reconciliation", "type": "main", "index": 0 }]
      ]
    },
    "Init Reconciliation": {
      "main": [
        [{ "node": "Run Reconciliation", "type": "main", "index": 0 }]
      ]
    },
    "Run Reconciliation": {
      "main": [
        [{ "node": "Any Conflicts?", "type": "main", "index": 0 }]
      ]
    },
    "Any Conflicts?": {
      "main": [
        [{ "node": "Log Conflicts", "type": "main", "index": 0 }],
        [{ "node": "All Clean", "type": "main", "index": 0 }]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "timezone": "America/New_York"
  },
  "tags": [
    { "name": "sync" },
    { "name": "reconciliation" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add acropolis/config/n8n/workflows/op-sync-reconcile.json
git commit -m "feat(sync): n8n workflow — 30-min reconciliation cron"
```

---

### Task 12: Build reconciliation HTTP service

**Files:**
- Create: `scripts/openproject-sync/reconcile_server.py`

The reconciliation workflow calls a local HTTP endpoint that runs the Python reconciliation logic. This avoids embedding complex Python in n8n Code nodes.

- [ ] **Step 1: Write the reconciliation server**

```python
#!/usr/bin/env python3
"""Lightweight HTTP server for reconciliation logic, called by n8n.

Runs on port 9878, accessible from n8n via host.docker.internal:9878.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

from lib.op_client import OpenProjectClient, OpConfig
from lib.gh_client import GitHubClient
from lib.sync_db import SyncDb
from lib.mapper import (
    op_status_name_to_gsd_status,
    gsd_status_to_op_status_id,
    gsd_status_to_gh_state,
    OP_STATUS_CLOSED,
    OP_STATUS_IN_PROGRESS,
    OP_STATUS_NEW,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

OP_PROJECT_ID = 4


class ReconcileHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path == "/reconcile":
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            result = run_reconciliation(body.get("since"))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        elif self.path == "/health":
            self.do_GET()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self) -> None:
        if self.path in ("/health", "/webhook/sync-health"):
            db = SyncDb(os.environ.get("SYNC_DB_DSN", "dbname=parthenon user=claude_dev"))
            health = db.get_health()
            health["status"] = "healthy"
            db.close()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(health, default=str).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        logger.info(f"{self.address_string()} - {format % args}")


def run_reconciliation(since: str | None = None) -> dict:
    """Run full reconciliation across OP, GitHub, and GSD.

    OP is source of truth. If OP and another source disagree, OP wins.
    """
    op = OpenProjectClient(OpConfig(
        base_url="https://projects.acumenus.net",
        api_key=os.environ.get("OP_API_KEY", ""),
    ))
    gh = GitHubClient()
    db = SyncDb(os.environ.get("SYNC_DB_DSN", "dbname=parthenon user=claude_dev"))

    stats = {"synced": 0, "conflicts": 0, "errors": 0, "skipped": 0}

    try:
        # Get all tracked entities
        mappings = db.find_all()
        logger.info(f"Reconciling {len(mappings)} tracked entities")

        # Get current state from OP
        op_wps = {wp["id"]: wp for wp in op.list_work_packages(OP_PROJECT_ID)}

        # Get current state from GitHub
        gh_issues = {i["number"]: i for i in gh.list_issues(state="all")}

        for mapping in mappings:
            try:
                op_wp = op_wps.get(mapping.op_work_package_id) if mapping.op_work_package_id else None
                gh_issue = gh_issues.get(mapping.github_issue_number) if mapping.github_issue_number else None

                if not op_wp:
                    stats["skipped"] += 1
                    continue

                op_status = op_wp["_links"]["status"]["title"]
                op_gsd = op_status_name_to_gsd_status(op_status)

                # Check GitHub state
                if gh_issue:
                    gh_state = gh_issue["state"]
                    expected_gh = gsd_status_to_gh_state(op_gsd)
                    if gh_state != expected_gh:
                        logger.info(f"  Conflict: GH #{mapping.github_issue_number} is {gh_state}, OP says {op_status} -> forcing {expected_gh}")
                        if expected_gh == "closed":
                            gh.close_issue(mapping.github_issue_number)
                        else:
                            gh.update_issue(mapping.github_issue_number, {"state": "open"})
                        stats["conflicts"] += 1
                        db.log_action("reconcile", "reconcile", mapping.id, "conflict_resolved", {
                            "source": "op", "target": "github",
                            "op_status": op_status, "gh_was": gh_state, "gh_now": expected_gh,
                        })
                    else:
                        stats["synced"] += 1

            except Exception as e:
                logger.error(f"  Error reconciling entity {mapping.id}: {e}")
                stats["errors"] += 1
                db.log_action("reconcile", "reconcile", mapping.id, "error", {"error": str(e)})

        db.log_action("reconcile", "reconcile", None, "completed", stats)
        logger.info(f"Reconciliation complete: {stats}")

    finally:
        db.close()

    return stats


if __name__ == "__main__":
    port = int(os.environ.get("RECONCILE_PORT", "9878"))
    server = HTTPServer(("0.0.0.0", port), ReconcileHandler)
    logger.info(f"Reconciliation server starting on port {port}")
    server.serve_forever()
```

- [ ] **Step 2: Test the server starts**

Run:
```bash
cd scripts/openproject-sync && timeout 3 python reconcile_server.py 2>&1 || true
```
Expected: "Reconciliation server starting on port 9878" then timeout

- [ ] **Step 3: Commit**

```bash
git add scripts/openproject-sync/reconcile_server.py
git commit -m "feat(sync): reconciliation HTTP server for n8n cron workflow"
```

---

### Task 13: Execute backfill and activate sync

This task is manual / interactive — not automated by subagents.

- [ ] **Step 1: Install Python dependencies**

Run:
```bash
cd scripts/openproject-sync && pip install --break-system-packages -r requirements.txt
```

- [ ] **Step 2: Apply sync schema**

Run:
```bash
psql -U claude_dev -d parthenon -f scripts/openproject-sync/schema.sql
```

- [ ] **Step 3: Run backfill dry-run**

Run:
```bash
cd scripts/openproject-sync && python backfill.py --dry-run
```
Expected: Lists all entities that would be created (12 phases, ~24 plans, ~19 quick tasks)

- [ ] **Step 4: Execute backfill**

Run:
```bash
cd scripts/openproject-sync && python backfill.py
```
Expected: Creates ~55 entities across OP and GitHub, populates sync.entity_map

- [ ] **Step 5: Verify sync table**

Run:
```bash
psql -U claude_dev -d parthenon -c "SELECT entity_type, COUNT(*) FROM sync.entity_map GROUP BY entity_type ORDER BY entity_type"
```
Expected: phase: 12, plan: ~24, quick: ~19

- [ ] **Step 6: Configure GitHub webhooks**

Run:
```bash
# Create GitHub webhooks
gh api repos/sudoshi/Parthenon/hooks --method POST --input - <<'EOF'
{
  "name": "web",
  "active": true,
  "events": ["issues", "pull_request", "milestone"],
  "config": {
    "url": "https://n8n.acumenus.net/webhook/gh-sync",
    "content_type": "json",
    "secret": "parthenon-op-sync-2026"
  }
}
EOF

gh api repos/sudoshi/Parthenon/hooks --method POST --input - <<'EOF'
{
  "name": "web",
  "active": true,
  "events": ["push"],
  "config": {
    "url": "https://n8n.acumenus.net/webhook/gh-push",
    "content_type": "json",
    "secret": "parthenon-op-sync-2026"
  }
}
EOF
```

- [ ] **Step 7: Start reconciliation server as background service**

Run:
```bash
cd scripts/openproject-sync && nohup python reconcile_server.py > /tmp/reconcile-server.log 2>&1 &
echo $! > /tmp/reconcile-server.pid
```

- [ ] **Step 8: Import n8n workflows**

Navigate to `https://n8n.acumenus.net`, import each workflow JSON from `acropolis/config/n8n/workflows/op-sync-*.json`, configure Postgres credentials for sync table lookups, and activate.

- [ ] **Step 9: Verify health**

Run:
```bash
curl -s http://localhost:9878/health | python3 -m json.tool
```
Expected: JSON with entities_tracked > 0, status: "healthy"

- [ ] **Step 10: Run manual reconciliation**

Run:
```bash
curl -s -X POST http://localhost:9878/reconcile -d '{}' | python3 -m json.tool
```
Expected: `{"synced": N, "conflicts": 0, "errors": 0, "skipped": M}`

- [ ] **Step 11: Commit all remaining files**

```bash
git add scripts/openproject-sync/
git commit -m "feat(sync): complete OpenProject bidirectional sync system"
```
