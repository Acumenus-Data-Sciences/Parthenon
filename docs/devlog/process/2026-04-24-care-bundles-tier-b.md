# CareBundles Tier B — Source comparison + Time trends

**Date:** 2026-04-24

Two researcher-grade comparison views shipped together.

## B1 — Side-by-side source comparison

`GET /care-bundles/{bundle}/comparison` returns every measure × every
qualifying source from the latest current run, with denom/numer/excl/rate +
Wilson 95% CI per cell. Renders as a matrix at
`/workbench/care-bundles/{bundle}/compare` with deltas vs the largest-N
baseline source (color-coded, in pp).

Reads only from materialized runs — no CDM scans — so the page loads in
~100ms regardless of bundle size.

## B2 — Time-trend chart

`GET /care-bundles/{bundle}/measures/{measure}/trend?source_id=X` returns the
last 24 completed-run snapshots for one (bundle, source, measure). Each
materialization is one trend point. Rendered as a small Recharts line with
shaded 95% CI bands inside the methodology modal — researchers see "is this
improving" alongside concept lists and DQ flags.

## Real findings on HTN

| Measure | Acumenus | SynPUF | Delta |
|---|---:|---:|---:|
| HTN-01 BP Control | 74.07% | 0% | −74.1 pp |
| HTN-02 Med Adherence | 46.80% | 32.96% | −13.8 pp |
| HTN-03 Metabolic Panel | 28.83% | 0% | −28.8 pp |
| HTN-04 Lipid Panel | 37.87% | 0% | −37.9 pp |
| HTN-05 Renal Function | 20.16% | 0% | −20.2 pp |
| HTN-06 Lifestyle | 0.01% | 0.46% | +0.4 pp |

The 0% rates on SynPUF for measurement-domain measures aren't a quality
finding — they reflect that **CMS claims data lacks lab results**. The DQ
flag layer (Tier A, `numerator_concepts_unused`) marks these critical and
prevents researchers from publishing the artifact as a real result.

This kind of cross-CDM contrast is the point of having a comparison view.
