# ADR 0007 — FHIR Anonymizer Template Design

## Status

Accepted, 2026-05-03.

## Context

Devplan T-014 calls for a `fhir_anonymizer` template that pre-processes FHIR
resources before downstream ETL, with both the Microsoft FHIR Anonymizer
sidecar and a Parthenon native rule engine selectable per-run. Plan 1 already
shipped `AnonymizerNode`, both backend implementations, and the v1 config
schema (ADR 0004). Plan 4's job is to wire those into a customer-facing
template.

Three design questions emerge:

1. **How does the manifest call AnonymizerNode** given that the Phase 1
   Materializer doesn't resolve cross-node path references (e.g.
   `${node.prepare_resources.artifact_dir}`)?
2. **Where do canonical configs live**, and do customers consume them
   directly?
3. **What does the validation pack assert**, given there's no DB write?

## Decision

### 1. Wrap AnonymizerNode in a python node

The manifest declares four nodes: `prepare_resources` (PythonNode),
`resolve_config` (PythonNode), `anonymize` (PythonNode that imports
`runtime.nodes.anonymizer.AnonymizerNode` and runs it in-process), and
`summarize` (PythonNode).

The `anonymize` PythonNode internally constructs a fresh `NodeContext` with
the same `run_id`, `secrets`, and `db_dsn` as the outer context, points
`artifact_dir` at its own dir, and calls `AnonymizerNode().run(...)`. This
sidesteps the Materializer's lack of cross-node path references by resolving
them in Python at execution time.

**Rejected alternative**: declaring `type: anonymizer` directly. The
`AnonymizerNode.run(...)` signature takes `input_dir` as a path string, which
must come from another node's artifact_dir. The Phase 1 Materializer can
substitute `${parameters.*}` but not `${node.<id>.artifact_dir}`. Adding that
feature is a Phase 2 candidate (worth it once 3+ templates need it).

When the Materializer learns cross-node paths, the manifest collapses to:

```yaml
- node_id: anonymize
  type: anonymizer
  depends_on: [resolve_config]
  params:
    backend: "${parameters.backend}"
    input_dir: "${node.prepare_resources.artifact_dir}/prepared"
    config: "${node.resolve_config.outputs.config}"
```

This is the eventual destination; the wrapper pattern is interim.

### 2. Config library lives under runtime/, not under manifests/

Two reasons:

- The configs are reused across templates (Plan 5/6/7 may also use them in
  ETL contexts). Putting them at `runtime/instruments/anonymizer_configs/`
  makes the namespace clear: shared resources, not per-template.
- The configs validate against `runtime/nodes/schemas/anonymizer_config.v1.json`,
  which lives under `runtime/`. Keeping the configs alongside the schema
  is a coupling signal.

Customers select via `config_source: library, config_name: <name>`. They can
also pass an `inline` dict or a `file` path to a customer-supplied config.

### 3. Validation asserts file count + PHI-leak-absence + no DB writes

Unlike all other Phase 1 templates, `fhir_anonymizer` writes no DB rows. The
validation pack therefore:

- Asserts the `anonymized/` directory has the expected count per resource type.
- Asserts the `anonymizer_summary.json` artifact is present.
- A dedicated `tests/unit/test_anonymizer_phi_leak.py` test asserts that NO
  source PHI string appears in the anonymized output blob — treated as a
  HIGHSEC regression guard, similar to Plan 1's pixel-data-absence test.

### 4. Synthetic-PHI fixture with explicit SYNTHETIC tag

The fixture deliberately includes realistic-looking PHI ("Jane Doe",
"555-0100", "MRN-12345-67890") so the PHI-leak regression test has something
to catch. To prevent confusion in security audits, every fixture resource
includes `meta.tag = [{"system": "...", "code": "SYNTHETIC"}]`. A test
asserts every fixture line has the tag.

### 5. The PHI-leak test is HIGHSEC-tier

Same posture as Plan 1's pixel-data test. If a future change ever causes a
source PHI string to appear in the anonymized output, the test fails. Treat
any failure as a blocker; do not merge until fixed. Do not relax the test
list (`PHI_STRINGS`) without an explicit ADR amendment justifying the
change.

### 6. Salt rotation per run; salt digest in run outputs

Inherited from Plan 1 ADR 0004. The fhir_anonymizer template surfaces the
`salt_digest` from the inner `AnonymizerNode.run` invocation in its
`anonymize` node's outputs, so customers can audit reproducibility without
ever seeing the salt itself.

### 7. dateShift handles FHIR Period and ISO datetime

The native backend's `_shift_value` helper recursively handles FHIR Period
(`{start, end}` dict), arrays, and ISO datetime strings (with `T` and `Z`
suffixes). Anything that's not a date-shaped value falls back to `REDACTED`
rather than crashing. This was a real bug surfaced during Plan 4 E2E
bring-up: `Encounter.period` is a Period, not a date string, and the
original `_shift_date(str(value), ...)` crashed on it.

## Consequences

### Positive

- Customers get a single template to anonymize a FHIR corpus with either
  backend.
- The HIPAA Safe Harbor config is a tangible starting point, not just a
  schema.
- The PHI-leak regression test makes "did the anonymizer actually work?" a
  CI-gated invariant.
- Composition with `fhir_to_omop` (Plans 5–7) is a documented two-step
  pattern; no new template needed.

### Negative

- The wrapper-pattern (anonymize-via-python-node) is awkward and
  documented as interim. Phase 2 cleanup needed.
- The `prepare_resources/prepared/` directory holds source PHI on disk
  during processing; a cleanup job is needed (Phase 2 follow-up: auto-delete
  on success).
- Customers running custom configs need to know HIPAA Safe Harbor
  requires more than rule-based redaction (policy controls, agreements,
  recipient training). The README warns about this.
- `config` and `config_path` parameters are not redacted by the
  Materializer. If a customer puts secret values inside an inline config,
  those leak into run logs. The README warns about this.

## Alternatives considered (declined)

- **Add cross-node path resolution to the Materializer in this Plan**.
  Rejected: adds scope; better as a focused Phase 2 PR with multiple
  consumers.
- **Ship the MS Anonymizer config directly without a Parthenon-curated
  HIPAA config**. Rejected: customers would need to write their own from
  scratch; we lose the "starts working immediately" property.
- **Run the anonymizer in-process always (drop the sidecar)**. Rejected:
  would require porting the MS reference implementation to Python; the
  sidecar is the canonical implementation and gets quarterly upstream
  updates.
- **Drop the `bundle_file` input_kind, support only NDJSON**. Rejected:
  many customers receive single-bundle exports from FHIR servers; forcing
  them to pre-split is annoying.

## References

- Phase 1 design spec:
  `docs/superpowers/specs/2026-05-03-parthenon-ingestion-templates-phase-1-design.md`
- Phase 1 Plan 4 (this plan):
  `docs/superpowers/plans/2026-05-03-parthenon-ingestion-templates-phase-1-plan-4-fhir-anonymizer.md`
- Phase 1 Plan 1 ADR (AnonymizerNode + sidecar):
  `docs/adr/0004-phase-1-node-design.md`
- HIPAA Safe Harbor de-identification: 45 CFR §164.514(b)(2)
- Microsoft FHIR Anonymizer:
  <https://github.com/microsoft/Tools-for-Health-Data-Anonymization>
- Anonymizer config v1 schema:
  `templates/runtime/nodes/schemas/anonymizer_config.v1.json`
