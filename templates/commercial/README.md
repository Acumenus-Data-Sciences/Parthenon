# parthenon-templates-commercial

**License:** Proprietary. Distribution and use require a Parthenon commercial
license — see `LICENSE.txt` (forthcoming) or contact `licensing@acumenus.net`.

## What this is

The commercial-tier sibling wheel to `parthenon-templates`
(community / AGPLv3). Ships proprietary node implementations and pipeline
manifests for high-margin ingestion templates that are not part of the
open-source baseline:

| Plan | Template | Status |
|------|----------|--------|
| Phase 3 Plan 1 | `claims_to_omop` (X12 837 P/I/D + COST projection) | this PR |
| Phase 3 Plan 2 | `claims_to_omop` (X12 835 remit reconciliation)   | next  |
| Phase 3 Plan 3 | `claims_to_omop` (NCPDP retail pharmacy)          | next  |
| Phase 3 Plan 4A/B/C | `genomics_to_omop`, `imaging_to_omop`, `mtb_to_omop` | next |
| Phase 3 Plan 6 | `network_federation`                               | next  |

## Layout

```
commercial/
  pyproject.toml         # parthenon-templates-commercial wheel
  runtime/
    __init__.py          # namespace marker
    commercial/
      __init__.py
      claims/
        readers/
        cost_projector.py
  manifests/
    claims_to_omop/
      manifest.yaml
      sql/
      fixtures/
      validation/
```

The commercial wheel uses Python's namespace-package mechanic to merge
``runtime.commercial.*`` modules into the same ``runtime`` namespace exposed
by the community wheel — so consumers `import runtime.commercial.claims.readers`
without dealing with two distinct top-level packages.

## Contract: one-way imports only

Static enforcement (`templates/.importlinter`) forbids modules under
`runtime.*` (community) from importing `runtime.commercial.*`. The
``community-wheel-isolation`` CI job builds the community wheel only,
installs into a clean venv, and smoke-tests that the registry / manifest
loader runs without any commercial code on `PYTHONPATH`.

The reverse arrow — commercial code importing community modules — is
expected and supported.

## Building locally

```bash
cd templates
uv build --wheel                              # community wheel
uv build --wheel commercial/                  # commercial wheel
ls dist/
# parthenon_templates-0.1.0-py3-none-any.whl
# parthenon_templates_commercial-0.1.0-py3-none-any.whl
```

## Running tests

The commercial-tier tests live under `templates/tests/unit/commercial/` and
`templates/tests/e2e/commercial/`; they import `runtime.commercial.*`
directly and run as part of the main `pytest` invocation against the
unified worktree. The community-wheel-isolation lane ignores them.
