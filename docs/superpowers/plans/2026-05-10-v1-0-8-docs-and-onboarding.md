# v1.0.8 Plan AI-1 — Documentation & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.0.8 with the documentation set required for an OHDSI researcher to install, learn, and contribute to Parthenon without 1-on-1 help. Closes the long-standing gap that blocks v2.1 CE one-click — a one-liner installer is only useful if the first-run experience is documented end to end.

**Architecture:** Three artifact streams. (A) **User manual** — complete all 14 parts of the existing Docusaurus site at `docs/site/` with screenshots, walkthroughs, and clinical examples; add a 5-minute Eunomia quickstart; add Abby AI prompt library; add 10 video-friendly workflow tutorials. (B) **Developer docs** — auto-generated API reference from OpenAPI, architecture guide, contributing guide, Artisan command reference. (C) **In-app help** — expand contextual help module, improve SetupWizard, add react-joyride guided tours for the three highest-impact flows.

**Tech Stack:** Docusaurus v3 (`docs/site/`), Redocly or @redocly/cli for OpenAPI rendering, react-joyride v2.x (already in `frontend/package.json`), MDX for in-context examples, Asciinema for terminal recordings, browser-shot helper for screenshots.

**Parent umbrella:** [2026-05-10-v2-5-roadmap-umbrella.md](2026-05-10-v2-5-roadmap-umbrella.md), workstream **AI-1**.

**Predecessor:** v1.0.7 shipped (current). No code dependency.

**Successors:** Gates v2.1 CE One-Click (plan 06). Inputs feed plan 05-06 OpenAPI/SDK strategy.

**Existing surface:**
- `docs/site/docs/intro.mdx` plus 14 numbered parts under `docs/site/docs/partN-<topic>/` directories (verified via filesystem inventory at plan authoring time).
- `docs/site/openapi.yaml` exists; current rendering quality unverified.
- `docs/site/blog/`, `docs/site/static/`, `docs/site/i18n/` available.
- `frontend/src/features/auth/components/SetupWizard.tsx` is the existing onboarding entry point per `.claude/rules/auth-system.md`.
- react-joyride already a dependency; needs `--legacy-peer-deps` per project memory.

---

## Documentation Audit Outline (informs Task 1)

This plan does **not** assume every part of the user manual is currently empty. Task 1 produces a gap audit; subsequent tasks fill only the gaps that audit identifies.

The 14 parts (per `docs/site/docs/part*` directory structure):

| Part | Topic |
|---|---|
| 1 | Introduction & Getting Started |
| 2 | Installation & Environment |
| 3 | Authentication & RBAC |
| 4 | Vocabulary & Concept Sets |
| 5 | Cohort Definitions & Concept Builder |
| 6 | Data Explorer (Achilles + DQD) |
| 7 | Patient Profiles & Care Gaps |
| 8 | Analyses (Characterization, Estimation, Prediction, SCCS, Pathways) |
| 9 | Studies & Multi-Site |
| 10 | Imaging (OHIF + Orthanc) |
| 11 | HEOR & Claims |
| 12 | Genomics & Radiogenomics |
| 13 | GIS Explorer |
| 14 | Morpheus (MIMIC-IV Workbench) |

(Part numbers and topics confirmed at authoring time; final part list is whatever the gap audit in Task 1 finds.)

---

## File Structure

**New files (target counts; Task 1 audit finalizes):**

