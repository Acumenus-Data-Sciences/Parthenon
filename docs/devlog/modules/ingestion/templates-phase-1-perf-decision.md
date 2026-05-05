# Phase 1 — fhir_to_omop performance decision (Q6)

**Date:** 2026-05-03
**Spec reference:** `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md` §11 Q6
**Devplan reference:** §4 T-015 acceptance criterion (1M Observations < 10 min on 8 vCPU / 32 GB / NVMe)

## Test run

Performance harness
(`templates/tests/performance/test_fhir_to_omop_throughput.py`) is wired
to run on the Parthenon nightly job (Darkstar test VM, reference
hardware): 8 vCPU, 32 GB RAM, NVMe SSD.

- **Test corpus:** 1,000,000 synthetic Observation resources, 1 Patient,
  1 Encounter (deterministic; seed=42)
- **CDM target:** v5.4, fresh Postgres 16 testcontainer
- **Run command:**
  `uv run pytest tests/performance/test_fhir_to_omop_throughput.py -v -m slow`

## Measured results

The numbers below are placeholders until the nightly run executes. The
test prints a single line on completion:

```
perf: 1000000 observations, status=completed, elapsed=<seconds>s, RSS delta=<MB>MB
```

When the first nightly run completes, replace the table values and lock
the SHIP/ESCALATE verdict.

| Metric | Measured | Budget | Status |
|---|---|---|---|
| `elapsed_seconds` | TBD (first nightly) | 600 s | TBD |
| `rss_delta_mb` | TBD (first nightly) | 4096 MB (soft) | TBD |
| `final_status` | TBD | completed | TBD |

## Decision (provisional — locks at first nightly)

**Provisional verdict: SHIP** — pending the first nightly perf run on
reference hardware. Local laptop runs of the harness with 1k–10k
observations complete in seconds, and nothing in the implementation has
changed since Plan 6 closed except the addition of the
DiagnosticReport / Consent mappers (each emits at most one row per
resource, so neither contributes to per-Observation cost). The
expectation is therefore that 1M Observations stay well below the
600-second budget on reference hardware.

If the nightly run shows `elapsed_seconds < 600` and
`final_status == completed`:

- **Final verdict: SHIP Phase 1 with Python-only ingestion.**
- The Rust-assisted bulk-export ingestion path remains a deferred
  candidate; no scope expansion to Phase 1.
- Customer profiling on different hardware may surface a need later, in
  which case a follow-up plan (tentatively numbered Plan 8) opens the
  Rust path.

If the nightly run shows `elapsed_seconds >= 600`:

- **Final verdict: ESCALATE.** Phase 1 closes WITHOUT satisfying the
  devplan T-015 throughput acceptance criterion. A separate Plan 8 is
  required to close the gap before any production deployment.
- The DoD verification document (Plan 7 Task 9) explicitly flags this as
  an open Phase 1 finding.
- PR-C functionality (DiagnosticReport, Consent) and the closeout
  documentation still ship — they are independent of throughput.

## Rust escalation scope (if triggered)

If the verdict flips to ESCALATE, Plan 8 will:

- Add `pyo3==0.23.x` and a Rust crate at
  `templates/runtime/fhir_to_omop_rs/` housing the NDJSON line iterator
  + json parser.
- Replace the inner `for line in f` loop in `runtime.fhir_to_omop`
  mappers with a Rust-backed iterator yielding
  `(resource_type, resource_dict)` tuples.
- Re-run the performance harness; expected target: < 200 s on the same
  hardware.
- Add a CI matrix dimension exercising both Python-only and
  Rust-accelerated paths.
- Update ADR 0008 with an "Amendment 2026-XX-XX (Rust path)" section.

The Plan 8 estimate (if needed) is **L**: ~3 weeks of work for one
platform engineer (Rust dev environment setup + crate build + binding +
benchmark + cross-platform binary distribution). This estimate was
captured at Plan 0 (devplan §4 T-015 PR-C) and is unchanged.

## Audit trail

- Performance harness:
  `templates/tests/performance/test_fhir_to_omop_throughput.py`
- Synthetic generator:
  `templates/tests/performance/generate_fixture.py`
- Run logs: attached as a CI artifact when the test runs in the nightly
  job.
