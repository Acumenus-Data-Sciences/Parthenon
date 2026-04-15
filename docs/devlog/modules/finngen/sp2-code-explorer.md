# FinnGen SP2 — Code Explorer Devlog

**Status:** Implementation complete.
**Spec:** `docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md`
**Plan:** `docs/superpowers/plans/2026-04-15-finngen-sp2-code-explorer.md`

## What SP2 delivers

First user-visible FinnGen feature. Page at `/finngen/explore` where a
researcher picks a CDM source + OMOP concept and sees:

- Counts tab — stratified bar chart (year × gender or age_decile)
- Relationships tab — clickable concept_relationship table
- Hierarchy tab — ReactFlow ancestor/descendant graph
- Report tab — ROMOPAPI HTML report inline preview + download
- My Reports tab — persistent history of reports with pin support

## Deviations from spec (during execution)

(Fill in at merge time — any real changes made vs. the written plan.)

## Test state

- Pest: SP1 100 + SP2 15 = 115/115
- Vitest: foundation 13 + code-explorer 16 (2 jsdom skips) = 27+ passing
- testthat: 2 new nightly-slow-lane specs
- Playwright: 1 new slow-lane spec

## Deploy notes

See `runbook.md` for the `finngen:setup-source` procedure — required
once per CDM source before `/counts` endpoint returns data.
