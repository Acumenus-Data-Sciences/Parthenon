# Community Workbench SDK

The Community Workbench SDK is the canonical starter pack for building optional Parthenon workbench tools.

It exists to make integrations like FINNGEN repeatable, reviewable, and easy to understand without requiring developers to reverse-engineer the existing codebase.

This directory is intentionally structured for two audiences:

- human developers onboarding to the Parthenon workbench pattern
- AI coding assistants that need explicit contracts, file maps, and generation rules

## What This SDK Contains

- `docs/START_HERE.md`
  - the primary onboarding guide
- `docs/ASSET_INDEX.md`
  - a file-by-file map of the SDK contents
- `docs/AI_ASSISTANT_GUIDE.md`
  - direct instructions for AI coding assistants using this SDK
- `docs/RELEASE_PROCESS.md`
  - packaging and release workflow for the distributable archive
- `contracts/`
  - JSON Schemas for required workbench tool envelopes
- `examples/`
  - concrete example payloads that conform to the contracts
- `generated-samples/`
  - checked-in sample scaffolds produced by the generator
- `templates/`
  - tokenized starter templates
- `scripts/new-workbench-tool.sh`
  - generator for stamping a new tool scaffold
- `scripts/verify-contracts.py`
  - lightweight contract and example validation helper
- `scripts/package-release.sh`
  - builds a versioned `.zip` release artifact under `dist/`
- `scripts/refresh-sample-tool.sh`
  - regenerates the checked-in sample tool scaffold
- `MANIFEST.json`
  - machine-readable version and compatibility metadata

## What This SDK Does Not Do

- it does not dynamically install arbitrary plugins into Parthenon at runtime
- it does not bypass normal backend, frontend, or StudyAgent review
- it does not make a generated tool production-ready without adaptation and testing

## Recommended Workflow

1. Read `docs/START_HERE.md`.
2. Read `docs/AI_ASSISTANT_GUIDE.md` if an AI assistant will be used.
3. Run `scripts/new-workbench-tool.sh` to generate a scaffold.
4. Implement the adapter, backend orchestration, and frontend workbench.
5. validate payloads against the schemas in `contracts/`.
6. use the fixtures in `examples/` as payload references for backend and frontend development.
7. build a release artifact with `scripts/package-release.sh` when you are ready to distribute the starter externally.
6. add tests and wire the generated assets into the host repo deliberately.

## Example

```bash
./community-workbench-sdk/scripts/new-workbench-tool.sh \
  --tool-id genomics_variant_browser \
  --display-name "Variant Browser" \
  --description "Explore cohort-scoped genomic variants through a Parthenon workbench." \
  --domain genomics \
  --mode external-adapter \
  --route-slug variant-browser \
  --env-prefix GENOMICS_VARIANT_BROWSER \
  --output-dir /tmp/parthenon-community-tools
```

The command above generates a self-contained scaffold directory for a new tool under the provided output directory.

## Relationship To The FINNGEN Work

This SDK was extracted from the same architectural seams used by the FINNGEN integration:

- optional StudyAgent tool registration
- service registry metadata
- Laravel orchestration and persisted run inspection
- dedicated frontend workbench pages

The goal is to generalize that approach into a reusable pattern for the community.
