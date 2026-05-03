# hello_cdm

The canonical "the framework works" demo template for Parthenon ingestion.

## What it does

Bootstraps a minimal OMOP CDM in a target schema, inserts one PERSON row,
and queries it back. The whole flow runs in under 30 seconds on a dev
Postgres 16 instance.

## When to use it

- First template a new developer runs to confirm their environment works.
- Smoke test in CI on every push to `main`.
- Sanity check before debugging a more complex template — if `hello_cdm`
  fails, the framework itself has a problem.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `target_schema` | string | `hello_cdm_demo` | Target OMOP schema name. Must match `^[a-z][a-z0-9_]*$`. Schema is created if absent. |
| `cdm_version` | enum | `5.4` | One of `5.3` or `5.4`. Determines which OMOP DDL is applied. |

## Prerequisites

- `parthenon-templates` service is running and reachable.
- Postgres connection configured with DDL privileges (uses the
  `parthenon_migrator` role per the runtime/migrator split).
- No requirement for vocabulary loads — this template stands on its own.

## Examples

Run via UI: navigate to **Aqueduct → Templates** sub-tab, click `hello_cdm`,
accept defaults, click Run. Within 30s the run shows green with a single
PERSON row in `hello_cdm_demo.person`.

Run via API:

```bash
curl -X POST https://parthenon.acumenus.net/api/v1/ingestion/templates/hello_cdm/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"version":"0.1.0","parameters":{"target_schema":"hello_cdm_demo","cdm_version":"5.4"}}'
```

Run via CLI (dev only):

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run parthenon-nodes run-template hello_cdm \
  --param target_schema=hello_cdm_demo \
  --param cdm_version=5.4
```

## Limitations

- Inserts a single hardcoded PERSON. Not suitable for any data validation
  beyond "the schema works."
- Re-running with the same `target_schema` will fail on the duplicate
  `person_id`. Drop the schema first or use a different target.
- Singleton: false — multiple concurrent runs are allowed, but they will
  fight for the same target schema if you don't vary it.

## License / attribution

The OMOP CDM schema definitions come from `pyomop` (Apache 2.0). The
hardcoded PERSON row is fictional. No real patient data is used.