```
docs/site/docs/part1-intro/00-quickstart-5-min.mdx           # Quickstart
docs/site/docs/abby/                                          # Abby AI section (new top-level)
  ├── 01-what-is-abby.mdx
  ├── 02-prompt-library.mdx
  ├── 03-cohort-from-natural-language.mdx
  ├── 04-data-interrogation.mdx
  └── 05-troubleshooting.mdx
docs/site/docs/workflows/                                     # Top-10 workflow tutorials
  ├── 01-first-cohort.mdx
  ├── 02-vocabulary-exploration.mdx
  ├── 03-running-characterization.mdx
  ├── 04-cohort-comparison-estimation.mdx
  ├── 05-cohort-incidence-rates.mdx
  ├── 06-care-gap-analysis.mdx
  ├── 07-imaging-cohort.mdx
  ├── 08-spatial-cohort-gis.mdx
  ├── 09-finngen-genomics.mdx
  └── 10-publishing-results.mdx
docs/site/docs/api/                                           # OpenAPI-rendered reference
  ├── _redocly.yaml
  └── index.mdx                                               # Embeds Redoc render of openapi.yaml
docs/site/docs/dev/                                           # Developer documentation
  ├── 01-architecture.mdx
  ├── 02-local-development.mdx
  ├── 03-testing.mdx
  ├── 04-contributing.mdx
  ├── 05-artisan-commands.mdx
  └── 06-extension-points.mdx                                 # Links to docs/architecture/extension-points.md
docs/site/static/screenshots/                                 # Numbered screenshot library
docs/site/static/asciinema/                                   # Terminal recordings
docs/site/scripts/capture-screenshots.ts                      # Playwright-driven screenshot helper
frontend/src/features/onboarding/                             # New feature module for first-run experience
  ├── components/
  │   ├── GuidedTourCohortBuilder.tsx
  │   ├── GuidedTourVocabularyExplorer.tsx
  │   └── GuidedTourAnalysisSetup.tsx
  ├── hooks/useGuidedTour.ts
  └── stores/onboardingStore.ts
frontend/src/components/help/                                  # Contextual help panel expansion
  └── ContextualHelpPanel.tsx                                 # Modified or new
```

**Modified files:**

```
docs/site/sidebars.ts                                         # New sections registered
docs/site/docusaurus.config.ts                                # OpenAPI plugin config
docs/site/docs/part*/*.mdx                                    # Filled-in walkthrough sections per gap audit
frontend/src/features/auth/components/SetupWizard.tsx         # Improved onboarding flow
frontend/src/components/layout/MainLayout.tsx                 # First-run tour trigger
frontend/package.json                                          # Confirms @redocly/cli + react-joyride present
backend/openapi.yaml (or wherever the canonical spec lives)   # Field examples reviewed
```

---

## Task 1: Documentation gap audit

**Files:**
- Create: `docs/site/AUDIT-2026-05.md`
- Test: `tests/docs/test_audit_exists.bats`

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_audit_exists.bats
#!/usr/bin/env bats

@test "audit document exists" {
  [ -f "docs/site/AUDIT-2026-05.md" ]
}

@test "audit covers all 14 manual parts" {
  for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14; do
    run grep -q "Part $n " docs/site/AUDIT-2026-05.md
    [ "$status" -eq 0 ] || echo "missing Part $n"
  done
}

@test "audit identifies thin pages" {
  run grep -q "Thin pages" docs/site/AUDIT-2026-05.md
  [ "$status" -eq 0 ]
}

