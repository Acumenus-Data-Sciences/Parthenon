# Query Assistant — Tabbed Redesign

**Date:** 2026-03-14
**Phase:** UX improvement

## Summary

Refactored the Query Assistant page from a 1,706-line monolith with a cramped two-column layout into a clean tabbed interface with two focused views:

1. **Query Library** (default tab) — Browse, search, and filter the OHDSI query library. Dedicated search input with domain filter pills. Cards display in a responsive grid that transitions to a list+detail layout when a query is selected.

2. **Natural Language** — AI-powered text-to-SQL generation with example prompts and query history. Focused interface without library cards competing for attention.

## Architecture

Decomposed the single file into 7 focused components:

| Component | Purpose |
|-----------|---------|
| `QueryAssistantPage.tsx` (~100 lines) | Tabbed shell with header |
| `QueryLibraryTab.tsx` (~290 lines) | Tab 1: search, filter, browse library |
| `NaturalLanguageTab.tsx` (~340 lines) | Tab 2: AI text-to-SQL + history |
| `ResultsPanel.tsx` (~360 lines) | Shared: SQL output, metadata badges, validation |
| `SqlBlock.tsx` (~75 lines) | Shared: SQL code block with copy button |
| `SchemaBrowser.tsx` (~210 lines) | Shared: OMOP CDM schema explorer |
| `ResultsSkeleton.tsx` (~70 lines) | Shared: loading shimmer animation |

## Design Decisions

- **Library first** — Lower cognitive load entry point. Users can discover and use queries without formulating a question. Natural Language is powerful but higher friction.
- **Dedicated search** — Library tab has its own search input (previously shared the NL textarea), making the browse-first pattern more intuitive.
- **Full-width tabs** — Each tab gets the entire page width instead of being squeezed into a column.
- **Shared components** — SQL display, validation, metadata badges, and schema browser are reused across both tabs.

## Files Changed

- `frontend/src/features/text-to-sql/pages/QueryAssistantPage.tsx` — Replaced with tabbed shell
- `frontend/src/features/text-to-sql/components/` — 6 new component files (extracted + new)

## Testing

- TypeScript: compiles clean (`npx tsc --noEmit`)
- Vite build: all 4,942 modules transform successfully
