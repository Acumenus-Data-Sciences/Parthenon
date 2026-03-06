# Documentation Rewrite v2.0

**Date:** 2026-03-05
**Scope:** Complete rewrite of all Docusaurus documentation to reflect Phases 15-17 and platform maturity

---

## What Was Done

### Full Documentation Rewrite (41 MDX files)
Rewrote every documentation page to reflect the current state of Parthenon after Phases 15-17:

- **intro.mdx** -- Updated overview covering all modules (Genomics, Imaging, HEOR, FHIR, AI)
- **Part I-VIII** -- All 26 existing chapters rewritten with current feature descriptions, updated screenshots references, and corrected cross-links
- **Part IX -- Genomics** (NEW) -- `27-genomics-overview.mdx`: VCF upload, ClinVar annotation, variant browser, tumor board, genomic cohort criteria
- **Part X -- Imaging** (NEW) -- `28-imaging-overview.mdx`: DICOM import, Cornerstone3D viewer, WADO-RS, radiology NLP, imaging cohort criteria
- **Part XI -- HEOR** (NEW) -- `29-heor-overview.mdx`: CEA/CUA, budget impact, care gaps, value-based contracts, ROI analysis
- **Part XII -- FHIR EHR Integration** (NEW) -- `30-fhir-ehr-integration.mdx`: SMART Backend Services, bulk export, incremental sync, SHA-256 dedup
- **Appendices A-G** -- All 7 appendices updated (glossary terms, API reference, troubleshooting, known limitations)
- **Migration Guide** -- All 7 migration chapters updated with new capabilities section

### Sidebar Updated
`sidebars.ts` now includes Part IX-XII sections.

### Build Fixes
- Fixed MDX syntax error in `f-known-limitations.mdx`: `<768px` parsed as JSX tag, escaped to `&lt;768px`
- Fixed cross-reference links between FHIR and System Configuration pages (relative paths break with custom slugs)
- Fixed migration overview links (slug is `/migration`, not `/migration/00-overview`)
- Fixed footer link to migration guide

### Docusaurus Theme (from previous session)
- Dark crimson + gold theme matching Parthenon's design system
- Dark-only mode, custom fonts (Crimson Pro, Source Serif 4, Source Sans 3, IBM Plex Mono)
- Prism One Dark syntax highlighting

---

## Files Changed
- `docs/site/docs/**/*.mdx` -- 41 files rewritten
- `docs/site/sidebars.ts` -- Added Part IX-XII
- `docs/site/docusaurus.config.ts` -- Footer link fix
- `docs/dist/` -- Rebuilt static site

## Known Warnings
- `/docs/api` broken link warnings are expected -- API Reference is served by PHP (Scramble), not Docusaurus
