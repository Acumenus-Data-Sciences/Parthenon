---
doc_type: lineage
status: historical
date: 2026-03-05
owner: acumenus
module: ux
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# UX: Contextual Help System & Docs Integration

**Date:** 2026-03-05
**Scope:** Global help button, docs link fix, Docusaurus rebuild, Apache proxy

---

## What Was Built

### 1. Global Contextual Help Button in Sidebar
- Added a gold/yellow `?` (HelpCircle) button to `Sidebar.tsx`, visible on every page
- Button is **context-aware**: maps the current route to the appropriate help key via `getHelpKeyForPath()`
- Route-to-helpKey mapping covers all 19 sidebar routes including admin sub-pages
- Adapts to collapsed sidebar (icon only) and expanded sidebar (icon + "Help" label)
- Uses Parthenon gold color (`#C9A227`) with subtle background for high visibility

### 2. Fixed Documentation Link Routing
- **Problem:** `docs_url` values in help JSON files (e.g., `/docs/part2-vocabulary/03-vocabulary-browser`) were relative paths that React Router intercepted as SPA routes, producing `No routes matched location` console errors
- **Fix (Layer 1):** Changed `HelpSlideOver.tsx` from `<a href>` to `<button onClick={() => window.open(...)}>` to bypass React Router entirely
- **Fix (Layer 2):** Rebuilt Docusaurus site — `docs/dist/` was empty due to a prior build failure (React 19 peer dep on `@easyops-cn/docusaurus-search-local`). Build now succeeds with warnings.
- **Fix (Layer 3):** Added Apache `ProxyPass /docs/` rule in `parthenon.acumenus.net-le-ssl.conf` to forward `/docs/` to Docker nginx (which serves Docusaurus) instead of falling through to the SPA `FallbackResource /index.html`

### 3. New Help Content Files (10 new JSON files)
Created help JSON files for all pages that were previously missing coverage:

| File | Page |
|------|------|
| `dashboard.json` | Dashboard |
| `analyses.json` | Analyses |
| `genomics.json` | Genomics |
| `imaging.json` | Imaging |
| `heor.json` | HEOR |
| `jobs.json` | Jobs |
| `admin.json` | Administration |
| `admin.roles.json` | Roles & Permissions |
| `admin.auth-providers.json` | Auth Providers |
| `admin.notifications.json` | Notifications |

**Total help coverage:** 30 JSON files across all sidebar pages.

---

## Architecture Notes

### Help Key Resolution
```
URL pathname → routeHelpKeys map → exact match or longest-prefix match → help JSON key
```
Example: `/cohort-definitions/42/edit` → prefix matches `/cohort-definitions` → key `cohort-builder`

### Request Flow for Docs Links
```
Browser window.open("/docs/...")
  → Apache ProxyPass /docs/ → http://127.0.0.1:8082/docs/
    → Docker nginx alias /var/www/docs-dist/
      → Docusaurus static HTML
```

### Files Modified
- `frontend/src/components/layout/Sidebar.tsx` — help button + route mapping
- `frontend/src/features/help/components/HelpSlideOver.tsx` — window.open() fix
- `backend/resources/help/*.json` — 10 new files
- `/etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf` — ProxyPass /docs/

---

## Gotchas & Lessons

1. **Apache `FallbackResource` catches everything** — it fires for any path that doesn't match a physical file in `DocumentRoot`. `ProxyPass` rules must be defined to intercept paths *before* the fallback. Order matters.
2. **Docusaurus build succeeds despite React 19** — the `@easyops-cn/docusaurus-search-local` peer dep warning is non-fatal. Build completes with broken-link warnings for `/docs/api` and `/docs/migration/00-overview` (pages that don't exist yet).
3. **`<a target="_blank">` is NOT enough** — React Router's `<BrowserRouter>` intercepts click events on `<a>` tags with relative paths even when `target="_blank"` is set. Using `window.open()` on a `<button>` is the reliable workaround.