@test "audit identifies missing-screenshot pages" {
  run grep -q "Missing screenshots" docs/site/AUDIT-2026-05.md
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/docs/test_audit_exists.bats`
Expected: FAIL — audit not found.

- [ ] **Step 3: Run the audit and write the document**

For every `.mdx` under `docs/site/docs/part*/`:

```bash
# Get file size; flag <2KB as "thin"
find docs/site/docs/part*/ -name '*.mdx' -exec wc -c {} \; | awk '$1 < 2048 { print $2 }'

# Grep for image references; flag pages with zero <img> or ![] markdown image
find docs/site/docs/part*/ -name '*.mdx' -exec grep -L '!\[\|<img' {} \;

# Grep for code blocks; flag pages with zero ```
find docs/site/docs/part*/ -name '*.mdx' -exec grep -L '```' {} \;
```

Capture the results in `docs/site/AUDIT-2026-05.md`:

```markdown
# Parthenon Documentation Audit — 2026-05

Generated YYYY-MM-DD against commit <sha>.

## Part 1 — Introduction & Getting Started

| Page | Size | Screenshots | Code samples | Status |
|---|---|---|---|---|
| 01-overview.mdx | 4.1 KB | 2 | 3 | Complete |
| 02-architecture.mdx | 1.2 KB | 0 | 0 | **Thin** |
| ... |

[Repeat for parts 2–14]

## Thin pages (file size < 2 KB)
- [list]

## Missing screenshots (no images referenced)
- [list]

## Missing code samples (no fenced code blocks)
- [list]

## Tasks generated from this audit
- Fill thin pages: <N> entries
- Add screenshots to: <N> pages
- Add code samples to: <N> pages
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/docs/test_audit_exists.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/site/AUDIT-2026-05.md tests/docs/test_audit_exists.bats
git commit -m "docs(audit): inventory thin/incomplete user manual pages"
```

---

## Task 2: 5-minute Eunomia quickstart

**Files:**
- Create: `docs/site/docs/part1-intro/00-quickstart-5-min.mdx`
- Modify: `docs/site/sidebars.ts`

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_quickstart.bats
#!/usr/bin/env bats

@test "quickstart page exists" {
  [ -f "docs/site/docs/part1-intro/00-quickstart-5-min.mdx" ]
}

@test "quickstart references Eunomia" {
  run grep -qi "eunomia" docs/site/docs/part1-intro/00-quickstart-5-min.mdx
  [ "$status" -eq 0 ]
}

@test "quickstart includes install command" {
  run grep -q "install.py" docs/site/docs/part1-intro/00-quickstart-5-min.mdx
  [ "$status" -eq 0 ]
}

@test "quickstart documents the admin@acumenus.net seed flow" {
  run grep -q "admin@acumenus.net" docs/site/docs/part1-intro/00-quickstart-5-min.mdx
  [ "$status" -eq 0 ]
}

@test "sidebars.ts registers the quickstart" {
  run grep -q "00-quickstart-5-min" docs/site/sidebars.ts
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/docs/test_quickstart.bats`
Expected: FAIL.

- [ ] **Step 3: Write the quickstart**

Content covers (in this order, with screenshots inline):

1. Prereqs: Docker + Docker Compose + git + 16 GB RAM.
2. `git clone` and `cd Parthenon`.
3. `python3 install.py --community --defaults-file installer/profiles/eunomia-quickstart.json --non-interactive`.
4. Watch healthchecks; expected wall-clock 5 min on a modern laptop.
5. Login at `http://localhost:8082` with `admin@acumenus.net` + temp password from console.
6. Forced password change (per HIGHSEC).
7. Navigate to **Cohorts → New** → drop a "Diabetic + on metformin" criterion using the Eunomia source.
8. Generate the cohort; see the count.
9. Click into Characterization → see Achilles result.

Each step has either a screenshot from `static/screenshots/` or an asciinema embed. Use placeholders pointing to `static/screenshots/quickstart-<N>.png` and create those screenshots in Task 4.

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/docs/test_quickstart.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/site/docs/part1-intro/00-quickstart-5-min.mdx docs/site/sidebars.ts tests/docs/test_quickstart.bats
git commit -m "docs(quickstart): add 5-minute Eunomia walkthrough for new users"
```

---

## Task 3: Screenshot capture harness

**Files:**
- Create: `docs/site/scripts/capture-screenshots.ts`
- Create: `docs/site/scripts/screenshot-targets.json`

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_screenshot_harness.bats
#!/usr/bin/env bats

@test "capture-screenshots.ts exists and is referenced from docs README" {
  [ -f "docs/site/scripts/capture-screenshots.ts" ]
}

@test "screenshot-targets.json is valid JSON" {
  run jq -e '.targets | length > 0' docs/site/scripts/screenshot-targets.json
  [ "$status" -eq 0 ]
}

@test "harness produces a PNG when run against the dev server" {
  # Requires the dev server running at localhost:5175 — skip if not running
  if ! curl -fsS http://localhost:5175 >/dev/null 2>&1; then
    skip "Vite dev server not running"
  fi
  rm -f docs/site/static/screenshots/quickstart-01.png
  run npx tsx docs/site/scripts/capture-screenshots.ts --only quickstart-01
  [ "$status" -eq 0 ]
  [ -f "docs/site/static/screenshots/quickstart-01.png" ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/docs/test_screenshot_harness.bats`
Expected: FAIL — script not found.

- [ ] **Step 3: Implement the harness**

```typescript
// docs/site/scripts/capture-screenshots.ts
// Usage: npx tsx capture-screenshots.ts [--only <name>]
//
// Reads screenshot-targets.json, launches Playwright, logs in as the seeded
// admin, navigates each target, and saves a PNG to docs/site/static/screenshots/.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

interface Target {
  name: string;
  url: string;
  description: string;
  loginRequired: boolean;
  viewport?: { width: number; height: number };
  waitFor?: string;
}

const targets: { targets: Target[] } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'screenshot-targets.json'), 'utf8'),
);

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : undefined;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5175/login');
  await page.fill('input[name="email"]', 'admin@acumenus.net');
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|change-password/);

  for (const target of targets.targets) {
    if (only && target.name !== only) continue;
    await page.goto(`http://localhost:5175${target.url}`);
    if (target.waitFor) await page.waitForSelector(target.waitFor);
    await page.screenshot({
      path: path.join(__dirname, '..', 'static', 'screenshots', `${target.name}.png`),
      fullPage: false,
    });
    console.log(`captured ${target.name}.png`);
  }

  await browser.close();
})();
```

```json
{
  "targets": [
    {
      "name": "quickstart-01",
      "url": "/dashboard",
      "description": "Dashboard immediately after login with Eunomia loaded",
      "loginRequired": true,
      "waitFor": "[data-testid='dashboard-loaded']"
    },
    {
      "name": "quickstart-02",
      "url": "/cohorts/new",
      "description": "New cohort builder, empty state",
      "loginRequired": true,
      "waitFor": "[data-testid='cohort-builder-loaded']"
    }
  ]
}
```

(Extend the targets file across Tasks 4–10 as each walkthrough is written.)

- [ ] **Step 4: Run test to verify it passes (with dev server)**

Run: `docker compose up -d node php && bats tests/docs/test_screenshot_harness.bats`
Expected: PASS (skip path if dev server unavailable).

- [ ] **Step 5: Commit**

```bash
git add docs/site/scripts/capture-screenshots.ts docs/site/scripts/screenshot-targets.json tests/docs/test_screenshot_harness.bats
git commit -m "docs(screenshots): Playwright harness for reproducible UI screenshots"
```

---

## Task 4: Capture screenshots for all 14 parts

**Files:**
- Modify: `docs/site/scripts/screenshot-targets.json` (extend)
- Create: `docs/site/static/screenshots/*.png` (generated artifacts)

- [ ] **Step 1: Walk Task 1's audit; for each "missing screenshots" entry, add a target**

For every page in the audit's "Missing screenshots" list, add a `Target` entry to `screenshot-targets.json` with the right URL, login requirement, and wait-for selector.

- [ ] **Step 2: Run the harness against a freshly-loaded Eunomia dev environment**

```bash
docker compose up -d
docker compose exec php php artisan parthenon:load-eunomia --fresh
ADMIN_PASSWORD=<seed-password> npx tsx docs/site/scripts/capture-screenshots.ts
```

Verify every PNG lands in `docs/site/static/screenshots/`.

- [ ] **Step 3: Inline references into the relevant `.mdx` pages**

For each page in the audit's "Missing screenshots" list:

```markdown
![Cohort builder](../../../static/screenshots/<name>.png)
```

- [ ] **Step 4: Update the audit document** to reflect the closed gaps.

- [ ] **Step 5: Commit per-part**

```bash
git add docs/site/static/screenshots/ docs/site/docs/part1-intro/ docs/site/scripts/screenshot-targets.json
git commit -m "docs(screenshots): capture Part 1 visuals"
# Repeat for each part
```

---

## Task 5: Fill thin pages (per audit)

**Files:** every `.mdx` flagged "Thin" in Task 1's audit.

- [ ] **Step 1: Per page**, draft 600–1500 words covering: what the feature does, when to use it, walkthrough with screenshots (from Task 4), common pitfalls, links to deeper API docs.
- [ ] **Step 2: Build the Docusaurus site locally** (`cd docs/site && npm run build`) and check for broken links.
- [ ] **Step 3: Commit in per-part batches.**

```bash
git add docs/site/docs/part<N>-<topic>/
git commit -m "docs(part<N>): expand thin pages with walkthroughs and clinical examples"
```

(Each part-batch is one commit. Audit's "Thin pages" list tells you how many parts have thin content.)

---

## Task 6: Abby AI documentation section

**Files:**
- Create: `docs/site/docs/abby/*` (5 files per File Structure)

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_abby_section.bats
#!/usr/bin/env bats

@test "abby section has all 5 pages" {
  for f in 01-what-is-abby 02-prompt-library 03-cohort-from-natural-language 04-data-interrogation 05-troubleshooting; do
    [ -f "docs/site/docs/abby/${f}.mdx" ] || (echo "missing $f" && false)
  done
}

@test "prompt library documents at least 20 sample prompts" {
  run grep -c "^### Prompt:" docs/site/docs/abby/02-prompt-library.mdx
  [ "$status" -eq 0 ]
  [ "$output" -ge 20 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/docs/test_abby_section.bats`
Expected: FAIL.

- [ ] **Step 3: Author the five pages**

Each page draws content from existing devlogs under `docs/devlog/modules/abby-ai/` and the `parthenon_docs` ChromaDB collection (per CLAUDE.md "Query Before Working"). Cover: what Abby does, the RAG pipeline at a high level, how to enable/disable, the local Ollama/MedGemma dependency, prompt patterns that work, common failure modes (no context, hallucinated SQL, etc.), troubleshooting (`docker compose logs python-ai`).

The prompt library is the most important deliverable here — 20+ tested prompts spanning cohort definition, vocabulary lookup, results interpretation, and data interrogation.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add docs/site/docs/abby/ docs/site/sidebars.ts tests/docs/test_abby_section.bats
git commit -m "docs(abby): document Abby AI capabilities + 20-prompt library"
```

---

## Task 7: Top-10 workflow tutorials

**Files:**
- Create: `docs/site/docs/workflows/01-first-cohort.mdx` … `10-publishing-results.mdx`

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_workflows.bats
#!/usr/bin/env bats

@test "all 10 workflow tutorials exist" {
  for n in 01 02 03 04 05 06 07 08 09 10; do
    files=$(ls docs/site/docs/workflows/${n}-*.mdx 2>/dev/null | wc -l)
    [ "$files" -eq 1 ] || (echo "missing workflow $n" && false)
  done
}

@test "each tutorial has at least 3 screenshots" {
  for f in docs/site/docs/workflows/*.mdx; do
    count=$(grep -c "static/screenshots" "$f")
    [ "$count" -ge 3 ] || (echo "$f has only $count screenshots" && false)
  done
}

@test "each tutorial has an Estimated Time front-matter" {
  for f in docs/site/docs/workflows/*.mdx; do
    run grep -q "estimated_time:" "$f"
    [ "$status" -eq 0 ] || (echo "$f missing estimated_time" && false)
  done
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/docs/test_workflows.bats`
Expected: FAIL.

- [ ] **Step 3: Author 10 tutorials**

Each tutorial follows the same template:

```markdown
---
title: "Workflow N: <Title>"
description: "Step-by-step walkthrough"
estimated_time: "15 minutes"
prerequisites:
  - Logged in as a researcher role
  - Eunomia source available
---

# Workflow N: <Title>

## What you'll build

(1 paragraph)

## Prerequisites

(checklist)

## Steps

### Step 1: <action>
![](../../../static/screenshots/workflow-N-step-1.png)
<explanation>

### Step 2: ...

## Common pitfalls

## Next steps
```

Cover the 10 workflows in File Structure. Capture screenshots via Task 3's harness (extend `screenshot-targets.json`).

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit per tutorial**

```bash
git add docs/site/docs/workflows/<NN-name>.mdx docs/site/static/screenshots/workflow-NN-*.png
git commit -m "docs(workflows): tutorial NN — <name>"
```

---

## Task 8: API reference (auto-generated from OpenAPI)

**Files:**
- Create: `docs/site/docs/api/index.mdx`
- Create: `docs/site/docs/api/_redocly.yaml`
- Modify: `docs/site/docusaurus.config.ts`

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_api_reference.bats
#!/usr/bin/env bats

@test "api reference page exists" {
  [ -f "docs/site/docs/api/index.mdx" ]
}

@test "openapi.yaml has request/response examples on top-20 endpoints" {
  # Check at least 20 paths have an examples block
  run yq eval -r '.paths.[] | .[] | select(.examples != null) | .summary' docs/site/openapi.yaml
  count=$(echo "$output" | grep -c .)
  [ "$count" -ge 20 ]
}

@test "Docusaurus build succeeds with the API reference plugin" {
  cd docs/site && npm run build
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/docs/test_api_reference.bats`
Expected: FAIL.

- [ ] **Step 3: Install + configure docusaurus-plugin-redoc (or @redocly/cli)**

```bash
cd docs/site
npm install --legacy-peer-deps docusaurus-plugin-redoc redoc
```

Add to `docusaurus.config.ts`:

```typescript
plugins: [
  [
    'docusaurus-plugin-redoc',
    {
      id: 'parthenon-api',
      spec: 'openapi.yaml',
      route: '/docs/api/',
    },
  ],
],
```

- [ ] **Step 4: Backfill request/response examples** on the top-20 endpoints (identified via Solr or Achilles or Cohort routes). Update `openapi.yaml` in-place.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd docs/site && npm run build && bats ../../tests/docs/test_api_reference.bats`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/site/docs/api/ docs/site/docusaurus.config.ts docs/site/openapi.yaml docs/site/package.json docs/site/package-lock.json tests/docs/test_api_reference.bats
git commit -m "docs(api): publish Redoc-rendered API reference + backfill top-20 examples"
```

---

## Task 9: Developer documentation set

**Files:**
- Create: `docs/site/docs/dev/01-architecture.mdx`
- Create: `docs/site/docs/dev/02-local-development.mdx`
- Create: `docs/site/docs/dev/03-testing.mdx`
- Create: `docs/site/docs/dev/04-contributing.mdx`
- Create: `docs/site/docs/dev/05-artisan-commands.mdx`
- Create: `docs/site/docs/dev/06-extension-points.mdx`

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_dev_docs.bats
#!/usr/bin/env bats

@test "all 6 developer docs exist" {
  for f in 01-architecture 02-local-development 03-testing 04-contributing 05-artisan-commands 06-extension-points; do
    [ -f "docs/site/docs/dev/${f}.mdx" ] || (echo "missing $f" && false)
  done
}

@test "artisan reference documents every command in backend/app/Console/Commands" {
  cd backend
  for cmd in $(ls app/Console/Commands/*.php | xargs -n1 basename | sed 's/\.php$//'); do
    run grep -q "$cmd" ../docs/site/docs/dev/05-artisan-commands.mdx
    [ "$status" -eq 0 ] || (echo "missing $cmd" && false)
  done
}

@test "extension-points doc links to canonical source" {
  run grep -q "docs/architecture/extension-points.md" docs/site/docs/dev/06-extension-points.mdx
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/docs/test_dev_docs.bats`
Expected: FAIL.

- [ ] **Step 3: Author the six pages**

Content sources:

- **01-architecture.mdx** — adapted from existing `.claude/CLAUDE.md` "Project Structure" + the single-DB schema-isolation pattern + Docker topology diagram.
- **02-local-development.mdx** — clone, `./deploy.sh`, dev URLs, the eight Laravel connections from CLAUDE.md.
- **03-testing.mdx** — `make test`, `make lint`, individual stacks (Pest, Vitest, pytest), the v1.0.4 testing infrastructure already in place.
- **04-contributing.mdx** — branching conventions, conventional commits, pre-commit hook, CLA Assistant flow, code review.
- **05-artisan-commands.mdx** — auto-generated stub + curated descriptions for every command under `backend/app/Console/Commands/`. The test in Step 1 enforces coverage.
- **06-extension-points.mdx** — short overview + link to `docs/architecture/extension-points.md` (the canonical source). No duplication.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add docs/site/docs/dev/ tests/docs/test_dev_docs.bats
git commit -m "docs(dev): publish architecture, contributing, testing, artisan, extension-point guides"
```

---

## Task 10: In-app contextual help expansion

**Files:**
- Modify: `frontend/src/components/help/ContextualHelpPanel.tsx`
- Create: `frontend/src/components/help/help-content/` (one MDX per major feature module)
- Test: `frontend/src/components/help/ContextualHelpPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/help/ContextualHelpPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { ContextualHelpPanel } from './ContextualHelpPanel';

test('renders help content for the current route', async () => {
  render(<ContextualHelpPanel currentRoute="/cohorts/new" />);
  expect(await screen.findByText(/cohort builder/i)).toBeInTheDocument();
});

test('renders fallback when no help content for the route', () => {
  render(<ContextualHelpPanel currentRoute="/nonexistent" />);
  expect(screen.getByText(/no contextual help/i)).toBeInTheDocument();
});

test('renders link to the docs site for deeper guidance', async () => {
  render(<ContextualHelpPanel currentRoute="/cohorts/new" />);
  const link = await screen.findByRole('link', { name: /full guide/i });
  expect(link).toHaveAttribute('href', expect.stringContaining('/docs/'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/help/ContextualHelpPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// frontend/src/components/help/ContextualHelpPanel.tsx
import { useMemo } from 'react';
import { helpContent } from './help-content';

interface Props {
  currentRoute: string;
}

export function ContextualHelpPanel({ currentRoute }: Props) {
  const content = useMemo(() => {
    for (const [pattern, doc] of Object.entries(helpContent)) {
      if (currentRoute.startsWith(pattern)) return doc;
    }
    return null;
  }, [currentRoute]);

  if (!content) {
    return <p>No contextual help for this view.</p>;
  }

  return (
    <aside>
      <h2>{content.title}</h2>
      {content.summary}
      <a href={content.docsLink}>Full guide →</a>
    </aside>
  );
}
```

Create `help-content/index.ts` mapping route prefixes to short help summaries that link to the matching workflow tutorial in Task 7.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/help/
git commit -m "feat(help): contextual help panel keyed off the current route"
```

---

## Task 11: SetupWizard improvements

**Files:**
- Modify: `frontend/src/features/auth/components/SetupWizard.tsx`
- Test: `frontend/src/features/auth/components/SetupWizard.test.tsx`

**Constraint (per `.claude/rules/auth-system.md`):** Do NOT remove any existing wizard steps. Additions only. Do NOT make the change-password step dismissable. The HIGHSEC paradigm is load-bearing.

- [ ] **Step 1: Write the failing test**

```typescript
test('wizard introduces a Data Source selection step for super-admins', async () => {
  render(<SetupWizard user={{ isSuperAdmin: true, mustChangePassword: false, onboardingCompleted: false }} />);
  // existing steps still present
  expect(await screen.findByText(/password/i)).toBeInTheDocument();
  // new step is reachable
  fireEvent.click(screen.getByText(/next/i));
  expect(await screen.findByText(/data source/i)).toBeInTheDocument();
});

test('wizard offers Eunomia quick-load button', async () => {
  // ...navigate to data-source step
  expect(await screen.findByRole('button', { name: /load eunomia/i })).toBeInTheDocument();
});

test('wizard remains non-dismissable until onboarding_completed flips true', () => {
  render(<SetupWizard user={{ isSuperAdmin: true, mustChangePassword: false, onboardingCompleted: false }} />);
  // no close button present
  expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement the additions**

Add new steps after the existing change-password step:

1. **Data Source** — radio list of seeded sources (Eunomia, Acumenus, SynPUF, ...) with a one-click "Load Eunomia" button calling `php artisan parthenon:load-eunomia --fresh` via the existing admin API.
2. **Help-discovery prompt** — "Want a guided tour of the cohort builder?" button that opens the Task 12 react-joyride flow.
3. **Done** — confirmation step that flips `onboarding_completed=true`.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/auth/components/SetupWizard.tsx
git commit -m "feat(onboarding): SetupWizard data-source + tour-offer steps; preserves HIGHSEC password-change gate"
```

---

## Task 12: Guided tours for the three highest-impact flows

**Files:**
- Create: `frontend/src/features/onboarding/components/GuidedTourCohortBuilder.tsx`
- Create: `frontend/src/features/onboarding/components/GuidedTourVocabularyExplorer.tsx`
- Create: `frontend/src/features/onboarding/components/GuidedTourAnalysisSetup.tsx`
- Create: `frontend/src/features/onboarding/hooks/useGuidedTour.ts`
- Create: `frontend/src/features/onboarding/stores/onboardingStore.ts`

- [ ] **Step 1: Write the failing test**

```typescript
test('cohort builder tour walks through 6 steps', async () => {
  render(<GuidedTourCohortBuilder run={true} />);
  // react-joyride starts at step 0
  expect(await screen.findByText(/welcome to the cohort builder/i)).toBeInTheDocument();
  // ... advance through steps
});

test('tour state persists in onboardingStore', () => {
  const { result } = renderHook(() => useGuidedTour('cohort-builder'));
  act(() => result.current.markComplete());
  expect(result.current.isComplete).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement using react-joyride**

```bash
cd frontend && npm install react-joyride --legacy-peer-deps  # already present per existing peer-dep memory
```

Each tour exports a 6-to-10-step react-joyride configuration. The shared `onboardingStore.ts` Zustand store records which tours the user has completed; `useGuidedTour` reads/writes from the store. Tours are gated on `frontend/src/stores/authStore.ts` permission (researchers + admins only).

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/onboarding/
git commit -m "feat(onboarding): react-joyride guided tours for cohort builder, vocabulary explorer, analysis setup"
```

---

## Task 13: Docusaurus build, link check, and deploy

**Files:**
- Modify: `docs/site/docusaurus.config.ts` (for any final config)

- [ ] **Step 1: Write the failing test**

```bash
# tests/docs/test_site_health.bats
#!/usr/bin/env bats

@test "docusaurus build succeeds" {
  cd docs/site && npm run build
}

@test "no broken internal links in build output" {
  # Docusaurus throws on broken markdown links by default in build mode
  cd docs/site && npm run build 2>&1 | grep -v "Broken link\|broken link"
}
```

- [ ] **Step 2: Run** the build; fix any link breakages from the audit-driven cross-references.

- [ ] **Step 3: Deploy** the rebuilt docs site via the existing `./deploy.sh` flow. (Apache serves `docs/site/build/`; verify production points correctly.)

- [ ] **Step 4: Smoke test** the deployed site by hitting `https://parthenon.acumenus.net/docs/quickstart-5-min`, `/docs/api/`, `/docs/abby/01-what-is-abby/`, and at least one of the workflow tutorials.

- [ ] **Step 5: Commit**

```bash
git commit -am "ci(docs): verify clean build + deployed site smoke-tested"
```

---

## Task 14: v1.0.8 release tag + changelog

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `install/index.html`, `installer/version.py` (version stamps)

- [ ] **Step 1: Bump version stamps** to `v1.0.8`. Reference plan 05-01-followup precedent: every place that hard-codes the prior version (per project-memory `Install Webapp Tests Now Pass After Version Fix`) is updated.

- [ ] **Step 2: Update CHANGELOG.md** with v1.0.8 entries covering: Quickstart, full user manual, Abby docs, workflow tutorials, API reference, dev docs, contextual help, SetupWizard expansion, guided tours.

- [ ] **Step 3: Tag and push.**

```bash
git tag v1.0.8 -m "v1.0.8 — Documentation & Onboarding"
git push origin main --tags
```

- [ ] **Step 4: Generate the GitHub release notes** from the CHANGELOG entries.

- [ ] **Step 5: Update the umbrella plan's Status Tracking table:** `AI-1 v1.0.8 docs | Completed | YYYY-MM-DD`. Mark v2.1 release gate dependency satisfied.

---

## Definition of Done

- [ ] All 14 tasks above checked off.
- [ ] Docusaurus site builds clean with zero broken links.
- [ ] Audit document `docs/site/AUDIT-2026-05.md` shows 100% closure of identified gaps (thin pages, missing screenshots, missing code samples).
- [ ] Abby AI section live with 20+ prompt library entries.
- [ ] All 10 workflow tutorials published with screenshots.
- [ ] API reference live at `/docs/api/` with top-20 endpoints having request/response examples.
- [ ] Developer docs cover architecture, local dev, testing, contributing, every Artisan command, and extension points.
- [ ] In-app `ContextualHelpPanel` renders for every major route.
- [ ] SetupWizard offers data-source seeding + tour offer; HIGHSEC gates preserved.
- [ ] Three guided tours pass their Vitest suites.
- [ ] v1.0.8 tagged, pushed, deployed.

---

## Out of Scope (deferred)

- **Translations / i18n** — `docs/site/i18n/` exists but staffing first-class translation maintenance is a v3.0 concern.
- **Video tutorials** (actual recorded video) — "video-friendly" structure ships in v1.0.8; recorded videos are a marketing deliverable, not engineering.
- **Marketplace-specific quickstarts** (AWS / Azure / GCP) — those are part of plans 08 and 09, not AI-1.
- **CE-only quickstart vs EE quickstart split** — v1.0.8 ships a single CE-tuned quickstart. EE-specific onboarding ships with plan 07.
