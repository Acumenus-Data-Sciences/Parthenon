#!/usr/bin/env python3

import argparse
import json
import subprocess
import sys
from pathlib import Path


DEFAULT_TIMEOUT_SECONDS = 30


def run_gh(args, *, capture_output=True, check=True, timeout=DEFAULT_TIMEOUT_SECONDS):
    try:
        proc = subprocess.run(
            ["gh", *args],
            text=True,
            capture_output=capture_output,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Timed out after {timeout}s: gh {' '.join(args)}") from exc
    if check and proc.returncode != 0:
        stderr = proc.stderr.strip()
        stdout = proc.stdout.strip()
        message = stderr or stdout or f"gh {' '.join(args)} failed"
        raise RuntimeError(message)
    return proc


def ensure_project_scopes(owner):
    probe = subprocess.run(
        ["gh", "project", "list", "--owner", owner],
        text=True,
        capture_output=True,
        check=False,
    )
    if probe.returncode == 0:
        return

    stderr = probe.stderr.strip()
    if "missing required scopes" in stderr:
        raise RuntimeError(
            "GitHub CLI token is missing project scopes.\n"
            "Run: gh auth refresh -s read:project -s project\n"
            "Then rerun this script."
        )

    raise RuntimeError(stderr or probe.stdout.strip() or "Unable to verify GitHub project access")


def gh_json(args):
    return json.loads(run_gh(args).stdout)


def normalize(name):
    return "".join(ch.lower() for ch in name if ch.isalnum())


def option_id(field, target_name):
    target = normalize(target_name)
    for option in field.get("options", []):
        if normalize(option["name"]) == target:
            return option["id"]
    available = ", ".join(option["name"] for option in field.get("options", []))
    raise RuntimeError(f"Option '{target_name}' not found in field '{field['name']}'. Available: {available}")


def field_map(owner, project_number):
    fields = gh_json(["project", "field-list", str(project_number), "--owner", owner, "--format", "json"])["fields"]
    return {field["name"]: field for field in fields}


def find_project_by_title(owner, title):
    projects = gh_json(["project", "list", "--owner", owner, "--format", "json"]).get("projects", [])
    for project in projects:
        if project["title"] == title:
            return project
    return None


def create_field(owner, project_number, field_spec):
    args = [
        "project",
        "field-create",
        str(project_number),
        "--owner",
        owner,
        "--name",
        field_spec["name"],
        "--data-type",
        field_spec["data_type"],
    ]
    if field_spec["data_type"] == "SINGLE_SELECT":
        args.extend(["--single-select-options", ",".join(field_spec["options"])])
    run_gh(args)


def create_project(owner, spec, visibility):
    project = gh_json(
        [
            "project",
            "create",
            "--owner",
            owner,
            "--title",
            spec["title"],
            "--format",
            "json",
        ]
    )
    project_number = project["number"]
    run_gh(
        [
            "project",
            "edit",
            str(project_number),
            "--owner",
            owner,
            "--description",
            spec["description"],
            "--readme",
            spec["readme"],
            "--visibility",
            visibility,
        ]
    )
    run_gh(["project", "link", str(project_number), "--owner", owner, "--repo", spec["repo"]])
    return project


def set_single_select(owner, project_id, item_id, field_id, option):
    run_gh(
        [
            "project",
            "item-edit",
            "--id",
            item_id,
            "--project-id",
            project_id,
            "--field-id",
            field_id,
            "--single-select-option-id",
            option,
        ]
    )


def set_text(owner, project_id, item_id, field_id, text):
    run_gh(
        [
            "project",
            "item-edit",
            "--id",
            item_id,
            "--project-id",
            project_id,
            "--field-id",
            field_id,
            "--text",
            text,
        ]
    )


def set_date(owner, project_id, item_id, field_id, value):
    run_gh(
        [
            "project",
            "item-edit",
            "--id",
            item_id,
            "--project-id",
            project_id,
            "--field-id",
            field_id,
            "--date",
            value,
        ]
    )


def add_item(owner, project_number, item_spec):
    proc = gh_json(
        [
            "project",
            "item-create",
            str(project_number),
            "--owner",
            owner,
            "--title",
            item_spec["title"],
            "--body",
            item_spec["body"],
            "--format",
            "json",
        ]
    )
    return proc["id"]


def existing_items(owner, project_number):
    data = gh_json(["project", "item-list", str(project_number), "--owner", owner, "--format", "json"])
    items = {}
    for item in data["items"]:
        title = item.get("title") or item.get("content", {}).get("title")
        if title:
            items[title] = item
    return items


def upsert_item(owner, project_number, item_spec, known_items):
    existing = known_items.get(item_spec["title"])
    if existing:
        print(f"Updating item: {item_spec['title']}")
        return existing

    print(f"Creating item: {item_spec['title']}")
    item_id = add_item(owner, project_number, item_spec)
    known_items[item_spec["title"]] = {"id": item_id, "title": item_spec["title"]}
    return known_items[item_spec["title"]]


def main():
    parser = argparse.ArgumentParser(description="Create the Parthenon GitHub Project V2 from the roadmap spec.")
    parser.add_argument(
        "--spec",
        default=Path(__file__).with_name("github_project").joinpath("parthenon_roadmap_project.json"),
        type=Path,
        help="Path to the project specification JSON file.",
    )
    parser.add_argument("--owner", default="sudoshi", help="GitHub owner for the project.")
    parser.add_argument("--visibility", default=None, choices=["PUBLIC", "PRIVATE"], help="Project visibility override.")
    parser.add_argument("--open-web", action="store_true", help="Open the created project in the browser.")
    args = parser.parse_args()

    spec = json.loads(args.spec.read_text())
    visibility = args.visibility or spec.get("visibility", "PUBLIC")

    ensure_project_scopes(args.owner)

    project = find_project_by_title(args.owner, spec["title"])
    if project:
        project_number = project["number"]
        project = gh_json(["project", "view", str(project_number), "--owner", args.owner, "--format", "json"])
        run_gh(
            [
                "project",
                "edit",
                str(project_number),
                "--owner",
                args.owner,
                "--description",
                spec["description"],
                "--readme",
                spec["readme"],
                "--visibility",
                visibility,
            ]
        )
    else:
        project = create_project(args.owner, spec, visibility)
    project_number = project["number"]
    project_id = project["id"]

    fields_before = field_map(args.owner, project_number)
    for field_spec in spec.get("fields", []):
        if field_spec["name"] not in fields_before:
            create_field(args.owner, project_number, field_spec)

    fields = field_map(args.owner, project_number)
    required = ["Status", "Release", "Category", "Priority", "Area", "Target Date"]
    missing = [name for name in required if name not in fields]
    if missing:
        raise RuntimeError(f"Missing expected project fields after setup: {', '.join(missing)}")

    status_field = fields["Status"]
    release_field = fields["Release"]
    category_field = fields["Category"]
    priority_field = fields["Priority"]
    area_field = fields["Area"]
    date_field = fields["Target Date"]
    known_items = existing_items(args.owner, project_number)

    for item_spec in spec["items"]:
        item = upsert_item(args.owner, project_number, item_spec, known_items)
        item_id = item["id"]

        if item.get("status") != item_spec["status"]:
            set_single_select(args.owner, project_id, item_id, status_field["id"], option_id(status_field, item_spec["status"]))
        if item.get("release") != item_spec["release"]:
            set_single_select(args.owner, project_id, item_id, release_field["id"], option_id(release_field, item_spec["release"]))
        if item.get("category") != item_spec["category"]:
            set_single_select(args.owner, project_id, item_id, category_field["id"], option_id(category_field, item_spec["category"]))
        if item.get("priority") != item_spec["priority"]:
            set_single_select(args.owner, project_id, item_id, priority_field["id"], option_id(priority_field, item_spec["priority"]))
        if item.get("area") != item_spec["area"]:
            set_text(args.owner, project_id, item_id, area_field["id"], item_spec["area"])
        if item.get("target Date") != item_spec["target_date"]:
            set_date(args.owner, project_id, item_id, date_field["id"], item_spec["target_date"])

    print(f"Created project '{spec['title']}' as #{project_number} for owner '{args.owner}'.")
    print(f"Repository linked: {spec['repo']}")
    print(f"Seeded {len(spec['items'])} draft items.")

    if args.open_web:
        run_gh(["project", "view", str(project_number), "--owner", args.owner, "--web"], capture_output=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
