#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    warnings.filterwarnings(
        "ignore",
        message="jsonschema.RefResolver is deprecated",
        category=DeprecationWarning,
    )

    sdk_dir = Path(__file__).resolve().parent.parent
    contracts_dir = sdk_dir / "contracts"
    examples_dir = sdk_dir / "examples"

    contract_paths = sorted(contracts_dir.glob("*.json"))
    example_paths = sorted(examples_dir.glob("*.json"))

    for path in contract_paths + example_paths:
        load_json(path)
        print(f"json ok: {path.relative_to(sdk_dir)}")

    try:
      import jsonschema  # type: ignore
    except ImportError:
        print("jsonschema not installed; skipping schema validation.", file=sys.stderr)
        return 0

    artifact_schema = load_json(contracts_dir / "artifact-manifest.schema.json")
    runtime_schema = load_json(contracts_dir / "runtime-metadata.schema.json")
    service_schema = load_json(contracts_dir / "service-descriptor.schema.json")
    result_schema = load_json(contracts_dir / "result-envelope.schema.json")
    service_example = load_json(examples_dir / "sample-service-descriptor.json")
    result_example = load_json(examples_dir / "sample-result-envelope.json")

    jsonschema.validate(instance=service_example, schema=service_schema)
    print("schema ok: examples/sample-service-descriptor.json")

    store = {
        artifact_schema["$id"]: artifact_schema,
        runtime_schema["$id"]: runtime_schema,
        service_schema["$id"]: service_schema,
        result_schema["$id"]: result_schema,
        (contracts_dir / "artifact-manifest.schema.json").resolve().as_uri(): artifact_schema,
        (contracts_dir / "runtime-metadata.schema.json").resolve().as_uri(): runtime_schema,
        (contracts_dir / "service-descriptor.schema.json").resolve().as_uri(): service_schema,
        (contracts_dir / "result-envelope.schema.json").resolve().as_uri(): result_schema,
    }

    resolver = jsonschema.RefResolver(
        base_uri=(contracts_dir / "result-envelope.schema.json").resolve().as_uri(),
        referrer=result_schema,
        store=store,
    )
    registry = jsonschema.validators.validator_for(result_schema)
    validator = registry(result_schema, resolver=resolver)
    validator.validate(result_example)
    print("schema ok: examples/sample-result-envelope.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
