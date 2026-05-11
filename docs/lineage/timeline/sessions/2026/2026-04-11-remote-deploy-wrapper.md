# Remote Deploy Wrapper

**Date:** 2026-04-11
**Scope:** Deployment tooling and developer workflow

## Context

Parthenon deployment was tied to the production host because the primary deployment script, `deploy.sh`, is designed to run next to the live Docker Compose stack. That works well on the server, but it makes laptop and desktop development awkward: changes still need a safe way to reach the production vhost at `parthenon.acumenus.net` without treating a local frontend build as the shipped deployment path.

The existing server-side `deploy-ref.sh` already provides the right promotion primitive: fetch a git ref on the production host, detach to the resolved commit, and run `deploy.sh` with the requested deploy flags.

## Changes

- Added `deploy-remote.sh` as an SSH orchestration wrapper for remote deploys.
- Defaulted the wrapper to `smudoshi@parthenon.acumenus.net` and `/home/smudoshi/Github/Parthenon`.
- Kept the canonical deploy behavior on the server by running `deploy-ref.sh` and `deploy.sh` remotely.
- Passed deploy flags such as `--frontend`, `--php`, `--db`, `--docs`, and `--openapi` through to the server-side `deploy.sh`.
- Added `--push` for the common "push current branch, then deploy it" workflow.
- Added `--ref` for explicit branch, tag, or commit promotion.
- Added an explicit `--sync` mode for working-tree rsyncs when uncommitted local changes need to be deployed intentionally.
- Added `--dry-run`, SSH target/path overrides, and remote-name overrides for laptop and desktop setup differences.
- Documented the remote deploy workflow in the README.

## Safety Notes

- Ref mode is the preferred workflow because it deploys committed and pushed code.
- Uncommitted local edits are rejected by default in ref mode so operators do not accidentally deploy stale remote code.
- Sync mode is opt-in because it can make the production checkout dirty.
- Sync mode excludes common secrets and local environment files and honors `.gitignore`.
- The wrapper never runs the frontend production build locally; it leaves that to the server-side `deploy.sh --frontend` path.

## Example Commands

```bash
./deploy-remote.sh --push --frontend
./deploy-remote.sh --ref main -- --frontend
./deploy-remote.sh --sync --frontend
```

## Verification

- Ran `bash -n deploy-remote.sh`.
- Ran `./deploy-remote.sh --help`.
- Used fake `ssh` and `rsync` shims to verify generated remote commands without touching the production server.
- Ran `git diff --check` against the README update and new script.
