# Release Process

## Purpose

This document explains how to package the Community Workbench SDK into a distributable archive and how to verify that the package is still healthy before release.

The SDK release artifact is intended to be:

- easy to share with partners and community developers
- stable enough for offline distribution
- machine-identifiable by version and compatibility metadata

## Canonical Source

The canonical source remains the in-repo SDK directory:

- `community-workbench-sdk/`

The packaged `.zip` is a derived artifact and should not be edited directly.

## What Gets Packaged

The release package includes:

- `README.md`
- `MANIFEST.json`
- `docs/`
- `contracts/`
- `examples/`
- `generated-samples/`
- `templates/`
- `scripts/`

It does not include:

- generated scratch output
- repo-specific temporary files
- unrelated Parthenon source code

## Packaging Script

Use:

```bash
./community-workbench-sdk/scripts/package-release.sh
```

The script will:

1. read the version from `MANIFEST.json`
2. create a clean staging directory
3. copy the supported SDK assets into the staging directory
4. create a versioned `.zip` under `community-workbench-sdk/dist/`

## Output Naming

The current naming convention is:

```text
community-workbench-sdk-v<starter_version>.zip
```

Example:

```text
community-workbench-sdk-v0.1.0.zip
```

## Pre-Release Checklist

Before packaging, run:

```bash
./community-workbench-sdk/scripts/verify-contracts.py
```

Then smoke-test generation:

```bash
./community-workbench-sdk/scripts/new-workbench-tool.sh \
  --tool-id release_smoke_tool \
  --display-name "Release Smoke Tool" \
  --description "Smoke-test scaffold for SDK packaging." \
  --domain validation \
  --mode native \
  --route-slug release-smoke-tool \
  --env-prefix RELEASE_SMOKE_TOOL \
  --output-dir /tmp/community-sdk-release-smoke
```

## CI Expectations

The CI job for the SDK should:

- run the contract verification script
- run the generator with a smoke-test tool id
- confirm the expected generated files exist
- build the release zip

## Release Hygiene

- bump `starter_version` in `MANIFEST.json` when packaging a new release
- update docs if contracts or templates changed materially
- keep examples aligned with schemas
- keep generated output out of the tracked repo unless intentionally checked in as a fixture
