---
title: "Ares v2 Phase C — Advanced + Differentiators"
mode: quick
tasks: 11
source: docs/devlog/plans/2026-03-24-ares-v2-phase-c.md
must_haves:
  truths:
    - 3 new services (ConceptStandardization, PatientArrivalForecast, MappingSuggestion)
    - New config/ares.php with reference population, benchmarks
    - ~18 new API endpoints with auth + permission middleware
    - ~12 new frontend components
    - HIGHSEC: mapping writes to accepted_mappings only, not CDM
    - Rate limiting on expensive endpoints
---

# Ares v2 Phase C — Advanced + Differentiators

## Execution (5 parallel agents)

- Agent A: D1+D2 (Standardization + Forecast services)
- Agent B: D3+D4 (GIS Diversity + AI Mapping)
- Agent C: D5+C1 (Cost Type + DQ Radar/SLA/Export)
- Agent D: C2+C3+C4 (Temporal/ConceptSets + ETL Provenance + Annotation Markers)
- Agent E: C5+C6 (Cost Advanced + Coverage Export + Diversity Trends)

## Note: Phase B already created
- dq_sla_targets, accepted_mappings tables + models
- tag + parent_id on chart_annotations
- etl_metadata on source_releases
- CostTypeFilter, AnnotationTimeline, CreateFromChartPopover components
