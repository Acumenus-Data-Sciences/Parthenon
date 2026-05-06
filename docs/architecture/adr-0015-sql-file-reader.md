# ADR 0015 — `sql_node` `file://` SQL-Reference Reader

**Status:** Accepted (2026-05-06)
**Deciders:** Phase 3 spec Q10.
**Implements:** Phase 3 Plan 0 (carry-over follow-up from Phase 0).

## Context

`sql_node` originally accepted only inline `statements` — a list of SQL
strings in the manifest YAML. Phase 2 Plan 4 (`load_mimic_iv_omop`) and
Plan 5 (`artemis_chemo_regimens`) shipped manifests that reference
`file://` paths for multi-stage SQL bootstrap; these were merged with
the full testcontainers E2Es deferred until the reader landed.

Inline SQL beyond ~50 lines is unwieldy: loses syntax highlighting,
breaks line-comment grep, and inflates manifest YAML diffs. Every
Phase 3 commercial-tier template (claims, registries, lab) needs
multi-stage SQL too.

> **URI scheme note:** Plan 0 was drafted with the placeholder name
> `sql_file://`. During execution we aligned with the `file://` URI
> scheme already shipped in three merged Phase 2 manifests (MIMIC-IV,
> ARTEMIS, SDTM) rather than re-open those PRs. The schema field is
> still named `sql_file:` in YAML; only the URI scheme inside the
> string changed from `sql_file://` to `file://`.

## Decision

**Add `sql_file: file://<rel-path>` resolution to `sql_node`.**
Resolution is:

1. Relative-only — paths resolve under `NodeContext.manifest_dir`. Any
   `..` traversal or absolute path raises `SqlFileReadError`.
2. Parameter-expanded — `${parameters.cdm_schema}`-style placeholders
   substitute against the run's parameter dict before execution. The
   substitution helper lives in `runtime.sql_files.resolver` and is the
   canonical implementation for *file content*; the materializer's
   existing `_interpolate` covers *YAML node-param values* and stays
   put.
3. `sql_file` and inline `statements` are mutually exclusive — setting
   both raises a clear error. Same XOR applies to `fetch_query_file` ↔
   `fetch_query`.

Per Phase 3 spec Q10 = (b), the scope covers inline resolution +
`${parameters.*}` expansion. SQL caching for re-runs (Q10 option c) is
deferred to Phase 4.

## Consequences

- All Phase 3 commercial-tier manifests (`claims_to_omop`,
  `registry_to_omop`, `lis_lab_to_omop`, `ai_assisted_mapping`) ship
  SQL alongside YAML and reference it via `sql_file: file://...`.
- `NodeContext` gains `manifest_dir: Path | None` and `run_parameters:
  dict[str, Any]` fields, plumbed through the materializer + Prefect
  orchestration backend. Existing callers default to empty values; only
  `file://` consumers require them.
- Phase 2's MIMIC-IV and ARTEMIS testcontainers full-pipeline E2Es
  remain SKIPPED, but the gating reason is updated. Plan 0 unblocked
  one of two original gating items (the reader); the remaining blocker
  is a vocab-seed harness for testcontainers Postgres + a manifest
  run-orchestration driver. Both are tracked as Phase 4 follow-ups.
- The schema validator (`template.v1.json`) documents `sql_file` as an
  alternative to `statements` in `sql` node `params`.

## Alternatives considered

- **Heredoc-style YAML multi-line strings.** Declined — loses linting,
  forces manual escaping of dollar signs, and quoted blocks above ~80
  lines are illegible in PR diffs.
- **A separate `parthenon-sql` build step that compiles SQL fragments
  into a single inline statement.** Declined — over-engineered for the
  current need; SQL files in the manifest dir are the simplest unit of
  composition.
- **Allow absolute paths or unrestricted `file://` (no traversal
  guard).** Declined — opens the runtime to reading any file the
  worker process can see, including `/etc/passwd`. Tests assert the
  guard fires.
- **Use a custom `sql_file://` URI scheme instead of `file://`.**
  Declined during execution — three Phase 2 manifests already shipped
  using `file://`, and re-opening those PRs to rename a URI scheme is
  far more disruptive than aligning with the convention already on
  main.

## Open follow-ups

- **Vocab-seed harness for testcontainers Postgres** (Phase 4) — load
  minimal SNOMED/ICD-10-CM/RxNorm/LOINC concepts so the MIMIC + ARTEMIS
  full-pipeline E2Es can lift their `pytest.skip`.
- **Manifest run-orchestration driver** (Phase 4) — a programmatic
  driver (`runtime.runner.run_manifest(manifest_path, parameters,
  dsn)`) so E2Es can invoke a manifest end-to-end without the CLI.
- **SQL caching** (Phase 4) — hash SQL bodies after parameter
  expansion; skip re-execution for idempotent stages.
- **`sql_lint` pre-commit hook** — wire `sqlfluff` against
  `templates/manifests/**/sql/*.sql` once the corpus stabilizes in
  Phase 3.
