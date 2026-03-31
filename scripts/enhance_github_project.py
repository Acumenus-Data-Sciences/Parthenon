#!/usr/bin/env python3

import json
import subprocess
import sys
from dataclasses import dataclass


OWNER = "sudoshi"
REPO = "sudoshi/Parthenon"
PROJECT_NUMBER = 3
PROJECT_TITLE = "Parthenon Roadmap"


@dataclass
class MilestoneSpec:
    title: str
    due_on: str
    description: str


MILESTONES = [
    MilestoneSpec("v1.0.4", "2026-04-06T23:59:59Z", "Test coverage and CI hardening release."),
    MilestoneSpec("v1.0.5", "2026-04-13T23:59:59Z", "Data quality and validation release."),
    MilestoneSpec("v1.0.6", "2026-04-20T23:59:59Z", "Performance optimization release."),
    MilestoneSpec("v1.0.7", "2026-04-27T23:59:59Z", "UX polish and accessibility release."),
    MilestoneSpec("v1.0.8", "2026-05-01T23:59:59Z", "Documentation and onboarding release."),
    MilestoneSpec("v1.0.9", "2026-05-04T23:59:59Z", "Security audit and hardening release."),
    MilestoneSpec("v1.0.10", "2026-05-11T23:59:59Z", "Release candidate and final stabilization sweep."),
]


def run(cmd, *, capture_output=True, timeout=60):
    try:
        proc = subprocess.run(
            cmd,
            text=True,
            capture_output=capture_output,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Timed out after {timeout}s: {' '.join(cmd)}") from exc

    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or f"Command failed: {' '.join(cmd)}")
    return proc


def gh(*args, timeout=60):
    return run(["gh", *args], timeout=timeout).stdout


def gh_json(*args, timeout=60):
    return json.loads(gh(*args, timeout=timeout))


def normalize(name):
    return "".join(ch.lower() for ch in name if ch.isalnum())


def field_option_id(field, name):
    target = normalize(name)
    for option in field.get("options", []):
        if normalize(option["name"]) == target:
            return option["id"]
    raise KeyError(f"Option {name!r} not found in field {field['name']!r}")


def get_project():
    projects = gh_json("project", "list", "--owner", OWNER, "--format", "json")["projects"]
    for project in projects:
        if project["number"] == PROJECT_NUMBER or project["title"] == PROJECT_TITLE:
            return gh_json("project", "view", str(project["number"]), "--owner", OWNER, "--format", "json")
    raise RuntimeError(f"Project {PROJECT_TITLE!r} not found")


def get_fields():
    data = gh_json("project", "field-list", str(PROJECT_NUMBER), "--owner", OWNER, "--format", "json")
    return {field["name"]: field for field in data["fields"]}


def ensure_single_select_field(name, options):
    fields = get_fields()
    if name in fields:
        return fields[name]
    gh(
        "project",
        "field-create",
        str(PROJECT_NUMBER),
        "--owner",
        OWNER,
        "--name",
        name,
        "--data-type",
        "SINGLE_SELECT",
        "--single-select-options",
        ",".join(options),
    )
    return get_fields()[name]


def get_items():
    data = gh_json("project", "item-list", str(PROJECT_NUMBER), "--owner", OWNER, "--limit", "200", "--format", "json")
    items = data["items"]
    by_title = {}
    for item in items:
        title = item.get("title") or item.get("content", {}).get("title")
        by_title.setdefault(title, []).append(item)
    return items, by_title


def item_field(item, field_name):
    target = normalize(field_name)
    for key, value in item.items():
        if normalize(key) == target:
            return value
    return None


def infer_work_type(item):
    title = item["title"].lower()
    category = item.get("category", "")
    if category == "Release":
        return "Planning" if item.get("release") == "v1.1+" else "Release"
    if any(token in title for token in ["test", "coverage", "e2e", "ci/cd"]):
        return "Testing"
    if any(token in title for token in ["audit", "validation", "security", "compliance"]):
        return "Audit"
    if category in {"Docs", "Help"} or any(token in title for token in ["documentation", "manual", "onboarding", "help"]):
        return "Docs"
    return "Implementation"


