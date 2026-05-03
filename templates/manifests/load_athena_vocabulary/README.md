# load_athena_vocabulary

Loads an OHDSI Athena vocabulary bundle into Parthenon.

## What it does

Reads 7 standard CSVs from an extracted Athena bundle directory
(CONCEPT, CONCEPT_RELATIONSHIP, CONCEPT_ANCESTOR, VOCABULARY, DOMAIN,
CONCEPT_SYNONYM, DRUG_STRENGTH) and loads them into the target schema
through PostgreSQL `COPY FROM STDIN`. Each table is `TRUNCATE`-d and
re-loaded inside a single transaction per file. CPT4 enrichment is
performed by shelling out to the OHDSI `cpt4.jar` utility when the
template parameter `enable_cpt4` is true and the `UMLS_API_KEY`
environment variable is configured on the runtime container.

The bundle's identity is the SHA256 of `CONCEPT.csv`. That digest is
recorded — together with per-table row counts — in
`<schema>.vocabulary_load`. Re-running with the same bundle is a no-op
unless `force=true` is passed.

## When to use it

- First-time vocabulary load after standing up a new Parthenon installation.
- Quarterly Athena bundle refresh.
- Reload after an upstream bundle issue is fixed.

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `bundle_path` | string | _required_ | Absolute path to the extracted Athena bundle directory containing `CONCEPT.csv` etc. Must be readable by the `parthenon-templates` runtime container. |
| `target_vocab_schema` | string | `vocab` | Target schema for vocabulary tables. Created if absent. Must match `^[a-z][a-z0-9_]*$`. |
| `force` | boolean | `false` | When true, re-loads even if the bundle's SHA256 is already recorded in `vocabulary_load`. Required to overwrite an identical bundle. |
| `enable_cpt4` | boolean | `true` | Run `cpt4.jar` to enrich CPT4 codes. Skipped with a warning when `UMLS_API_KEY` is not set or the jar is not present. |

## Prerequisites

- **Bundle download:** the customer must obtain a bundle from
  <https://athena.ohdsi.org/>. Parthenon ships the loader, not the
  vocabulary content. Place the extracted directory at a path readable
  by the `parthenon-templates` container (e.g.
  `/var/parthenon/staging/athena_bundle_2025_q4/`).
- **UMLS API key (optional, for CPT4):** generate one at
  <https://uts.nlm.nih.gov/uts/>. Provide via the platform secrets
  manager and inject as the `UMLS_API_KEY` environment variable on the
  `parthenon-templates` container. **Never hardcode the key in a
  manifest, parameter file, or commit.**
- **Postgres role:** `parthenon_migrator` for DDL on the target schema
  during `CREATE SCHEMA`/`TRUNCATE`. Runtime queries use
  `parthenon_app`.
- **Singleton:** declared `singleton: true` in metadata. Concurrent
  runs are rejected at submit time by `TemplateRunService` (Plan 2).

## Examples

### First load (staging)

```bash
export UMLS_API_KEY=$(vault read -field=api_key secret/umls)

curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_athena_vocabulary/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "bundle_path": "/var/parthenon/staging/athena_bundle_2025_q4",
      "target_vocab_schema": "vocab",
      "force": false,
      "enable_cpt4": true
    }
  }'
```

### Re-load the same bundle after fixing an upstream issue

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_athena_vocabulary/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "bundle_path": "/var/parthenon/staging/athena_bundle_2025_q4",
      "target_vocab_schema": "vocab",
      "force": true,
      "enable_cpt4": true
    }
  }'
```

### Skip CPT4 (no UMLS key available)

```bash
curl -X POST https://parthenon-staging.acumenus.net/api/v1/ingestion/templates/load_athena_vocabulary/runs \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "0.1.0",
    "parameters": {
      "bundle_path": "/var/parthenon/staging/athena_bundle_2025_q4",
      "target_vocab_schema": "vocab",
      "force": false,
      "enable_cpt4": false
    }
  }'
```

### Pre-flight diff against a previous bundle

Before running the loader against production, compare the new bundle to
the previous one with the `parthenon-vocab` CLI shipped from Phase C:

```bash
cd /home/smudoshi/Github/Parthenon/templates
uv run parthenon-vocab diff \
  /var/parthenon/staging/athena_bundle_2025_q3 \
  /var/parthenon/staging/athena_bundle_2025_q4 \
  --output /tmp/athena_2025_q4_delta.json
```

## Limitations

- **Memory and IO:** uses PostgreSQL `COPY FROM STDIN` to stream each
  CSV into the target table. The Postgres host is the bottleneck —
  budget ~1 GB of `maintenance_work_mem` and observe `pg_stat_activity`
  during `concept_ancestor` (largest table).
- **Truncate-and-reload semantics:** each table is `TRUNCATE`-d before
  insert. Any application that holds open foreign-key references to a
  vocab table at the moment the load runs will block on locks. Run
  during a maintenance window.
- **CPT4 binary:** `/opt/parthenon/cpt4.jar` is bundled inside the
  `parthenon-templates` container; verify the build pinned version in
  the runtime Dockerfile. Updating `cpt4.jar` is a separate ops task.
- **Not in CI:** validation runs are user-initiated in staging only
  per devplan §8.
- **Force flag:** required to overwrite an existing identical bundle.
  This prevents accidental no-op re-runs that would lock the schema
  needlessly.

## License / attribution

- Athena vocabulary bundles are distributed by OHDSI under the OHDSI
  vocabulary license. Customers must agree to OHDSI terms before
  downloading.
- CPT4 codes are owned by the AMA. UMLS API access requires individual
  registration at <https://uts.nlm.nih.gov/uts/>.
- Parthenon ships only the loading mechanism; no Athena content is
  distributed in this repository.

## Security notes

- `UMLS_API_KEY` MUST come from the platform secrets manager and be
  injected as an environment variable on the runtime container. The
  template never accepts the key as a parameter and the `python` node
  reads it via `os.environ` only — it is never written to logs or
  artifacts. The `lint-secret-keys` check enforces that any parameter
  named `*_key`/`*_token`/`*_password`/`*_secret` is marked
  `secret: true`.
- `bundle_path` should be confined to the templates storage volume
  (e.g. `/var/parthenon/staging/`). Operators are responsible for
  validating that the path is not user-controlled.
- The `parthenon_migrator` role is the only role with DDL on
  `vocabulary_load` and the seven vocabulary tables. Runtime queries
  use `parthenon_app` (no DDL).
- The CPT4 subprocess is invoked with `subprocess.run([...], check=True)`
  using a list of arguments — no shell interpolation. The API key is
  passed through `os.environ` to a list-form `subprocess`, never into a
  shell string. Future revisions should pipe the key through stdin
  once the OHDSI utility supports it.
