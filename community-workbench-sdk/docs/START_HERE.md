# Community Workbench SDK: Start Here

## Purpose

This SDK helps developers create optional, contract-driven workbench tools that feel native inside Parthenon.

It is designed for two common cases:

1. wrapping an existing research or analytics application behind a Parthenon-compatible adapter
2. building a new Parthenon-native tool that still follows the same discovery, orchestration, and UX patterns

## Core Rule

Parthenon integrates to **stable contracts**, not to arbitrary app internals.

Every tool generated from this SDK should preserve these boundaries:

- StudyAgent handles tool registration and service discovery
- Laravel handles request validation, permissions, source scoping, audit, and persistence
- the frontend handles workbench UX, diagnostics, and result presentation
- the external adapter or native implementation handles domain execution logic

## Recommended Reading Order

1. `README.md`
2. `docs/ASSET_INDEX.md`
3. `docs/AI_ASSISTANT_GUIDE.md`
4. `contracts/`
5. `templates/`
6. `examples/`
7. `scripts/new-workbench-tool.sh --help`

## Directory Overview

### `contracts/`

Machine-readable schemas for the canonical envelopes used by workbench tools.

Use these to:

- shape API responses
- validate fixtures
- keep backend and frontend aligned
- give AI assistants concrete output expectations

### `templates/`

Tokenized source files used by the generator. These are not production code by themselves. They are starting points.

### `examples/`

Concrete example payloads that illustrate the intended use of the contracts.

These examples are useful for:

- frontend stub development
- backend response shaping
- AI assistant grounding
- schema validation

### `generated-samples/`

Real generated scaffolds checked into the repo for inspection and demo purposes.

These are useful when you want to compare:

- tokenized templates
- generated output
- the in-product Workbench demo page

### `scripts/`

Helper scripts, starting with the generator that stamps a scaffold from the templates.

Release-related scripts are also kept here so packaging remains close to the canonical SDK assets.

### `docs/`

Human- and AI-readable guidance explaining how the pieces fit together.

## Generation Workflow

### Step 1: Choose The Integration Mode

Use `external-adapter` when:

- the tool already exists outside Parthenon
- the logic depends on another runtime or service
- you want Parthenon to orchestrate, not reimplement, the tool

Use `native` when:

- the tool logic can live safely inside Parthenon-owned services
- no separate runtime is required
- deterministic in-platform execution is preferred

### Step 2: Generate The Scaffold

Run:

```bash
./community-workbench-sdk/scripts/new-workbench-tool.sh --help
```

Then generate a tool into a scratch directory before merging it into the host repo.

### Step 3: Implement The Contracts

At minimum, implement:

- service descriptor metadata
- runtime metadata envelope
- result envelope
- artifact manifest

### Step 4: Integrate Into Parthenon

Wire the generated files into:

- `study-agent/docs/SERVICE_REGISTRY.yaml`
- `study-agent/mcp_server/study_agent_mcp/tools/__init__.py`
- backend routes/controllers/services
- frontend route registration and page discovery

### Step 5: Add Tests

Add tests for:

- registration and health gating
- request validation
- source resolution
- runtime diagnostics
- result rendering
- unavailable/error states
- example payload conformance
- packaging output generation

## Best Practices

- prefer coarse-grained tool operations over overly chatty endpoint surfaces
- fail closed when configuration or health checks are incomplete
- keep writes opt-in and confirmation-gated
- persist runs when outputs need replay, inspection, export, or audit
- keep result payloads shaped for the UI, not raw upstream dumps
- include realistic fixture payloads early so frontend work is not blocked by backend timing

## Intended Relationship To AI Coding Assistants

This SDK is explicitly documented so AI assistants can:

- identify which assets are normative
- avoid inventing ad hoc payload shapes
- understand where generated code stops and host integration begins
- safely modify templates without breaking the token model

Use `docs/AI_ASSISTANT_GUIDE.md` as the operating guide for that workflow.
