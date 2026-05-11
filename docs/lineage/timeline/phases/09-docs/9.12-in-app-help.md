# Phase 9.12 — In-App Help System

**Date:** 2026-03-03
**Status:** Complete

---

## What Was Built

§9.12 delivers a contextual in-app help system: every major feature page has a `?` button that opens a slide-over panel with feature description, numbered tips, and links to the full manual. A **What's New** modal auto-shows after upgrades using `localStorage` version tracking.

---

## Architecture

### Backend

**`HelpController`** (`app/Http/Controllers/Api/V1/HelpController.php`)
- `GET /api/v1/help/{key}` — reads `resources/help/{key}.json`, returns content; validates key with regex `/^[a-z0-9\-\.]+$/` to prevent path traversal
- `GET /api/v1/changelog` — reads `resources/changelog.md`, parses Keep-a-Changelog format into structured JSON entries (version, date, sections map)

**Help JSON files** (`backend/resources/help/*.json`) — 20 files covering every major feature:

| Key | Feature |
|-----|---------|
| `cohort-builder` | Cohort Builder |
| `cohort-builder.primary-criteria` | Primary Criteria |
| `cohort-builder.inclusion-rules` | Inclusion Rules |
| `cohort-builder.cohort-exit` | Cohort Exit |
| `concept-set-builder` | Concept Set Builder |
| `vocabulary-search` | Vocabulary Browser |
| `data-sources` | Data Sources |
| `data-explorer` | Data Explorer |
| `data-explorer.dqd` | Data Quality Dashboard |
| `data-explorer.heel` | Heel Checks |
| `characterization` | Characterization |
| `incidence-rates` | Incidence Rates |
| `treatment-pathways` | Treatment Pathways |
| `estimation` | Population-Level Estimation |
| `prediction` | Patient-Level Prediction |
| `studies` | Studies |
| `care-gaps` | Care Gaps |
| `patient-timeline` | Patient Timeline |
| `data-ingestion` | Data Ingestion |
| `admin.users` | User Management |

Each JSON file schema:
```json
{
  "key": "...",
  "title": "...",
  "description": "...",
  "docs_url": "/docs/...",
  "video_url": null,
  "tips": ["...", "..."]
}
```

**`resources/changelog.md`** — full changelog from v0.1.0→v0.9.0 in Keep-a-Changelog format; parsed server-side into structured JSON.

### Frontend (`frontend/src/features/help/`)

```
api/helpApi.ts           — getHelp(key), getChangelog() API calls
hooks/useHelp.ts         — useHelp(key), useChangelog() TanStack Query hooks
components/
  HelpButton.tsx         — ? icon button that opens HelpSlideOver
  HelpSlideOver.tsx      — Drawer slide-over showing description + tips + links
  InfoTooltip.tsx        — Inline HelpCircle icon with portal tooltip
  WhatsNewModal.tsx      — Auto-shows on version upgrade, localStorage-tracked
index.ts                 — barrel exports
```

**`HelpButton`**: self-contained — manages its own open/close state, renders `HelpSlideOver` inline.

**`HelpSlideOver`**: uses the existing `Drawer` component; shows loading spinner while fetching, error message on 404, then description → numbered tips → doc/video links.

**`InfoTooltip`**: portal-rendered tooltip on hover/focus; positioned below trigger using `getBoundingClientRect`. Useful for labeling form fields and table columns inline.

**`WhatsNewModal`**: checks `localStorage.getItem('parthenon_seen_version')` on mount. If the latest changelog version differs, opens a modal listing all entries as collapsible cards (version badge, date, Added/Fixed/Changed sections with color-coded headings). Saves seen version on dismiss.

### MainLayout integration

`WhatsNewModal` added to `MainLayout.tsx` — renders unconditionally (handles its own visibility). Shows after onboarding is complete (no conflict with SetupWizard/OnboardingModal because it uses `localStorage` not server state).

### Pages wired

`HelpButton` added to 6 key list pages:

| Page | Help Key |
|------|---------|
| `CohortDefinitionsPage` | `cohort-builder` |
| `ConceptSetsPage` | `concept-set-builder` |
| `DataExplorerPage` | `data-explorer` |
| `VocabularyPage` | `vocabulary-search` |
| `AnalysesPage` | `characterization` |
| `SourcesListPage` | `data-sources` |

---

## Notes

- `staleTime: Infinity` on help queries — content changes only on deploy, no need to refetch
- Help key sanitization (`/^[a-z0-9\-\.]+$/`) prevents path traversal before `resource_path()` call
- `InfoTooltip` uses portal to avoid `overflow: hidden` clipping in table cells
- PHPStan L8 passes; baseline updated to absorb pre-existing unrelated errors
- TypeScript compiles cleanly (`npx tsc --noEmit`)
