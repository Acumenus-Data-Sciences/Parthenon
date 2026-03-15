---
slug: query-assistant-overhaul
title: "Query Assistant Overhaul: Tabbed Interface, Live SQL Runner, and Solr-Powered Concept Search"
authors: [mudoshi, claude]
tags: [development, frontend, backend, query-assistant, solr, postgresql, ux]
date: 2026-03-15
---

The Query Assistant received a ground-up redesign today — from a single 1,700-line monolith into a clean tabbed interface with two focused views, a live SQL execution modal with real-time PostgreSQL status feedback, and Solr-powered concept search built into every parameter input. This post walks through the architecture decisions, the UX patterns, and the production hardening that happened in rapid succession.

<!-- truncate -->

## The Problem: Everything in One Place

The original Query Assistant page tried to do too much in a single view. Natural language input, the OHDSI Query Library browser, query history, results, validation, and the schema browser were all packed into a cramped two-column layout. Users had to mentally juggle two distinct workflows — browsing pre-built queries vs. writing natural language questions — in a UI that didn't distinguish between them.

The page was also a single 1,706-line React component. Every feature was tightly coupled, making iteration painful.

## Tabbed Architecture: Library First, AI Second

The redesign splits the page into two tabs:

### Tab 1: Query Library (Default)

The library tab is now the default landing view, based on a simple UX principle: **the lowest-friction entry point should come first**. Browsing pre-built, vetted OHDSI queries requires less cognitive effort than formulating a natural language question from scratch.

The tab features:
- A **dedicated search input** with a search icon (previously queries shared the NL textarea)
- **Domain filter pills** (Condition, Drug, Measurement, etc.) with counts
- A **3-column responsive card grid** that displays query names, summaries, and tags
- When a card is selected, the grid transitions to a **list + detail panel** layout with the rendered SQL, metadata badges, and validation tools

The 3-column grid makes dramatically better use of the available screen width. At narrower viewports, it degrades to 2 columns (below 1200px) and single column (below 900px).

### Tab 2: Natural Language

The AI-powered text-to-SQL interface gets its own focused tab with:
- A clean textarea with example question chips
- A two-column layout: input + history on the left, results on the right
- Query history (localStorage-backed, max 10 entries) lives here since it's contextually relevant to the AI conversation flow

### Component Decomposition

The monolith was broken into 7 focused files:

| Component | Lines | Purpose |
|-----------|-------|---------|
| `QueryAssistantPage.tsx` | ~100 | Tabbed shell with header |
| `QueryLibraryTab.tsx` | ~290 | Search, filter, card grid |
| `NaturalLanguageTab.tsx` | ~340 | AI text-to-SQL + history |
| `ResultsPanel.tsx` | ~360 | SQL output, metadata, validation |
| `SqlBlock.tsx` | ~130 | SQL code block + Run/Copy buttons |
| `SchemaBrowser.tsx` | ~210 | OMOP CDM schema explorer |
| `ResultsSkeleton.tsx` | ~70 | Loading shimmer |

Each component has a single responsibility and communicates through well-defined props. The shared components (`ResultsPanel`, `SqlBlock`, `SchemaBrowser`) are reused identically across both tabs.

## Live SQL Runner Modal

The most ambitious addition is a "Run SQL" button in the SQL code block toolbar that launches a full execution modal with real-time PostgreSQL feedback.

### How It Works

When you click **Run SQL**, the modal opens and fires `POST /api/v1/text-to-sql/execute`. Here's the backend flow:

