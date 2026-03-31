# Parthenon GitHub Project V2

This repository includes a checked-in Project V2 seed for the roadmap in [ROADMAP.md](/home/smudoshi/Github/Parthenon/ROADMAP.md).

## Files

- Spec: [scripts/github_project/parthenon_roadmap_project.json](/home/smudoshi/Github/Parthenon/scripts/github_project/parthenon_roadmap_project.json)
- Creator script: [scripts/create_github_project.py](/home/smudoshi/Github/Parthenon/scripts/create_github_project.py)
- Enhancement script: [scripts/enhance_github_project.py](/home/smudoshi/Github/Parthenon/scripts/enhance_github_project.py)

## What It Creates

- Project title, description, visibility, and README
- Repository link to `sudoshi/Parthenon`
- Custom fields:
  - `Release`
  - `Category`
  - `Priority`
  - `Area`
  - `Target Date`
- Draft items for each roadmap release and each major subsection
- Kanban-ready workflow using the built-in `Status` field

## Required GitHub CLI Auth

GitHub Projects require extra OAuth scopes beyond normal repo access:

```bash
gh auth refresh -s read:project -s project
```

## Create The Project

From the repo root:

```bash
python3 scripts/create_github_project.py --open-web
```

## Apply The Enhancement Pass

This upgrades the board from a roadmap mirror into a working delivery board:

- adds `Workflow`, `Risk`, and `Work Type`
- creates release milestones
- creates executable GitHub issues for non-release roadmap items
- adds those issues to the project
- removes the matching draft cards once the issue-backed cards exist

```bash
python3 scripts/enhance_github_project.py
```

## Notes

- The script exits early if the `gh` token is missing project scopes.
- New GitHub Projects rely on the built-in `Status` field for Kanban grouping.
- If you want extra views after creation, add them in the GitHub web UI.
- The enhancement pass uses GitHub GraphQL heavily and may need to be rerun after the hourly rate limit resets.