def infer_risk(item):
    category = item.get("category", "")
    title = item["title"].lower()
    if item["title"] == "v1.0.3 Foundation release baseline":
        return "Low"
    if category in {"Security", "Compliance", "Data", "Database", "Ingestion"}:
        return "High"
    if any(token in title for token in ["security", "auth", "database", "validation", "performance", "accessibility", "ci/cd"]):
        return "High"
    if category in {"Docs", "Help", "Responsive"}:
        return "Medium"
    if category == "Release":
        return "Medium"
    return "Medium"


def infer_workflow(item):
    status = item.get("status", "Todo")
    if status == "Done":
        return "Done"
    if status == "In Progress":
        return "In Progress"
    return "Todo"


def set_single_select(item_id, project_id, field, value):
    gh(
        "project",
        "item-edit",
        "--id",
        item_id,
        "--project-id",
        project_id,
        "--field-id",
        field["id"],
        "--single-select-option-id",
        field_option_id(field, value),
    )


def ensure_milestones():
    existing = {
        milestone["title"]: milestone
        for milestone in gh_json("api", f"repos/{REPO}/milestones?state=all&per_page=100", timeout=60)
    }
    for milestone in MILESTONES:
        if milestone.title in existing:
            continue
        gh(
            "api",
            f"repos/{REPO}/milestones",
            "--method",
            "POST",
            "-f",
            f"title={milestone.title}",
            "-f",
            f"description={milestone.description}",
            "-f",
            f"due_on={milestone.due_on}",
        )


def issue_labels(work_type, risk):
    labels = []
    if work_type == "Docs":
        labels.append("documentation")
    elif work_type in {"Audit", "Testing"}:
        labels.append("maintenance")
    else:
        labels.append("enhancement")
    labels.append(risk.lower())
    return labels


def existing_issues():
    data = gh_json("issue", "list", "--repo", REPO, "--limit", "200", "--state", "all", "--json", "number,title,url,state")
    return {issue["title"]: issue for issue in data}


def create_issue_from_item(item, work_type, risk):
    body = item["content"]["body"].strip()
    issue_body = (
        "Roadmap execution issue derived from `ROADMAP.md`.\n\n"
        f"Release: `{item['release']}`\n"
        f"Category: `{item['category']}`\n"
        f"Area: `{item['area']}`\n"
        f"Priority: `{item['priority']}`\n"
        f"Risk: `{risk}`\n"
        f"Work Type: `{work_type}`\n"
        f"Target Date: `{item['target Date']}`\n\n"
        f"{body}\n\n"
        "## Done Criteria\n"
        "- Implementation, audit, or validation work is completed for this scope.\n"
        "- Evidence is captured with code, tests, or review notes as appropriate.\n"
        "- Documentation is updated when the work changes user or developer behavior.\n"
    )
    labels = issue_labels(work_type, risk)
    cmd = [
        "gh",
        "issue",
        "create",
        "--repo",
        REPO,
        "--title",
        item["title"],
        "--body",
        issue_body,
    ]
    release = item.get("release")
    if release in {m.title for m in MILESTONES}:
        cmd.extend(["--milestone", release])
    for label in labels:
        cmd.extend(["--label", label])
    output = run(cmd, timeout=120).stdout.strip().splitlines()
    return output[-1]


def add_issue_to_project(issue_url):
    data = gh_json("project", "item-add", str(PROJECT_NUMBER), "--owner", OWNER, "--url", issue_url, "--format", "json", timeout=120)
    return data["id"]


def delete_item(item_id):
    gh("project", "item-delete", str(PROJECT_NUMBER), "--owner", OWNER, "--id", item_id, timeout=120)


