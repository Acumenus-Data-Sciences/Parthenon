You're picking up two parallel workstreams on Parthenon (the OMOP CDM unified
research platform at /home/smudoshi/Github/Parthenon, owner sudoshi). Read this
whole brief before acting. Some of it is non-obvious and a naive approach will
either redo work that's already done, or get clobbered by concurrent activity
the user is doing in the same repo.

================================================================================
1. CONTEXT YOU NEED
================================================================================

Repo: github.com/sudoshi/Parthenon (owner sudoshi, lives at
/home/smudoshi/Github/Parthenon, default branch: main).

Stack: Laravel 11 + React 19 + Python FastAPI + R Plumber + PostgreSQL 16/17 +
Solr + ChromaDB + Docker Compose. See /home/smudoshi/Github/Parthenon/CLAUDE.md
and /home/smudoshi/Github/Parthenon/.claude/CLAUDE.md for the full picture.

User: Sanjay Udoshi (founder, Acumenus Data Sciences nonprofit). User CLAUDE.md
at ~/.claude/CLAUDE.md governs his preferences (terse, technical, no preamble).
Of particular note: HIGHSEC.spec.md at .claude/rules/HIGHSEC.spec.md is a hard
spec for security operations and applies to every code change.

Concurrency caveat: the user is actively working in the same repo and has
already moved branches mid-session before. Use `git worktree` for any
multi-step task to isolate yourself. Do not assume the working tree state from
one tool call survives to the next.

================================================================================
2. WORKSTREAM A — RELICENSE TO AGPL-3.0-ONLY (NOT YET DONE)
================================================================================

## 2.1 Why this exists

The user explicitly authorized this with: "Change the repo license to AGPLv3.
We need this to attract investors." After audit, we agreed on Option A
(open-core + dual-licensing), not a unilateral flip. Reasoning:

  - AGPLv3 alone repels enterprise customers (Google bans it; many health
    orgs require legal review).
  - AGPLv3 + dual-licensing is the actual investor magnet (MongoDB, Mattermost,
    Plausible model). The company sells a commercial license to escape the
    viral terms of §13.
  - For dual-licensing to work, the company must hold copyright or have a
    CLA from contributors. Setting up CLA Assistant is part of this work.

## 2.2 Audit findings (already performed — don't redo)

Heritage contributors with 100+ commits each (Chris Knoll/OHDSI, Pavel Grafkin,
Vlad Belousov, Sigfried Gold, Anthony Sena/J&J, Frank DeFalco/OHDSI, Alex
Saltykov/Odysseus, anton-abushkevich, Vitaly Koulakov, plus ~15 smaller
contributors from Odysseus/FirstLine/J&J/NYP) only touched the legacy
OHDSI Atlas `js/` directory — which has already been deleted from the current
tree. Their 60,000+ commit touches are in git history but not in any current
file.

Files heritage authors touched that STILL EXIST in current main:
  - .gitignore        (small mechanical edits, not creative)
  - LICENSE           (the Apache 2.0 license text itself, public domain)
  - README.md         (16 commits by Sanjay, 7 historical heritage edits;
                       current prose is Sanjay's)
  - package-lock.json (root-level, 88 bytes, stale empty stub)

Conclusion: the current source tree (backend/, frontend/, ai/, templates/,
docker/, acropolis/, installer/, docs/, scripts/, etc.) is overwhelmingly
Sanjay's original work. Relicense is defensible without per-author consent
when paired with proper NOTICE attribution acknowledging the OHDSI Atlas
heritage.

## 2.3 What's already been written but LOST (you'll need to redo)

A previous attempt was made on a branch `chore/relicense-agplv3` that got
wiped when the user concurrently switched branches. The branch still exists
but contains zero relicense commits. Don't reuse it — create
`chore/relicense-agplv3-v2` in a worktree to avoid the same fate.

What was drafted (you can rewrite from the spec below; nothing to recover):

  1. LICENSE replaced with canonical AGPLv3 text from
     https://www.gnu.org/licenses/agpl-3.0.txt (cached at /tmp/agpl-3.0.txt
     if still present from this session — 661 lines)
  2. NOTICE file (new) — see template in §2.5
  3. LICENSING.md (new) — see template in §2.6
  4. backend/composer.json edits
  5. frontend/package.json edits
  6. ai/pyproject.toml edits
  7. templates/pyproject.toml edits
  8. README.md badge edit

## 2.4 Execution recipe

