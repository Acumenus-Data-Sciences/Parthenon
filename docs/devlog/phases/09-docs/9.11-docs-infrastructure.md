# Phase 9.11 — Documentation Site Infrastructure

**Date:** 2026-03-03
**Status:** Complete

---

## What Was Built

§9.11 completes the documentation site infrastructure on top of the Docusaurus v3 site delivered in §9.8. The stack, nginx serving, Lunr search, `docs-build` CI job, Docker service, and `deploy.sh --docs` flag were all delivered in §9.8. This phase adds Mermaid diagrams, Algolia fallback support, PDF export CI, Playwright screenshot scaffolding, and versioning infrastructure.

### 1. Mermaid Diagram Support

**Package:** `@docusaurus/theme-mermaid@3.7.0` (pinned to match Docusaurus core)

**Config changes in `docusaurus.config.ts`:**
```typescript
markdown: { mermaid: true },
themes: ["@docusaurus/theme-mermaid", ...],
themeConfig: {
  mermaid: { theme: { light: "neutral", dark: "dark" } },
}
```

**Sample diagrams added:**

`docs/intro.md` — two diagrams:
- **Platform Architecture** (`graph LR`) — Browser → nginx → PHP/Docs/API → PostgreSQL/Redis/Horizon/AI/R
- **Research Workflow** (`flowchart LR`) — Vocabulary → Concept Sets → Cohort Builder → Generate → Analyse → Study → Export

`docs/part3-cohorts/07-generating-cohorts.mdx` — **Generation sequence diagram** (`sequenceDiagram`) showing the full async flow: browser → API → Horizon queue → CDM DB → status polling.

Any MDX file can now use fenced ` ```mermaid ``` ` blocks.

### 2. Algolia DocSearch — Optional Upgrade Config

The site uses `@easyops-cn/docusaurus-search-local` (Lunr.js) by default. When three environment variables are set, the build automatically switches to Algolia DocSearch:

```bash
ALGOLIA_APP_ID=...
ALGOLIA_API_KEY=...   # Search-only API key (public)
ALGOLIA_INDEX_NAME=parthenon   # optional, defaults to "parthenon"
```

Implementation in `docusaurus.config.ts`:
- `algoliaConfig` object conditionally populated from `process.env`
- Lunr search theme omitted from `themes[]` when `ALGOLIA_APP_ID` is set
- Algolia `algolia:` key spread into `themeConfig` when configured

No credentials are required for local development — Lunr continues to work.

To apply for Algolia DocSearch (free for OSS/academic projects): https://docsearch.algolia.com/apply/

### 3. `docs-pdf` CI Job — Headless PDF Export

New CI job that runs only on release branches (`release/**`) and version tags (`v*.*.*`):

```yaml
if: startsWith(github.ref, 'refs/heads/release/') || startsWith(github.ref, 'refs/tags/v')
```

Steps:
1. `npm ci` + `npm run build` — produces `build/` static output
2. `npx puppeteer browsers install chrome` — installs headless Chromium
3. Node.js script: serves `build/` on port 3001 via `serve-handler`, prints full docs to `parthenon-user-manual.pdf` via Puppeteer
4. Uploads `parthenon-user-manual.pdf` as a workflow artifact (90-day retention)

### 4. `docs-screenshots` CI Job — Playwright Scaffold

Commented-out job in `ci.yml` that documents the complete screenshot workflow. Enabled via `if: false` (flip to a branch condition when infrastructure is ready).

Requirements when enabled:
- `PARTHENON_URL`, `PARTHENON_EMAIL`, `PARTHENON_PASSWORD` secrets
- A running Parthenon instance seeded with Eunomia synthetic data
- `docs/screenshots/` directory with Playwright test files

Local usage documented in the comment block.

### 5. Versioning Infrastructure

- `docs/site/versions.json` — empty array `[]`, ready to receive version entries when `npm run version 1.0.0` is run at first release
- `npm run version` script added to `package.json` (alias for `docusaurus docs:version`)
- `docusaurus.config.ts` has the `lastVersion:` line commented out, ready to enable when the first snapshot is cut

**Workflow to snapshot a release:**
```bash
cd docs/site
npm run version 1.0.0
# Creates versioned_docs/version-1.0.0/ snapshot
# Adds "1.0.0" to versions.json
# Navbar version dropdown appears automatically
```

### 6. Config Cleanup

- GitHub URL corrected from `your-org/parthenon` to `sudoshi/Parthenon` in navbar GitHub link and `editUrl`
- Footer "Migration Guide" link added: `to: "/migration/00-overview"`

---

## Build Verification

```bash
cd docs/site && npm run build
# → [SUCCESS] Generated static files in "build".
# With: 23 groups Mermaid-enabled, 50 pages (intro + 26 chapters + 7 appendices + 7 migration + 7 appendix pages + intro)
```

---

## Architecture Notes

- `@docusaurus/theme-mermaid` must be pinned to the **exact same semver range** as `@docusaurus/core`. Mismatched versions (e.g., `^3.9.2` with core `3.7.0`) cause an "Invalid name=docusaurus-theme-mermaid version number=..." fatal build error.
- The Algolia/Lunr conditional uses `process.env` at build time — correct for static site generation (Docusaurus is Node.js at build time). This means the same repo can target Lunr in dev CI and Algolia in production CI by simply setting env vars.
- `docs-pdf` uses `serve-handler` (ships with `npm serve`) to avoid needing a separate web server. The Puppeteer script is inline in the CI YAML as a Node.js one-liner for simplicity.
