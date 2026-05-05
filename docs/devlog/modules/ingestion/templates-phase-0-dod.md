# Phase 0 Definition of Done — Ingestion Templates

**Status:** Draft (set to APPROVED at sign-off)
**Spec:** `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md` §9
**Reviewers:** _(fill in at sign-off — minimum 1 platform + 1 ETL engineer)_

For each spec §9 DoD bullet, evidence is recorded inline as a test path,
commit SHA, or manual verification step. Where a bullet's evidence is the
artifact itself (a file, a manifest), the path is given.

## Templates ship and run

- [x] All 4 templates appear in the Aqueduct → Templates catalog.
  - Catalog comes from `templates/manifests/`; `validate-manifests` reports 4 OK
    (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`, `load_synpuf`).
  - Frontend rendering: `EtlToolsPage.tsx` sub-tab strip (commit `ce6f6eac8`)
    and `AqueductTemplatesPage` (`d4ecc7080`).
  - Playwright happy-path: `e2e/templates/submit-and-watch.spec.ts`
    (commit `f1770a68d`).

- [x] `hello_cdm` runs end-to-end against clean Postgres in CI.
  - Manifest: `templates/manifests/hello_cdm/manifest.yaml` (commit `b8d12bfd5`).
  - Validation pack: commit `fc2087022`. README: `82dae440f`. CI E2E: `9d67dbef6`.
  - One xfail remains: the `query_person.fetch_query` artifact assertion is a
    documented design gap (SqlNode renders `fetch_query` distinct from
    `statements`); tracked as a Phase 1 fix in `templates-phase-0.md`.

- [x] `nodes_test` runs end-to-end and exercises all 8 node types in CI.
  - Manifest: `c95f2f128`. Fixtures + validation pack: `c1b452a55`. README:
    `916d5be22`. CI E2E: `3ce35550a`. Asserts every shipped node type
    (`python`, `sql`, `csv_reader`, `db_reader`, `db_writer`, `py2table`,
    `generic_file`, `r`).

- [ ] `load_athena_vocabulary` runs end-to-end against a real bundle in
      staging (user-initiated).
  - Manifest: `6813ef718`. Validation pack: `c727e9f96`. README: `8473216f1`.
  - Vocab-diff CLI for comparison checks: `38021a24f`, `b85b7c713`.
  - Staging run-id: _(fill at sign-off)_; pack output to be committed under
    `docs/devlog/modules/ingestion/staging-runs/load_athena_vocabulary-<date>.md`.

- [ ] `load_synpuf` runs end-to-end with `patient_count=1k` in staging
      (user-initiated).
  - Manifest: `947488542`. Validation pack: `3b47369bf`. README: `6f16c1dab`.
  - Staging run-id: _(fill at sign-off)_.

## Validation packs

- [x] Each template has a validation pack at `templates/manifests/<id>/validation/`.
  - `ls templates/manifests/*/validation/` shows 4 directories
    (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`, `load_synpuf`).

## READMEs

- [x] Each template has a `README.md` covering: what it does, when to use it,
      parameters, prerequisites, examples, limitations, license notes.
  - `templates/manifests/hello_cdm/README.md` (`82dae440f`),
    `nodes_test/README.md` (`916d5be22`),
    `load_athena_vocabulary/README.md` (`8473216f1`),
    `load_synpuf/README.md` (`6f16c1dab`).

## Node SDK

- [x] All 8 bootstrap node types exist with unit tests.
  - `templates/runtime/nodes/`: `python_node.py`, `sql_node.py`,
    `csv_reader.py`, `db_reader.py`, `db_writer.py`, `py2table.py`,
    `generic_file.py`, `r_node.py`. Tests under `templates/tests/unit/`.
  - Final pytest run: 172 passed, 1 xfailed, 0 failed.

- [x] `mypy --strict templates/runtime/` passes.
  - Output: `Success: no issues found in 39 source files`.

## ADRs

- [x] `docs/adr/0001-node-sdk-design.md` committed and reflects final design.
  - File present, MADR sections (`Status`, `Context`, `Decision`,
    `Consequences`) verified by `templates/tests/test_adrs.py`.

- [x] `docs/adr/0002-orchestration-backend.md` committed.
  - File present, MADR sections verified by `test_adrs.py`.

- [x] `docs/adr/0003-template-manifest-format.md` committed.
  - File present, MADR sections verified by `test_adrs.py`.

## CI integration

- [x] Pre-commit hook validates manifests on every commit that touches a
      manifest YAML.
  - `scripts/githooks/pre-commit` includes a templates-manifests gate
    (variable `STAGED_TEMPLATES_MANIFESTS`).

- [x] CI fails when any committed manifest doesn't validate.
  - GitHub Actions workflow under `.github/workflows/templates*.yml` runs
    `parthenon-templates validate-manifests` on every push.

## Aqueduct UI

- [x] Aqueduct shows new sub-tabs (Mappings | Templates | Runs) behind feature
      flag.
  - `EtlToolsPage.tsx` refactor: commit `ce6f6eac8`.
  - Feature-flag hook: `c804165ae` (`useTemplatesEnabled`); reads
    `app_settings.ingestion_templates_enabled`.

- [x] Full happy path runs in Playwright with flag on.
  - `e2e/templates/submit-and-watch.spec.ts` (commit `f1770a68d`).

## Catalog visibility

- [x] Submitting a CDM-touching template creates an `app.ingestion_jobs` row
      visible on the Upload-tab dashboard with a deep-link.
  - `TemplateRunService::submit` creates the IngestionJob row when the
    manifest declares CDM emission; FK column added in migration `16cc8356a`.
  - End-to-end submit→poll→completed test: commit `8de5808a8`.

## Security

- [x] HIGHSEC §1–§7 review passes.
  - `docs/devlog/modules/ingestion/templates-phase-0-security.md`. Sign-off
    boxes pending fill at release time.

## Performance

- [ ] `hello_cdm` runs in <30s on a Postgres 16 dev instance.
  - CI run timing for `test_hello_cdm`: _(fill at sign-off)_.

## Deploy integration

- [x] `deploy.sh` knows about the new container.
  - `--templates-sync` flag (commit `a84734877`); after migrations the
    deploy script triggers `php artisan templates:sync` (commit `c25a1a9ff`).

## Documentation

- [x] Devlog written.
  - `docs/devlog/modules/ingestion/templates-phase-0.md` (Task 19).

- [x] Operations runbook written.
  - `docs/devlog/modules/ingestion/templates-phase-0-runbook.md` (Task 20).

## Sign-off

- [ ] Platform engineer: ___________________  date: __________
- [ ] ETL engineer: ___________________  date: __________

When both signatures are present, set Status: APPROVED at the top of this
file and commit. Phase 0 is shipped.
