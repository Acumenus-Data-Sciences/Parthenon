# Phase 9.8 — Docusaurus User Manual

**Date:** 2026-03-03
**Status:** Complete

---

## What Was Built

A full Docusaurus v3 user manual served at `/docs/` from the existing nginx container. The manual covers 26 chapters across 8 parts plus 7 appendices, documenting every major feature of the Parthenon platform.

### New Files

**`docs/site/`** — Docusaurus v3 project (TypeScript config, MDX content):
- `docusaurus.config.ts` — config with `baseUrl: /docs/`, dark-first theme, Lunr search
- `sidebars.ts` — 8 parts + appendices sidebar
- `package.json` — Docusaurus 3.7.0 + `@easyops-cn/docusaurus-search-local`
- `tsconfig.json`
- `static/img/logo.svg` — custom Parthenon logo (SVG, column/pediment design)
- `src/css/custom.css` — dark theme overrides matching Tailwind slate palette
- `docs/intro.md` — manual overview with quick links
- 26 chapter MDX files across 8 parts
- 7 appendix MDX files (shortcuts, OMOP domains, CIRCE schema, API reference, glossary, limitations, troubleshooting)

**`docker/docs/Dockerfile`** — node:22-alpine image for building Docusaurus

**`docs/dist/.gitkeep`** — ensures the output dir is tracked but contents are gitignored

### Modified Files

- **`docker/nginx/default.conf`** — added `^~ /docs/api` block (→ PHP/Scramble) + `/docs/` alias block (→ static Docusaurus build); `^~` ensures API docs take precedence
- **`docker-compose.yml`** — nginx: added `./docs/dist:/var/www/docs-dist:ro` volume; added `docs-build` service (node:22-alpine, `docs` profile)
- **`deploy.sh`** — added `--docs` flag and `DO_DOCS` step; full deploy now builds docs too
- **`.github/workflows/ci.yml`** — added `docs-build` job (parallel with backend/frontend/ai)
- **`.gitignore`** — added `docs/dist/*` (contents ignored) + `docs/site/node_modules/`

---

## Content Coverage

| Part | Chapters | Topics |
|------|----------|--------|
| I — Getting Started | 1–2 | Platform intro, roles, data sources, daimon pattern |
| II — Vocabulary | 3–4 | Concept browser, standard vs source, concept sets, flags |
| III — Cohorts | 5–8 | CIRCE expressions, builder UI, generation, attrition, management |
| IV — Analyses | 9–14 | Characterization, incidence rates, pathways, PLE (stub), PLP (stub), studies |
| V — Ingestion | 15–17 | File upload, schema mapping, concept mapping, Usagi |
| VI — Data Explorer | 18–20 | Achilles results, DQD, population stats |
| VII — Patient Profiles | 21 | Patient timelines, PHI access, filtering |
| VIII — Administration | 22–26 | Users, roles/permissions, auth providers, system config, audit log |
| Appendices | A–G | Keyboard shortcuts, OMOP domains, CIRCE JSON schema, API reference, glossary, known limitations, troubleshooting |

---

## Architecture

- **Search:** `@easyops-cn/docusaurus-search-local` (Lunr.js, hashed index, works offline, no external service)
- **Build output:** `docs/dist/` — mounted into nginx at `/var/www/docs-dist/`
- **Nginx routing:** `^~ /docs/api` takes priority over `/docs/` static block so Scramble continues working
- **Docker build:** `docker compose --profile docs run --rm docs-build` (node:22-alpine, outputs to mounted `/dist`)
- **CI:** `docs-build` job in `.github/workflows/ci.yml` runs parallel with other jobs

---

## Build Verification

Local build test: `npm run build` in `docs/site/` — **SUCCESS** (36 HTML files generated)

Known non-issue: Build warns about `/docs/api` broken links — expected, as that URL is served by Laravel/Scramble, not Docusaurus. `onBrokenLinks: "warn"` prevents build failure.

MDX fix: Escaped `<768px>` → `&lt;768px>` in `f-known-limitations.mdx` to prevent MDX JSX parser error.

---

## Gotchas

1. **MDX angle brackets:** Raw `<768px>` syntax in MDX is parsed as JSX and fails. Use HTML entities (`&lt;`) for any `<` before numbers or non-element names.

2. **`^~` nginx modifier:** The `^~` prefix modifier is critical — it tells nginx to use prefix matching and stop searching for regex matches when this location wins. Without it, `/docs/api` would fall through to the `/docs/` static alias block and 404.

3. **Docker volume vs build output path:** The `build` script uses `docusaurus build` (outputs to `build/`). The `build:docker` script uses `--out-dir /dist` (outputs to the mounted host `./docs/dist/`). This separation allows CI to use the default build without needing a mounted volume.

4. **`onBrokenLinks: "warn"` not "throw":** We can't use "throw" because `/docs/api` will always be a "broken" internal link from Docusaurus's perspective — it's served by a different process.

---

## Next Steps (Unrelated to This Phase)

- §9.9/9.11: Docusaurus docs — operator/developer guides (NOT STARTED)
- §9.12: In-app help system (NOT STARTED)
- Consider adding versioning (`versions.json`) when v1.0 ships
- Consider PDF export via `@capacitor/docusaurus-plugin-pdf` for offline distribution
