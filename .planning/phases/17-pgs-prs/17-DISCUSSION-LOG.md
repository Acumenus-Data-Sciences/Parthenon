# Phase 17: PGS Catalog + PRS + Histogram - Discussion Log

> Audit trail only. Decisions are captured in 17-CONTEXT.md.

**Date:** 2026-04-18
**Areas discussed:** PRS compute backend, histogram frontend tech

## PRS Compute Backend

| Option | Selected |
|---|:---:|
| plink2 --score (reuse Phase 14 binary) | ✓ |
| pgscatalog-calc Python tool | |
| Custom SQL aggregate | |

**Rationale:** plink2 already shipped by Phase 14's docker/r/Dockerfile (inline builder stage). Native PGEN support, fast, zero new deps. Matches precedent.

## Histogram Tech

| Option | Selected |
|---|:---:|
| Recharts (match existing drawer patterns) | ✓ |
| d3 (hand-rolled) | |
| Visx (d3 wrappers) | |

**Rationale:** Consistency with coverage profile badges, cohort count widgets. ReferenceArea makes quintile bands trivial. TanStack Query fits cleanly.

## Claude's Discretion (deferred to planner)

- PGS Catalog fetch URL pattern (harmonized GRCh38 preferred, primary fallback)
- REST API metadata vs file-header parsing
- Histogram binning rule (fixed 50 bins vs Freedman-Diaconis)
- Score picker UI (plain select vs searchable autocomplete)
- R testthat coverage scope
- CSV streaming chunk size
- Audit logging surface

## Deferred Ideas

- PGS Catalog auto-refresh daemon
- Multi-score comparison viz
- Cross-ancestry adjustment
- PRS-GWAS feedback loop
- Cross-source PRS portability
- Non-PGS-Catalog score sources
- FHIR/GA4GH VRS export
