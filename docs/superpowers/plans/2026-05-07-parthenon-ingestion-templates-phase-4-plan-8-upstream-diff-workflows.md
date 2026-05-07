# Parthenon Ingestion Templates — Phase 4, Plan 8: Quarterly upstream-diff workflows (ARTEMIS + NAACCR)

> **For agentic workers:** Use `superpowers:executing-plans`. Steps use checkbox tracking.

**Goal:** Self-maintaining templates. Quarterly cron-driven workflows that re-run the ARTEMIS (HemOnc) and NAACCR (OHDSI Oncology) extractors, diff against the committed pin, and auto-PR with the diff in the body. Human merge required.

**Architecture:**

- **Cadence (Q10):** `0 4 1 */3 *` — 1st of every 3rd month at 04:00 UTC. Quarterly is loud enough to catch real upstream changes, quiet enough to avoid noise.
- **ARTEMIS workflow:** extends existing `.github/workflows/artemis-pattern-update.yml` (currently weekly). Adds quarterly cron trigger AND replaces the weekly cron with quarterly.
- **NAACCR workflow:** new at `.github/workflows/naaccr-pin-update.yml`. Re-runs the OHDSI Oncology subgroup ETL extractor, diffs against `templates/runtime/registry/naaccr/ohdsi_pin.txt`, opens PR if pin changed.
- **PR shape:** title = `chore({artemis|naaccr}): pin update YYYY-MM-DD`, body = full diff between old and new extractor output. Human reviewer reads the diff before merge.

**Tech Stack:** GitHub Actions, the existing extractor scripts.

**Depends on:** Phase 3 closed.

**Unblocks:** Self-maintaining templates with quarterly verified upstream sync.

---

## Conventions

- Branch: `feature/phase-4-plan-8-upstream-diff-workflows`.
- Workflow file naming: `<source>-pin-update.yml` for new ones; existing artemis workflow renames intent.

---

## Task index (5 tasks)

1. **ARTEMIS cadence shift** — edit `.github/workflows/artemis-pattern-update.yml`: change cron from `0 4 * * 1` (Mondays) to `0 4 1 */3 *` (quarterly). Update job summary text.
2. **NAACCR pin file scaffold** — `templates/runtime/registry/naaccr/ohdsi_pin.txt` already exists per Plan 4A — verify path, content, format.
3. **NAACCR workflow** — `.github/workflows/naaccr-pin-update.yml`: cron `0 4 1 */3 *` + workflow_dispatch. Runs the existing NAACCR extractor, captures output, diffs against the committed `*.json` artifact, opens PR if changed (title `chore(naaccr): pin update YYYY-MM-DD`, body = diff).
4. **Auto-PR helper** — both workflows share a common Python helper `scripts/ci/open_pin_update_pr.py` that creates the branch, commits, and opens the PR via `gh pr create`. DRYs up workflow YAML.
5. **Devlog** — `docs/devlog/process/2026-XX-XX-quarterly-upstream-diff-workflows.md` documents cadence, what humans need to look at when a PR opens, and the failure mode when the upstream extractor itself breaks.

---

## Done

After Task 5: both workflows live, devlog documents the process. The next quarterly cron fire produces a real PR (or noop if upstreams haven't moved).
