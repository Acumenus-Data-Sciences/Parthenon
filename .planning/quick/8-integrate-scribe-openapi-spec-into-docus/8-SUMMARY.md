---
phase: quick-8
plan: 01
subsystem: documentation
tags: [openapi, docusaurus, api-docs, scribe]
dependency_graph:
  requires: [quick-7]
  provides: [integrated-api-docs]
  affects: [docs/site, docker/nginx, docker-compose.yml, deploy.sh]
tech_stack:
  added: [docusaurus-plugin-openapi-docs, docusaurus-theme-openapi-docs]
  patterns: [openapi-mdx-generation, webpack-polyfill-fallback, empty-label-fixup]
key_files:
  created:
    - docs/site/scripts/fix-api-docs-labels.sh
    - docs/site/.gitignore
  modified:
    - docs/site/package.json
    - docs/site/docusaurus.config.ts
    - docs/site/sidebars.ts
    - docs/site/src/css/custom.css
    - docker/nginx/default.conf.template
    - docker-compose.yml
    - deploy.sh
    - docs/site/docs/intro.mdx
    - docs/site/docs/part1-getting-started/01-introduction.mdx
    - docs/site/docs/appendices/d-api-quick-reference.mdx
decisions:
  - Webpack fallback with path/os/fs=false (postman-code-generators polyfills not needed for client-side rendering)
  - 8G memory limit for docs-build container (772 API pages consume ~5G during webpack compilation)
  - NODE_OPTIONS=--max-old-space-size=5120 for headroom during large builds
  - Empty sidebar labels fixed via sh+node script in build pipeline (255 Scribe ops lack summary field)
  - Generated API docs directory gitignored (build artifacts regenerated each deploy)
metrics:
  duration: 28min
  completed: 2026-03-27
  tasks: 3
  files: 12
---

# Quick Task 8: Integrate Scribe OpenAPI Spec into Docusaurus Summary

Docusaurus-native API reference with 772 interactive endpoint pages themed in crimson/gold/teal, replacing standalone Scribe HTML with in-site navigation and Try It Out support.

## What Was Done

### Task 1: Install OpenAPI plugin, configure Docusaurus, update navbar (90a93630c)
- Installed `docusaurus-plugin-openapi-docs` and `docusaurus-theme-openapi-docs` packages
- Configured OpenAPI plugin with environment-aware specPath (local relative path vs Docker mount)
- Added `docItemComponent: "@theme/ApiItem"` to docs preset for proper API page rendering
- Updated navbar and footer "API Reference" links from external `href` to internal `to: "/api/"` route
- Added `gen-api-docs`, `clean-api-docs` npm scripts and integrated gen into `build:docker`
- Imported auto-generated API sidebar in `sidebars.ts` with graceful fallback when not yet generated
- Created `.gitignore` for generated API docs directory (build artifacts)

### Task 2: Theme CSS, nginx, deploy pipeline (1036a596f)
- Added 100+ lines of CSS overrides for OpenAPI components matching the Parthenon dark theme:
  - Method badges, schema panels, property names in gold
  - Try It Out / Send buttons in crimson (#9B1B30)
  - Response codes: teal for success, coral for errors
  - Auth inputs, server URL selector, tabs with gold active state
- Removed Scribe static HTML serving block from nginx (`location ^~ /docs/api`)
- Updated `/api` redirect to `/docs/api/` (trailing slash for Docusaurus routing)
- Added OpenAPI spec volume mount and DOCKER_BUILD env to docs-build container
- Added OpenAPI spec regeneration step to deploy.sh before Docusaurus build

### Task 3: Build pipeline fixes and verification (713358ee9)
- Added webpack polyfill fallback plugin (path/os/fs = false) for postman-code-generators
- Created `fix-api-docs-labels.sh` script to fix 255 operations with empty sidebar labels
- Increased docs-build memory from 1G to 8G (772 API pages need ~5G during webpack)
- Set NODE_OPTIONS=--max-old-space-size=5120 for Node.js heap
- Pinned @docusaurus/theme-mermaid to exact 3.7.0 (prevented version drift causing build failures)
- Updated 3 doc files with hardcoded external API doc URLs to use internal routes
- Verified: full Docker build produces 772 HTML pages in build/api/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Empty sidebar labels from Scribe operations without summaries**
- **Found during:** Task 3
- **Issue:** 255 out of 772 OpenAPI operations lacked a `summary` field, producing empty `sidebar_label` and `label` values that caused Docusaurus validation errors
- **Fix:** Created `fix-api-docs-labels.sh` that derives labels from operation ID and HTTP method (e.g., `DELETE /api/v1/abby/conversations/id`), integrated into build pipeline
- **Files created:** docs/site/scripts/fix-api-docs-labels.sh
- **Commit:** 713358ee9

**2. [Rule 3 - Blocking] Webpack polyfill errors for postman-code-generators**
- **Found during:** Task 3
- **Issue:** postman-code-generators (Try It Out code snippet dependency) imports Node.js `path` module, which webpack 5 no longer polyfills
- **Fix:** Added inline Docusaurus plugin with `resolve.fallback` for path/os/fs
- **Files modified:** docs/site/docusaurus.config.ts
- **Commit:** 713358ee9

**3. [Rule 3 - Blocking] OOM during Docker build (SIGKILL)**
- **Found during:** Task 3
- **Issue:** Webpack client compilation for 772 API pages exceeded 2G, then 4G, then 6G memory limits
- **Fix:** Set container memory to 8G and NODE_OPTIONS to 5120MB
- **Files modified:** docker-compose.yml
- **Commit:** 713358ee9

**4. [Rule 3 - Blocking] Docusaurus version mismatch**
- **Found during:** Task 3
- **Issue:** `@docusaurus/theme-mermaid: "^3.7.0"` resolved to 3.9.2 on fresh install, conflicting with core 3.7.0
- **Fix:** Pinned to exact version `"3.7.0"`
- **Files modified:** docs/site/package.json
- **Commit:** 713358ee9

**5. [Rule 2 - Missing] Hardcoded external API doc URLs in documentation content**
- **Found during:** Task 3
- **Issue:** 3 doc files still linked to `https://parthenon.acumenus.net/docs/api` instead of the internal Docusaurus route
- **Fix:** Updated all to `/api/` internal route
- **Files modified:** docs/site/docs/intro.mdx, docs/site/docs/part1-getting-started/01-introduction.mdx, docs/site/docs/appendices/d-api-quick-reference.mdx
- **Commit:** 713358ee9

**6. [Rule 1 - Bug] node_modules owned by root from previous Docker operations**
- **Found during:** Task 1
- **Issue:** Previous Docker builds left node_modules with root ownership, blocking host npm install
- **Fix:** Ran npm install via Docker container (which runs as root in Alpine) instead of host
- **No commit needed** (runtime fix only)

## Verification Results

- 772 API HTML pages generated in `docs/site/build/api/`
- Navbar "API Reference" uses internal `/docs/api/` route (no external URL)
- Footer "API Reference" uses internal `/docs/api/` route
- nginx Scribe block removed; Docusaurus `/docs/` location handles API routes
- Docker build completes successfully (gen + fix + build pipeline)
- CSS overrides target OpenAPI plugin class names for crimson/gold/teal theme

## Self-Check: PASSED
