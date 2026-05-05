# ADR 0003: Template Manifest Format

## Status

Accepted — 2026-05-02.

## Context

A Parthenon template is the unit a researcher selects from the Aqueduct
catalog. Phase 0 needs a declarative format so that:

* Catalog listing is cheap (no Python execution required to introspect).
* Parameters can be rendered with a generic JSON Schema form library on the
  frontend.
* CI can lint manifests at commit time.
* Authors can hand-write manifests; tooling does not generate them.
* Manifests carry enough metadata for Phase 0's `app.template_runs` row
  (id, version, category, cdm_versions, singleton).

## Decision

Manifests are YAML files at `templates/manifests/{template_id}/manifest.yaml`
and conform to JSON Schema 2020-12 published at
`templates/runtime/registry/schema/template.v1.json`.

Top-level shape:

```yaml
apiVersion: parthenon.acumenus.net/v1
kind: Template
metadata:
  id: <snake_case_id>
  name: <human readable>
  version: <semver>
  category: ingestion | vocabulary | diagnostic | analytic | transform
  cdm_versions: ["5.3" | "5.4" | "oncology_ext"]
  tags: [...]
  author: ...
  singleton: false
spec:
  parameters:
    type: object
    properties:
      <name>: <JSON Schema fragment, optional `secret: true`>
    required: [...]
  requires:
    cdm_initialized: false
    vocabularies: [...]
  nodes:
    - node_id: <snake_case>
      type: <one of the 8 bootstrap node types>
      params: {...}
      depends_on: [...]
  post_conditions:
    - kind: <row_count | dqd_check | sql_predicate>
      params: {...}
```

Loader pipeline (`runtime/registry/manifest.py`):

1. PyYAML parses the file (loose).
2. JSON Schema 2020-12 validates the shape.
3. Pydantic v2 model `Manifest` provides typed access (`extra="forbid"`).

Materialization (`runtime/registry/materializer.py`) does:

1. Validate user-supplied `parameters` against `spec.parameters` JSON Schema.
2. Redact secret-shaped values (explicit `secret: true` or names matching
   `*_key|*_token|*_password|*_secret`) before they enter the FlowSpec echo.
3. Build a `FlowSpec` (one `FlowNode` per `spec.nodes` entry) and call
   `FlowSpec.validate()` to reject cycles and unknown dependencies.

CI enforcement:

* `parthenon-templates validate-manifests --root templates/manifests`
  is run in `.github/workflows/templates.yml` and the pre-commit hook.
* `parthenon-templates lint-secret-keys` enforces that `*_token`-shaped
  parameters declare `secret: true`.

## Consequences

* New node types require: (a) a new `Node` subclass, (b) extending the
  `enum` in `template.v1.json`, (c) extending `NODE_REGISTRY`. This is
  intentional friction — manifest authors should not invent node types.
* Manifests can be generated from external tools (Aqueduct's visual canvas in
  Phase 1+) and remain valid against the schema.
* Versioning: when v2 of the schema is required, copy `template.v1.json` to
  `template.v2.json` and select via the `apiVersion` field; old manifests
  continue to validate against v1.
* Secret redaction is the *responsibility of the Python service*, not Laravel,
  to ensure secrets never enter the database write path.

## Alternatives considered (declined)

* JSON manifests — declined: YAML is more author-friendly for multi-line
  parameter blocks (e.g., inline SQL).
* Python-class manifests (subclass `Template`) — declined: duplicates the node
  SDK's class hierarchy and breaks declarative listing.
* Pure JSON Schema (no Pydantic layer) — declined: Pydantic provides typed
  access from Python, faster than re-parsing dicts everywhere.

## References

* Spec §7 (Database schema), §6 (Authentication chain — secret handling).
* Devplan T-003.
* JSON Schema 2020-12: https://json-schema.org/draft/2020-12/release-notes.html