1. **Security validation** — The SQL is checked against a blocklist of DDL/DML keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`). Only `SELECT` and `WITH` statements are allowed. Trailing semicolons are stripped to prevent syntax errors when wrapping.

2. **Role gate** — Queries classified as "safe" (read-only) can be run by any authenticated user. Queries flagged as "unsafe" or "unknown" require the `super-admin` role.

3. **PID capture** — Before executing, the backend captures the PostgreSQL backend PID via `SELECT pg_backend_pid()` and caches it in Redis. This enables the status polling endpoint.

4. **Execution** — The query runs on the `cdm` database connection with a `statement_timeout` of 120 seconds. Results are capped at 10,000 rows to prevent memory exhaustion. The SQL is wrapped in `SELECT * FROM (...) AS _q LIMIT 10001` to enforce the cap and detect truncation.

5. **Result caching** — Results are cached in Redis for 5 minutes (keyed by UUID execution ID), enabling CSV download without re-execution.

### The Modal UX

The modal has distinct visual states:

- **Running** — An animated spinner with the live `pg_stat_activity` state label (`active`, `idle in transaction`, waiting on locks), plus an elapsed time counter ticking every 100ms.
- **Completed** — A teal success badge showing row count and elapsed time, a scrollable data preview table (first 100 rows with sticky headers and zebra striping), and a "Download CSV" button.
- **Error** — A red error banner with the PostgreSQL error message, plus a **contextual guidance panel** that diagnoses the error and suggests fixes.

The modal is non-dismissable while a query is running — you can't accidentally close it and lose your results.

### Contextual Error Guidance

When a query fails, the modal doesn't just show a raw error message. It diagnoses the error type and provides actionable suggestions in a gold guidance panel:

| Error Pattern | Diagnosis | Suggestions |
|---------------|-----------|-------------|
| AI returned prose instead of SQL | "The AI returned an explanation instead of SQL" | Rephrase question, use Query Library, be more specific |
| MySQL backticks | "MySQL-style backticks are not supported" | Use double quotes, most OMOP columns don't need quoting |
| `syntax error at or near "..."` | "Syntax error near [token]" | Regenerate, check parentheses, validate first |
| `statement timeout` | "Query timed out (120s limit)" | Add WHERE clauses, LIMIT, date filters, avoid SELECT * |
| `relation "..." does not exist` | "Table [name] not found" | Use schema prefix (omop.), check Schema Browser |
| `column "..." does not exist` | "Column [name] not found" | Expand table in Schema Browser, check OMOP naming |
| Permission denied | "Insufficient permissions" | Explains safety classification system |

This transforms cryptic PostgreSQL errors into guidance that helps users fix their queries independently.

## Solr-Powered Concept Search in Parameter Inputs

Many Query Library queries are parameterized — "Find drug exposures by concept_id", "Search conditions by domain", etc. The original implementation used plain text inputs where users had to know the exact concept ID or string value. That's a non-starter for clinical researchers who think in terms of "diabetes" or "metformin", not concept ID 201826.

### The ConceptSearchInput Component

Every parameter input in the SQL runner modal is now a **Solr-powered typeahead search**:

1. User types 2+ characters (e.g., "diab")
2. A debounced search (300ms) hits the vocabulary Solr core
3. A dropdown appears showing matching OMOP concepts with:
   - **Concept name** (e.g., "Type 2 diabetes mellitus")
   - **Concept ID** (e.g., 201826) in teal monospace
   - **Domain** (Condition), **Vocabulary** (SNOMED), **Concept code** (44054006)
4. Clicking a result auto-fills the parameter:
   - **ID parameters** (detected by field name ending in `_id` or type `number`) get the numeric concept ID
   - **Text parameters** get the concept name

This means a researcher can type "metformin", see the OMOP concept for Metformin (RxNorm 6809, concept_id 1503297), click it, and the query template is re-rendered with the correct concept ID — all without leaving the modal.

Date parameters retain their native date picker, since they don't benefit from concept search.

### Parameter Forwarding

When a user modifies parameters in the ResultsPanel's template form and clicks "Render Template" (which now shows a teal "SQL Updated" success flash for 2.5 seconds), those values are forwarded to the SQL runner modal. So the workflow is seamless:

1. Select a library query → parameters auto-fill with defaults
2. Modify parameters in the panel (or in the modal) using concept search
3. Click "Render Template" → SQL updates with a visual confirmation
4. Click "Run SQL" → modal opens pre-populated with your parameter values
5. Optionally modify params in the modal and re-run

### Full Data Pipeline

The complete data flow for a parameterized library query execution:

```
User types "warfarin" in modal
  → ConceptSearchInput debounces 300ms
  → GET /api/v1/vocabulary/search?q=warfarin&standard=true&limit=8
  → Solr vocabulary core returns concepts
  → User clicks "Warfarin" (concept_id: 1307046)
  → Parameter field set to "1307046"
  → User clicks "Run Query"
  → POST /api/v1/query-library/{id}/render (with params)
  → Backend renders Jinja2 template with concept_id=1307046
  → POST /api/v1/text-to-sql/execute (with rendered SQL)
  → pg_stat_activity polled for live status
  → Results displayed in preview table
  → CSV downloadable for 5 minutes
```

## Production Hardening

Several edge cases surfaced immediately in production testing:

1. **Trailing semicolons** — User SQL from the AI generator often ends with `;`. When wrapped in the row-limiting subquery (`SELECT * FROM (...) AS _q LIMIT 10001`), the semicolon caused a PostgreSQL syntax error. Fixed by stripping trailing semicolons before wrapping.

2. **AI returning prose** — The AI service occasionally returns its reasoning/explanation in the `sql` field instead of actual SQL. The execute endpoint now rejects any content that doesn't begin with `SELECT` or `WITH`, and specifically rejects MySQL-style backtick identifiers.

3. **Missing parameters in API responses** — The Query Library search service's `serializeEntry()` method wasn't including the `parameters` field, so the modal never saw any parameters to render. Fixed by adding `parameters`, `description`, and `example_questions` to the serialization. Solr search results are now hydrated from the database to ensure full entry data is always available.

## What's Next

The Query Assistant is now a solid foundation for interactive OMOP CDM exploration. Future iterations could include:

- **Query result visualization** — Chart the results directly in the modal (bar charts for aggregates, time series for temporal queries)
- **Query saving** — Let users save their parameterized queries to a personal library
- **Query sharing** — Share queries with team members via the Commons workspace
- **Execution history** — Persist query executions beyond the current session for audit trails

The full commit history for this work spans 10 commits across the session, touching the Laravel backend, React frontend, and Solr search infrastructure.
