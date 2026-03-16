# AI Assistant Guide

This document is written for AI coding assistants and for the developers supervising them.

Its purpose is to make the SDK understandable without requiring inference from the full Parthenon codebase.

## Primary Objective

When using this SDK, the assistant should generate a workbench tool scaffold that is:

- contract-compliant
- optional by default
- source-aware when applicable
- testable
- understandable by humans after generation

## Normative Sources

When there is ambiguity, use these sources in this order:

1. `MANIFEST.json`
2. files in `contracts/`
3. files in `examples/`
4. files in `generated-samples/`
5. this guide
6. `docs/START_HERE.md`
7. the tokenized files in `templates/`

The templates are examples and starting points. The schemas are more authoritative for payload shape.

The checked-in sample under `generated-samples/` is the best reference for what the generator currently emits.

## Non-Normative Sources

The following are helpful but should not override the contracts:

- screenshots
- prose screenshots and UI mockups
- prose examples in README files

## Required Behavioral Rules

### 1. Preserve Contract Boundaries

Do not collapse these responsibilities into one layer:

- StudyAgent: registration and discovery
- backend: validation, permissions, source scoping, persistence
- frontend: workbench rendering and interaction
- adapter or native logic: domain execution

### 2. Do Not Invent Ad Hoc Payload Shapes

If a response shape is needed:

- first consult `contracts/result-envelope.schema.json`
- then `contracts/runtime-metadata.schema.json`
- then `contracts/artifact-manifest.schema.json`
- then inspect `examples/sample-result-envelope.json`

If an additional field is needed, add it consistently across:

- the schema
- the backend shaping code
- the frontend types
- any sample fixture

### 3. Treat Templates As Tokenized Assets

Tokens such as:

- `__TOOL_ID__`
- `__DISPLAY_NAME__`
- `__DESCRIPTION__`
- `__DOMAIN__`
- `__MODE__`
- `__ROUTE_SLUG__`
- `__ENV_PREFIX__`

must be preserved in template files and replaced only in generated outputs.

Do not hand-edit token placeholders into partial or inconsistent names.

### 4. Prefer Conservative Generation

The generator is intentionally non-destructive.

Assistants should:

- generate into a separate directory first
- explain which host files still need manual wiring
- avoid editing unrelated host files automatically unless explicitly asked

### 5. Make Generated Assets Self-Describing

Every generated file should remain understandable to a developer reading it cold.

That means:

- clear names
- concise comments only where helpful
- explicit runtime metadata shaping
- explicit TODO markers where manual integration is required

## Expected Output Of The Generator

A generated tool directory should include enough assets for a developer to understand:

- what the tool is called
- how it is registered
- what route it will live at
- which env vars gate it
- what result payload it returns
- where they still need to integrate it into the host repo

## Host Repo Integration Checklist

An assistant using the generated scaffold should point the developer to these integration points:

- `study-agent/docs/SERVICE_REGISTRY.yaml`
- `study-agent/mcp_server/study_agent_mcp/tools/__init__.py`
- backend controller/service/route registration
- frontend route registration
- any run persistence wiring if needed

## Packaging Rule

Do not treat the generated `.zip` as the source of truth.

If packaging changes are needed:

- modify the canonical assets in `community-workbench-sdk/`
- then rebuild the zip via `scripts/package-release.sh`

## Review Checklist For Supervising Developers

When reviewing AI-generated work from this SDK, confirm that:

- contracts still validate
- env gating is present
- health/unavailability states are explicit
- writes are not hidden
- source scoping exists where required
- frontend types match backend payloads
- placeholders have all been replaced in generated outputs

## Failure Modes To Avoid

- returning raw upstream payloads directly to the UI
- skipping runtime diagnostics
- coupling the frontend directly to an untrusted external API
- generating files directly into unrelated parts of the repo without review
- renaming tokens inconsistently across files

## Recommended Assistant Workflow

1. Read `MANIFEST.json`.
2. Read the schemas in `contracts/`.
3. Read the examples in `examples/`.
4. Read this file.
5. Run the generator.
6. Inspect generated files for unreplaced tokens.
7. Implement adapter/backend/frontend details while preserving the contracts.
8. Add or update tests and fixtures.
