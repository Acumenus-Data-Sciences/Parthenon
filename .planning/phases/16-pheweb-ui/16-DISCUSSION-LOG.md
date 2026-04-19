# Phase 16: PheWeb UI + Session Pill - Discussion Log

> Audit trail only. Decisions are captured in 16-CONTEXT.md.

**Date:** 2026-04-19
**Areas discussed:** Manhattan rendering, LocusZoom panel, thinning strategy

## Manhattan Rendering for 10M SNPs

| Option | Selected |
|---|:---:|
| Server-side thinning + Canvas (PheWeb-style binning + GWS bypass) | ✓ |
| d3 with virtualized SVG | |
| WebGL via regl/deck.gl | |
| Tile server + Leaflet-style pan/zoom | |

**Rationale:** Existing `ManhattanPlot.tsx` (364 LOC) already uses d3 + Canvas — matches the approved strategy exactly. Server thinning caps payload at ~8MB. <3s render target achievable.

## LocusZoom-lite Panel + LD

| Option | Selected |
|---|:---:|
| Hand-roll d3 + skip LD v1 | ✓ |
| Embed LocusZoom.js library | |
| Hand-roll d3 + LDlink REST API | |

**Rationale:** Skip LD in v1 — deferred to Phase 16.1. Gene track from GENCODE v46 GFF3 baked into backend. Matches existing d3 chart patterns (ForestPlot, KaplanMeier).

## Thinning Strategy

| Option | Selected |
|---|:---:|
| Lazy PG query + Redis cache per run_id | ✓ |
| Post-GWAS pre-compute in Darkstar R worker | |
| Materialized view refreshed on run completion | |

**Rationale:** No Phase 15 R worker change needed. Redis cache absorbs first-hit latency; subsequent hits <100ms.

## Claude's Discretion (deferred to planner)

- Manhattan component: extend existing vs create parallel
- Test fixture: synthetic 10k-row summary_stats vs Phase 14 smoke output
- Top-50 table: TanStack Table vs plain HTML
- Gene track rendering: Canvas vs SVG
- Empty-state behavior for in-flight runs
- Error boundary placement

## Deferred Ideas

- LD coloring (Phase 16.1)
- PNG/PDF export
- PheWAS view
- Gene-peak auto-labeling
- Run comparison overlay
- Whole-genome PheWAS
- GWAS-as-a-covariate (PRS feedback loop)
- FHIR/GA4GH VRS variant export