def main():
    project = get_project()
    project_id = project["id"]

    workflow_field = ensure_single_select_field("Workflow", ["Todo", "In Progress", "Blocked", "In Review", "Validated", "Done"])
    risk_field = ensure_single_select_field("Risk", ["High", "Medium", "Low"])
    work_type_field = ensure_single_select_field("Work Type", ["Release", "Implementation", "Testing", "Audit", "Docs", "Planning"])
    base_fields = get_fields()

    ensure_milestones()
    issues_by_title = existing_issues()

    items, by_title = get_items()
    for item in items:
        workflow = infer_workflow(item)
        risk = infer_risk(item)
        work_type = infer_work_type(item)

        if item_field(item, "Workflow") != workflow:
            set_single_select(item["id"], project_id, workflow_field, workflow)
        if item_field(item, "Risk") != risk:
            set_single_select(item["id"], project_id, risk_field, risk)
        if item_field(item, "Work Type") != work_type:
            set_single_select(item["id"], project_id, work_type_field, work_type)

    items, by_title = get_items()
    draft_work_items = [item for item in items if item.get("category") != "Release" and item.get("content", {}).get("type") == "DraftIssue"]
    for item in draft_work_items:
        if item.get("category") == "Release":
            continue

        title = item["title"]
        workflow = infer_workflow(item)
        risk = infer_risk(item)
        work_type = infer_work_type(item)

        issue = issues_by_title.get(title)
        if issue is None:
            issue_url = create_issue_from_item(item, work_type, risk)
            issue_data = gh_json("issue", "view", issue_url, "--repo", REPO, "--json", "title,url,number,state")
            issue = issue_data
            issues_by_title[title] = issue
        else:
            issue_url = issue["url"]

        existing_project_issue = None
        for candidate in by_title.get(title, []):
            content_type = candidate.get("content", {}).get("type")
            if content_type and content_type != "DraftIssue":
                existing_project_issue = candidate
                break

        issue_item_id = existing_project_issue["id"] if existing_project_issue else add_issue_to_project(issue_url)
        issue_item = existing_project_issue or {}
        if item_field(issue_item, "Status") != item["status"]:
            set_single_select(issue_item_id, project_id, base_fields["Status"], item["status"])
        if item_field(issue_item, "Release") != item["release"]:
            set_single_select(issue_item_id, project_id, base_fields["Release"], item["release"])
        if item_field(issue_item, "Category") != item["category"]:
            set_single_select(issue_item_id, project_id, base_fields["Category"], item["category"])
        if item_field(issue_item, "Priority") != item["priority"]:
            set_single_select(issue_item_id, project_id, base_fields["Priority"], item["priority"])
        if item_field(issue_item, "Area") != item["area"]:
            gh(
                "project",
                "item-edit",
                "--id",
                issue_item_id,
                "--project-id",
                project_id,
                "--field-id",
                base_fields["Area"]["id"],
                "--text",
                item["area"],
            )
        if item_field(issue_item, "Target Date") != item["target Date"]:
            gh(
                "project",
                "item-edit",
                "--id",
                issue_item_id,
                "--project-id",
                project_id,
                "--field-id",
                base_fields["Target Date"]["id"],
                "--date",
                item["target Date"],
            )
        if item_field(issue_item, "Workflow") != workflow:
            set_single_select(issue_item_id, project_id, workflow_field, workflow)
        if item_field(issue_item, "Risk") != risk:
            set_single_select(issue_item_id, project_id, risk_field, risk)
        if item_field(issue_item, "Work Type") != work_type:
            set_single_select(issue_item_id, project_id, work_type_field, work_type)

        delete_item(item["id"])

    final_items = gh_json("project", "item-list", str(PROJECT_NUMBER), "--owner", OWNER, "--limit", "200", "--format", "json")["items"]
    print(f"Project #{PROJECT_NUMBER} now has {len(final_items)} items.")
    print("Enhancement pass complete.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
