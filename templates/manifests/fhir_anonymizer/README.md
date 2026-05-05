# `fhir_anonymizer` — Phase 1 template

Anonymizes a directory of FHIR resources by applying the configured rule set
via either the Microsoft FHIR Anonymizer sidecar or the Parthenon native
rule engine. Both backends consume the same JSON config schema.

## What it does

1. `prepare_resources`: reads upstream FHIR (NDJSON directory or single
   Bundle JSON file) and explodes into one-resource-per-file under
   `prepared/`. Each output file is named `{resourceType}_{id}.json`.
2. `resolve_config`: resolves the anonymizer config from one of three
   sources — `library` (shipped configs), `inline` (dict in params), or
   `file` (filesystem path).
3. `anonymize`: runs Plan 1's `AnonymizerNode` in-process, consuming
   `prepared/`, writing to `anonymized/`.
4. `summarize`: counts resources by type before/after, asserts count is
   preserved, writes `anonymizer_summary.json`.

## When to use it

Run **before** any downstream FHIR ETL when:

- Source data carries PHI you don't want to land in your CDM (most cases).
- You're shipping data to a research collaborator under a Safe Harbor or
  custom de-identification agreement.
- You need date-shifted timestamps for re-identification-resistance while
  preserving relative time intervals.

The output `anonymized/` directory is suitable as the upstream `ndjson_dir`
input to `fhir_to_omop` (Plans 5–7).

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `input_kind` | string | yes | — | `ndjson_dir` or `bundle_file`. |
| `input_path` | string | yes | — | Filesystem path to source. |
| `backend` | string | yes | `ms` | `ms` (sidecar) or `native` (Python). |
| `config_source` | string | no | `library` | `library` / `inline` / `file`. |
| `config_name` | string | when `library` | `hipaa_safe_harbor` | `hipaa_safe_harbor` or `minimal_redaction`. |
| `config` | object | when `inline` | — | Inline config dict (validates against `anonymizer_config.v1.json`). |
| `config_path` | string | when `file` | — | Filesystem path to a JSON config file. |
| `sidecar_url` | string | no | `http://parthenon-anonymizer:8080` | Override sidecar URL (when `backend=ms`). |

## Prerequisites

- Phase 1 Plan 1 deployed: `AnonymizerNode` registered, `parthenon-anonymizer`
  sidecar healthy (only required when `backend=ms`).
- Source FHIR data accessible to the templates container (filesystem mount
  or NDJSON files in a known volume).
- Sufficient disk space in `PARTHENON_STORAGE_ROOT` to hold a copy of the
  source data + an anonymized copy (~2× source size).

## Examples

### Native backend, library config

```bash
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/fhir_anonymizer/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/fhir_anonymizer/runs
```

### Sidecar backend, inline custom config

```json
{
  "input_kind": "ndjson_dir",
  "input_path": "/srv/fhir/raw",
  "backend": "ms",
  "config_source": "inline",
  "config": {
    "version": "1",
    "default_action": "keep",
    "rules": [
      {"path": "Patient.id", "operation": "cryptoHash", "params": {"algorithm": "sha256"}},
      {"path": "Patient.name", "operation": "redact"},
      {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 60}}
    ]
  }
}
```

### Composing with `fhir_to_omop` (Plan 5)

The recommended production pattern is a two-step pipeline:

1. Run `fhir_anonymizer` with `input_path = /srv/fhir/raw`; output lands in
   run storage.
2. Run `fhir_to_omop` with
   `ndjson_dir = <fhir_anonymizer_run_storage>/anonymize/anonymized`.

Phase 2 may add a single composing template that orchestrates both steps;
for now they're submitted separately.

## Limitations

- The `anonymize` node uses an in-process `AnonymizerNode` invocation rather
  than a direct manifest-level `type: anonymizer` entry. Reason: the Phase 1
  Materializer doesn't resolve cross-node path references like
  `${node.prepare_resources.artifact_dir}`. Phase 2 work will add that
  feature; this template's structure flips to direct then. See ADR 0007.
- The shipped `hipaa_safe_harbor.json` is a **rule set**, not a legal
  certification. HIPAA Safe Harbor compliance also requires policy controls
  (data sharing agreements, recipient training, no actual knowledge of
  re-identification, etc.) — see Security notes.
- Date-shift uses a per-run salt; re-running the same source with a
  different run yields different shifts. If you need reproducible shifts
  across runs (e.g., for incremental ingestion that must align dates with
  prior runs), pass a stable `run_id` upstream and supply the same
  `salt_seed` parameter — Phase 2 work.
- The sidecar runs the MS reference implementation on .NET 8; container
  image size is ~250 MB. Air-gap deployments must mirror the image to a
  local registry (already the default — Parthenon GHCR).

## License / attribution

- The Microsoft FHIR Anonymizer is open-source under MIT license.
- The Parthenon native backend is internal Acumenus IP, Apache 2.0.
- The shipped HIPAA Safe Harbor config is a Parthenon-authored rule set
  modeled on 45 CFR §164.514(b)(2). It is NOT a legal certification.
  Consult your privacy office.

## Security notes

- The sidecar (`parthenon-anonymizer`) runs as **non-root**, **read-only
  rootfs**, **no host port mapping**, **no network egress**, on the
  internal `parthenon` docker network only. (Plan 1 Task 14.)
- Source PHI is staged in run storage during processing. After completion,
  the `prepare_resources/prepared/` directory contains the source PHI in
  one-file-per-resource form. **Schedule a `parthenon-templates run-cleanup`
  job to purge `prepared/` after downstream consumers have read the
  `anonymized/` output.** (Phase 2 follow-up: auto-delete `prepared/` once
  `summarize` succeeds.)
- The anonymizer config (when sourced from `library` or `file`) is **not
  itself secret**, so `config` and `config_path` parameters are NOT
  redacted by the Materializer. The values inside the source data ARE
  treated as PHI and never logged.
- Per-run salt is generated via `secrets.token_hex(32)` (Plan 1
  AnonymizerNode). Its SHA-256 digest is recorded in the run's outputs
  for reproducibility audit; the salt itself is never logged.
- Audit your custom configs before running them in production. The schema
  validator catches structural errors but cannot tell you whether your rule
  set is HIPAA-compliant for your use case.