CRITICAL: Use a git worktree to isolate from the user's active work on
docs/phase-3-spec or wherever they are. Do not work directly in the main
checkout.

  cd /home/smudoshi/Github/Parthenon
  git fetch origin
  git worktree add /tmp/parthenon-relicense -b chore/relicense-agplv3-v2 origin/main
  cd /tmp/parthenon-relicense

Then perform the file changes below in this order:

### 2.4.1 Replace LICENSE

  curl -sf https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE
  head -3 LICENSE  # should show "GNU AFFERO GENERAL PUBLIC LICENSE / Version 3"
  wc -l LICENSE    # should be ~661

### 2.4.2 Create NOTICE (see §2.5 for template content)

### 2.4.3 Create LICENSING.md (see §2.6 for template content)

### 2.4.4 Update backend/composer.json

  # Read first (READ-BEFORE-EDIT hook enforced).
  # Change name "laravel/laravel" → "acumenus/parthenon-backend"
  # Change description from Laravel skeleton text to Parthenon description
  # Change license "MIT" → "AGPL-3.0-only"
  # Change keywords ["laravel", "framework"] →
  #   ["parthenon", "ohdsi", "omop", "cdm", "healthcare", "informatics"]

  Note: license was MIT in this file but Apache 2.0 in repo LICENSE — pre-existing
  inconsistency. The AGPL flip resolves it.

### 2.4.5 Update frontend/package.json

  # Add "license": "AGPL-3.0-only" after "version".
  # Optional: rename "name" from "frontend" → "@acumenus/parthenon-frontend".
  #   Verify nothing imports the package by its name first
  #   (`grep -r '"frontend"' frontend/src` — likely safe but check).

### 2.4.6 Update ai/pyproject.toml

  # Add after requires-python:
  #   license = { text = "AGPL-3.0-only" }
  #   authors = [{ name = "Acumenus Data Sciences" }]

### 2.4.7 Update templates/pyproject.toml

  # Change license = { text = "Apache-2.0" } → { text = "AGPL-3.0-only" }

### 2.4.8 Update README.md

  # Change badge:
  #   [![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)
  # to:
  #   [![License](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)

### 2.4.9 Delete the stale empty-stub root lockfile

  # Confirm it's empty/stale first:
  cat package-lock.json  # should be ~88 bytes, empty packages object
  rm package-lock.json

### 2.4.10 Update CONTRIBUTING.md

  # File exists. Add a section "Licensing and CLA" referencing LICENSING.md
  # and stating that contributors agree to the dual-licensing terms.

### 2.4.11 Verify build still works

  # Quick smoke test before committing (these read package metadata):
  docker compose exec -T php sh -c "cd /var/www/html && composer validate --strict --no-check-publish"
  cd frontend && npm install --legacy-peer-deps --dry-run | tail -5
  cd ../templates && python -c "import tomllib; tomllib.load(open('pyproject.toml','rb'))"
  cd ../ai && python -c "import tomllib; tomllib.load(open('pyproject.toml','rb'))"

### 2.4.12 Commit and PR

  git add -A
  git status  # verify the diff before commit
  git commit -m "chore(license): relicense from Apache-2.0 to AGPL-3.0-only

  Switches Parthenon's outbound license from Apache 2.0 to AGPL-3.0-only.
  Adds NOTICE acknowledging upstream OHDSI Atlas heritage (now-deleted js/
  tree) and OMOP/Achilles/Circe/HADES specifications. Adds LICENSING.md
  documenting current license, project IP history, contribution terms, and
  commercial licensing contact. Aligns license metadata across all package
  manifests (composer.json, pyproject.toml × 2, package.json).

  Pre-existing inconsistency resolved: backend/composer.json declared MIT
  while root LICENSE was Apache 2.0. Both now AGPL-3.0-only.

  Heritage contributor audit: 60k+ heritage author commit touches were all
  in the legacy js/ Atlas tree, which was deleted long before this change.
  Surviving heritage author touches in current tree are .gitignore, LICENSE
  text itself, README.md (overwritten), and stale root package-lock.json
  (deleted). Defensible relicense without per-author consent.

  Investor due diligence note: pair this with CLA Assistant setup on the
  GitHub repo to enforce contribution license grants going forward."

  git push -u origin chore/relicense-agplv3-v2
  gh pr create --title "chore(license): relicense to AGPL-3.0-only + add NOTICE/LICENSING.md" \
    --body "..."  # see PR description template below

  cd /home/smudoshi/Github/Parthenon
  git worktree remove /tmp/parthenon-relicense

### 2.4.13 Tell the user (do not do this yourself)

