# `load_imaging_vocabulary` — Phase 1 template

Loads the JAMIA-derived DICOM-to-OMOP vocabulary (5,183 DICOM attributes +
3,628 coded values) into a Parthenon-namespaced concept_id range so the
`etl_dicom_metadata` template (and any future imaging templates) can resolve
concept IDs without colliding with future Athena releases.

## What it does

1. Downloads a pinned snapshot of the JAMIA reference mapping bundle (zip).
2. Extracts CONCEPT.csv and supporting tables from the bundle.
3. Idempotently loads the rows into `vocab.concept` and `vocab.vocabulary`,
   re-keying each concept_id to start at the configured `concept_id_start`
   (default `2_000_000_000`) so the load is portable across deployments.
4. Records a one-row `imaging_vocab_summary.json` artifact showing
   `(vocabulary_id, concept_count)` for the run.

## When to use it

Run this template **once** before running `etl_dicom_metadata` for the first
time, OR whenever you intentionally bump the upstream JAMIA snapshot. Re-runs
with the same `source_url` are no-ops aside from refreshing the rows (the
template DELETEs prior `Parthenon-Imaging` rows before INSERTing fresh ones).

`load_imaging_vocabulary.singleton: true` is set in the manifest, so the
Plan 2 service won't allow two concurrent runs of this template.

## Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `source_url` | string | yes | Parthenon mirror v0.1.0 | URL of the JAMIA-derived CSV bundle (zip). Override to load a newer snapshot. |
| `vocab_schema` | string | yes | `vocab` | OMOP vocabulary schema name. |
| `concept_id_start` | integer | no | `2000000000` | First concept_id in the Parthenon namespace. Range: `[2_000_000_000, 2_099_999_999]`. |
| `vocabulary_id` | string | no | `Parthenon-Imaging` | Vocabulary identifier inserted into `vocab.vocabulary`. |

## Prerequisites

- Parthenon CDM v5.3 or v5.4 initialized.
- Network access to the `source_url` from the templates service container.
- DB credentials with INSERT/DELETE on `vocab.concept` and INSERT on `vocab.vocabulary`.

## Examples

Submit via the Aqueduct UI:

1. Open Aqueduct → Templates.
2. Select **Load DICOM Imaging Vocabulary (JAMIA)**.
3. Accept defaults (or paste your own `source_url`) and click **Run**.
4. Watch the Runs sub-tab for completion (~2 minutes for ~9k concepts).

Submit via the API:

```bash
curl -X POST \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d @templates/manifests/load_imaging_vocabulary/validation/inputs/parameters.json \
  http://parthenon-templates:8000/v1/templates/load_imaging_vocabulary/runs
```

## Limitations

- The JAMIA bundle is **pinned to upstream v0.1.0** in this template's default;
  bumping requires updating the manifest `source_url` default and re-running.
  Auto-tracking upstream releases is out of scope (devplan §4 Phase 1).
- Re-keying concept_ids means you cannot directly use the JAMIA reference's
  example queries with their hardcoded concept_ids; map through `concept_code`
  instead.
- The template does NOT load `concept_relationship` rows in v0.1.0. Adding
  relationship rows is a follow-up; track via the JAMIA snapshot README.

## License / attribution

The JAMIA mapping is published under the JAMIA article (Nagy et al., 2025)
and the reference repo `paulnagy/DICOM2OMOP`. The mapping is in the public
domain as a derivative of the DICOM standard (publicly available) and the
OMOP CDM (Apache 2.0). Parthenon's mirror release is a **content snapshot**
of that public mapping; we don't relicense.

If you bump to a newer upstream commit, verify the upstream license terms
have not changed before redistributing your derivative.

## Security notes

- The `source_url` is HTTPS-only by default; the Parthenon mirror release is
  the integrity anchor (GitHub releases are signed by Parthenon's CI).
- The template runs against the `Parthenon-Imaging` rows only — it never
  modifies or deletes Athena-sourced concepts, so a misconfigured run cannot
  corrupt the rest of the vocabulary.
- Database credentials come from `context.db_dsn` (configured per
  deployment); never hardcoded in the manifest.
