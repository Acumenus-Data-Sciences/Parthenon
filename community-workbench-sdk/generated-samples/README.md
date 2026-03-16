# Generated Samples

This directory contains checked-in sample outputs produced by the Community Workbench SDK generator.

## Purpose

These samples exist for three reasons:

- to give developers a concrete reference artifact they can inspect without running the generator first
- to give AI coding assistants a real generated scaffold to study
- to support the in-product Phase 3 demo inside the Parthenon Workbench

## Current Sample

### `community_variant_browser/`

A generated sample tool scaffold for a genomics-oriented workbench tool.

It demonstrates:

- external-adapter mode
- generated service metadata
- generated backend and frontend stubs
- copied contract schemas
- copied AI assistant guidance

## Source Of Truth

These sample files are generated from:

- `community-workbench-sdk/templates/`
- `community-workbench-sdk/contracts/`
- `community-workbench-sdk/docs/`
- `community-workbench-sdk/scripts/new-workbench-tool.sh`

Do not hand-edit the sample unless there is a compelling reason. Prefer regenerating it with the refresh script.

## Refreshing The Sample

Run:

```bash
./community-workbench-sdk/scripts/refresh-sample-tool.sh
```

This regenerates the sample scaffold in place using the current SDK assets.