After PR is open, surface to user:
  - Set up CLA Assistant at https://cla-assistant.io for dual-licensing
    enforcement on future contributions (especially bot PRs).
  - Decide PR shape: AGPL-3.0-only vs AGPL-3.0-or-later (single PR can pick
    one; the more conservative is "only" to prevent accidental upgrade to
    AGPLv4 if FSF ever publishes one).
  - Update copyright year on next anniversary.
  - Notify any private fork users (Geisinger, Hive Networks pilots, etc.)
    of license change before merging.

## 2.5 NOTICE file template (use verbatim, adjust org details if user corrects)

[paste content of NOTICE that was drafted in this session — see the conversation]

Key sections:
  - Copyright (c) 2024-2026 Acumenus Data Sciences, Inc.
  - License declaration (AGPL-3.0-only)
  - Project history (OHDSI Atlas heritage, js/ removed)
  - Acknowledgments (OMOP CDM v5.4, Achilles, Circe, DQD, HADES — all
    Apache 2.0, not redistributed)
  - Third-party dependencies pointer (composer.lock, package-lock.json,
    requirements.txt)

## 2.6 LICENSING.md template

Key sections:
  - Current license (AGPL-3.0-only, §13 obligations, dual-licensing)
  - Why AGPLv3 (patient-data sovereignty + sustainability)
  - Project IP history (Atlas heritage, removed)
  - Contributing (CLA terms, dual-licensing grant)
  - Commercial licensing contact (licensing@acumenus.net)
  - Trademarks (Parthenon/Acumenus/Wellstack.ai are trademarks; license
    doesn't grant trademark use)

================================================================================
3. WORKSTREAM B — REMAINING PR CLEANUP (PARTIALLY DONE)
================================================================================

Earlier today the user landed a "Phase 1 templates merge cascade" of 7 stacked
PRs to main. The cascade rebased commits during merge, so origin/main's
history was effectively rewritten — old commits were replaced by rebased
equivalents. This created a problem for pre-existing PRs whose merge-base
was now on disconnected history.

## 3.1 What's already done

  - 14 dependabot PRs received `@dependabot recreate` comments (#251, #250,
    #249, #248, #247, #245, #238, #237, #236, #230, #229, #227, #225, #224).
    Verify these have refreshed before touching them — should now show
    fresh diffs against current main.
  - 2 duplicate accessibility PRs were closed: #241 (kept #242), #221 (kept #222).
  - Sentinel security cherry-picks were already done by the user (visible in
    git reflog):
      - fix/sentinel-sql-safety-bypass (commit f41f6ba21) — has the
        DataInterrogationService.php fix from #260
      - fix/sentinel-orthanc-credentials (commit 4edeafb70) — has the
        scripts/pancreatic/* fix from #223
    Status: branches exist locally; verify whether they've been pushed and
    PR'd, or if those steps still need doing. See §3.3.

## 3.2 What still needs doing — Phase 2 active PRs

Two Phase 2 implementation PRs were open as of this session:

  - #273 Phase 2 Plan 4: load_mimic_iv_omop (T-019)  +2801/-0  34 files
  - #274 Phase 2 Plan 6: sdtm_to_omop_v54 (T-016+T-020)  +1145/-2  29 files

Per the reflog, both have since been merged to main as commits 7f5f14790
(#273) and fa0348e68 (#274). Verify with `gh pr list` — they should be
closed. If somehow still open, monitor CI and report status to user; do not
merge yourself.

There's also Phase 2 Plan 3 (Llettuce eval harness) merged as #276 (aada64b46)
and Phase 2 Plan 5 (ARTEMIS chemo regimens) merged as #275 (117776e6a). Phase
2 is essentially complete in main now.

There may be a Phase 3 spec in flight (user is on docs/phase-3-spec branch,
229ba4375 commit "Phase 3 — record Q1-Q12 decisions, revise PR shape to 10
plans"). Don't touch that branch.

## 3.3 What still needs doing — push the security cherry-picks

  cd /home/smudoshi/Github/Parthenon
  git fetch origin
  git log fix/sentinel-sql-safety-bypass --oneline -3   # should show f41f6ba21
  git log fix/sentinel-orthanc-credentials --oneline -3 # should show 4edeafb70

If not pushed:
  git push -u origin fix/sentinel-sql-safety-bypass
  git push -u origin fix/sentinel-orthanc-credentials
  gh pr create --base main --head fix/sentinel-sql-safety-bypass \
    --title "fix(security): patch SQL safety bypass in DataInterrogationService" \
    --body "Cherry-picks the bot fix from #260 onto current main. The
    original PR's merge-base is on now-rewritten history (Phase 1 templates
    cascade), so a fresh-base PR is cleaner than a rebase. Closes #260.

    The DataInterrogationService.checkSqlSafety() regex allowed a bypass via
    SQL comments containing 'temp_abby'. This patch strips string literals
    and comments before the keyword check. HIGHSEC §7 — clinical data
    protection — applies."
  gh pr close 260 -c "Superseded by fresh-base PR. Original branch's merge-base is on disconnected history after the templates cascade."

  # Same flow for #223 → fix/sentinel-orthanc-credentials. PR title:
  # "fix(security): remove hardcoded Orthanc credentials from pancreatic scripts"
  # HIGHSEC §4.2 (service authentication) and §5 (secrets management) apply.

## 3.4 What still needs doing — close the bot perf/a11y PRs

For each of #261, #244, #243, #242, #240, #239, #222 (if still open after
session):

  gh pr close <N> -c "Closing — branch's merge-base is on now-rewritten main
  history (Phase 1 templates cascade rebased main). The fix is small enough
  that regenerating against current main is cheaper than rebasing 7000+
  phantom files. Re-fire on next nightly bot run if still relevant."

These are bot-generated. The bots (Sentinel/Bolt/Palette/Jules) regenerate
on a schedule. None of these are urgent enough to manually cherry-pick.

================================================================================
4. WORKSTREAM C — CLA ASSISTANT SETUP (USER ACTION, NOT YOURS)
================================================================================

Don't do this yourself — it requires GitHub OAuth and account-level access
the user has, you don't. Just tell the user:

  - Visit https://cla-assistant.io
  - Sign in with GitHub as @sudoshi
  - Add Parthenon repo
  - Use the standard CLA template, with copyright assignment to Acumenus
    Data Sciences, Inc., granting:
      (a) right to distribute under AGPL-3.0-only
      (b) right to dual-license including commercial license sales
      (c) patent grant equivalent to Apache 2.0 §3
  - Configure to apply to all PRs from non-employee contributors
  - Bot PRs (Sentinel/Bolt/Palette/Jules) need either bot-specific
    bypass (not recommended) OR the bot's GitHub identity must accept
    the CLA on the company's behalf

Without this, every dual-licensed sale post-relicense carries IP risk.

================================================================================
5. THINGS YOU SHOULD NOT DO
================================================================================

- Don't `git rebase origin/main` on stale bot PR branches. There's no clean
  shared ancestor after the templates cascade; a 10-line fix becomes hours
  of conflict work.
- Don't `gh pr merge --admin` to bypass CI. Cherry-pick to a fresh branch
  and let normal CI run.
- Don't touch docs/phase-3-spec or any branch the user is currently on.
  Use `git worktree` for parallel work.
- Don't unilaterally relicense without the NOTICE/LICENSING.md companion
  files. The relicense is only defensible with the heritage attribution.
- Don't push to main directly. PRs only.
- Don't delete the chore/relicense-agplv3 branch — it has no commits but
  the user may want to know its trail. Just create a v2 branch.
- Don't update CLAUDE.md, MEMORY, or write devlogs about license/PR work.
  This is housekeeping, not architecture.
- Don't run `npm install` without `--legacy-peer-deps` (react-joyride peer
  dep issue, repo-wide).
- Don't bypass pre-commit hooks with `--no-verify`. The hook at
  scripts/githooks/pre-commit runs Pint + PHPStan + tsc + ESLint + Vitest;
  if it fails, fix the underlying issue.
- Don't commit or push if `.env` files would go up. Pre-commit hook should
  catch this but verify.
- Don't change MAIL_MAILER from 'resend' (HIGHSEC auth-system rule).

================================================================================
6. VERIFICATION CHECKLIST
================================================================================

When you finish workstream A:
  [ ] LICENSE first 3 lines start with "GNU AFFERO GENERAL PUBLIC LICENSE"
  [ ] NOTICE exists, mentions Acumenus + OHDSI Atlas heritage + OMOP/Achilles/Circe/HADES
  [ ] LICENSING.md exists, mentions licensing@acumenus.net contact
  [ ] backend/composer.json: license is "AGPL-3.0-only"
  [ ] frontend/package.json: has "license": "AGPL-3.0-only"
  [ ] ai/pyproject.toml: has license = { text = "AGPL-3.0-only" }
  [ ] templates/pyproject.toml: license = { text = "AGPL-3.0-only" }
  [ ] README.md: badge says "License-AGPLv3-blue"
  [ ] Root package-lock.json deleted (was 88-byte stub)
  [ ] CONTRIBUTING.md references LICENSING.md
  [ ] PR opened, CI passing
  [ ] User notified about CLA Assistant setup

When you finish workstream B:
  [ ] gh pr list --state open shows: only Phase-3 work (if any) + recreated
      dependabot PRs + the new fresh-base security PRs
  [ ] #260 and #223 are closed with reference to superseding PRs
  [ ] Bot perf/a11y PRs (#261, #244, #243, #242, #240, #239, #222) all closed
      if still open

================================================================================
7. KEY FILES TO READ BEFORE STARTING
================================================================================

  /home/smudoshi/Github/Parthenon/CLAUDE.md
  /home/smudoshi/Github/Parthenon/.claude/CLAUDE.md
  /home/smudoshi/Github/Parthenon/.claude/rules/HIGHSEC.spec.md
  /home/smudoshi/Github/Parthenon/.claude/rules/auth-system.md
  /home/smudoshi/Github/Parthenon/CONTRIBUTING.md
  /home/smudoshi/Github/Parthenon/LICENSE                     (current Apache 2.0)
  /home/smudoshi/Github/Parthenon/README.md                   (current badge state)
  /home/smudoshi/Github/Parthenon/backend/composer.json
  /home/smudoshi/Github/Parthenon/frontend/package.json
  /home/smudoshi/Github/Parthenon/ai/pyproject.toml
  /home/smudoshi/Github/Parthenon/templates/pyproject.toml
  ~/.claude/CLAUDE.md                                         (user prefs)

================================================================================
8. EDGE CASES AND FAQ
================================================================================

Q: User pushes back on AGPLv3 mid-task?
A: Stop. Don't argue. The decision is theirs. If they want a different
   license, switch (MPL-2.0, BUSL, SSPL are common alternatives).

Q: Heritage author files turn out to have surviving creative content?
A: Re-audit with: `git blame README.md | grep -v 'smudoshi\|sudoshi'`. If
   non-trivial heritage prose survives, either (a) rewrite those passages,
   or (b) acknowledge in NOTICE that those specific passages remain under
   Apache 2.0 (per-file or per-region license declarations).

Q: composer/npm/pip lockfiles need regeneration?
A: composer.lock and package-lock.json don't carry our project license.
   But if you change the package name (frontend "frontend" →
   "@acumenus/parthenon-frontend"), npm install must regenerate. Use:
   `cd frontend && npm install --legacy-peer-deps`. For composer:
   `docker compose exec -T php sh -c "cd /var/www/html && composer update --lock"`.

Q: Submodule (study-agent) license?
A: It's a submodule pointing to github.com/sudoshi/StudyAgent — a separate
   repo. Its license is its own and is NOT changed by this PR. Mention in
   NOTICE for clarity but don't try to relicense it from here.

Q: Pre-commit hook fails with PHPStan error?
A: Add the issue to phpstan-baseline.neon only as a last resort. Prefer
   fixing the type. The hook at scripts/githooks/pre-commit must pass
   without --no-verify.

Q: User asks you to push to main directly?
A: Refuse. Open a PR. The HIGHSEC posture and the CI gates exist for a
   reason; the relicense PR especially needs review by the user before merge.

Q: Lockfile or generated file shows up dirty during the work?
A: graphify-out/* updates automatically (see CLAUDE.md project-level config).
   These should be in .graphifyignore or .gitignore. If they show as untracked,
   leave them — graphify watch may be rebuilding.

Q: You discover the audit was wrong and substantial heritage code DOES
   survive in current files?
A: Stop the relicense. Surface to the user. Likely path is Option B (mixed-
   license repo with per-directory LICENSE files) instead of Option A.

================================================================================
9. EXPECTED OUTCOME
================================================================================

End state when done:
  - PR #N (fresh) on main: relicense to AGPL-3.0-only with NOTICE/LICENSING.md
    + aligned license metadata across all package manifests + README badge.
  - Open PRs total: only Phase 3 work (if user is mid-flight there) + 14
    refreshed dependabot PRs (clean diffs) + 2 fresh-base security PRs from
    cherry-picks.
  - Closed PRs: all 7 stale bot perf/a11y, the 2 original Sentinel security
    PRs (superseded), the 2 duplicate accessibility PRs.
  - User has been told to set up CLA Assistant.
  - The chore/relicense-agplv3 (v1) branch is left alone (empty placeholder).

Estimated time: 30–60 minutes for the relicense PR, 15 minutes for the PR
cleanup, plus CI wait time.

If you encounter anything not covered here, surface to the user before
acting. The relicense is a one-way door for legal reasons and the user is
its sole authoritative decision-maker.