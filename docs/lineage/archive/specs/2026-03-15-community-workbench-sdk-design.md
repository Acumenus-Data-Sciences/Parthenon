# Community Workbench SDK / Starter Kit Design

**Date:** 2026-03-15
**Status:** Proposed
**Audience:** Platform architects, Parthenon core developers, partner developers, community tool authors
**Scope:** Reusable packaging and scaffolding pattern for optional Parthenon workbench tools, starting with the FINNGEN integration model

## Executive Summary

Parthenon should expose a **Community Workbench SDK** that lets developers package new domain tools, legacy applications, and modernization efforts into Parthenon-compatible workbenches without hard-coupling the monolith to each external project.

The right product is **not** a standalone `.zip` as the canonical artifact.

The right product is:

1. a maintained **starter repository / template**
2. a **generator** that stamps project-specific names and contracts into that template
3. a release-built **`.zip` bundle** for low-friction onboarding and offline sharing

The `.zip` is useful, but it should be **derived** from the maintained starter so it does not become a stale fork of platform assumptions.

The FINNGEN work already demonstrates the correct architecture seam:

- optional MCP tool registration in `study-agent/mcp_server/study_agent_mcp/tools/__init__.py`
- service declaration and UI hints in `study-agent/docs/SERVICE_REGISTRY.yaml`
- Laravel orchestration and persistence in `backend/app/Http/Controllers/Api/V1/StudyAgentController.php`
- tool-domain orchestration in `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php`
- dedicated frontend workbench route under `frontend/src/app/router.tsx`

This SDK should generalize those seams into a stable, documented, reusable pattern.

## Goals

- Allow third parties to build Parthenon-native workbench tools quickly.
- Allow teams to wrap existing research applications behind a safer adapter boundary.
- Keep optional tooling isolated from core Parthenon runtime assumptions.
- Standardize service discovery, health checks, payload contracts, frontend UX, persistence, and governance.
- Provide a migration path for both:
  - external applications being modernized into Parthenon
  - net-new workbench tools built directly for Parthenon

## Non-Goals

- Ship arbitrary external code directly into the monolith.
- Let community tools bypass authorization, source scoping, or auditability.
- Treat generated starter files as production-ready without further validation.
- Define a plugin system with unrestricted runtime code loading inside Laravel or the frontend bundle.

## Design Principles

### 1. Optional, Never Entangled

Community tools must be:

- disabled by default
- enabled via explicit configuration
- discoverable via registry metadata
- hidden or marked unavailable when unhealthy
- removable without destabilizing core product behavior

### 2. Contract First

Every tool must publish stable contracts for:

- service identity
- input schema
- output schema
- runtime metadata
- artifact manifest
- health and readiness status

The external app or adapter implementation is secondary. Parthenon integrates to the contract, not to ad hoc endpoint behavior.

### 3. Safe-by-Default Execution

Tool execution must be:

- source-scoped
- permission-checked
- auditable
- replayable when possible
- reviewable before any write-capable or destructive step

### 4. UX Is Part of the Contract

The community should not be handed raw API forms and told that is “integration.”

Each starter must include:

- a catalog card
- a workbench shell
- runtime diagnostics
- result visualization placeholders
- artifact inspection surfaces
- empty/loading/error states

### 5. Generated, Not Hand-Copied

Developers should not rename dozens of identifiers by hand. The starter must be generated from tokens and templates.

## Why A Starter Repo + Generator + Zip

### Problems With A Zip-Only Model

- versions drift immediately after download
- bug fixes do not propagate
- hidden assumptions are frozen into copied files
- teams hand-edit identifiers inconsistently
- no reliable upgrade story exists

### Benefits Of A Canonical Starter

- one source of truth
- controlled template evolution
- better docs and test coverage
- deterministic release packaging
- clearer governance and compatibility guarantees

### Role Of The Zip

The `.zip` is still valuable for:

- community outreach
- hackathons
- partner onboarding
- regulated/offline environments
- easy distribution from docs or release pages

But it should be emitted from CI from a tagged starter release, not maintained separately.

## Proposed Deliverables

The Community Workbench SDK should ship as four deliverables.

### 1. Starter Repository

Canonical repository, for example:

- `parthenon-community-workbench-starter`

Contents:

- tokenized backend, frontend, and study-agent scaffolding
- example tool implementation
- docs
- contract schemas
- tests
- packaging script

### 2. Generator CLI

Examples:

```bash
./scripts/new-workbench-tool.sh \
  --tool-id genomics_variant_browser \
  --display-name "Variant Browser" \
  --domain genomics \
  --mode external-adapter
```

The generator should replace tokens such as:

- `__TOOL_ID__`
- `__DISPLAY_NAME__`
- `__SERVICE_ENV_PREFIX__`
- `__ROUTE_SLUG__`
- `__ACCENT_COLOR__`
- `__WORKSPACE_KIND__`

### 3. Release Zip

Generated artifact:

- `parthenon-community-workbench-starter-vX.Y.Z.zip`

This should contain:

- starter source
- getting-started guide
- env template
- example fixtures
- sample screenshots
- compatibility matrix

### 4. Authoring Documentation

Docs should cover:

- when to use external adapter mode vs native mode
- required contracts
- required tests
- release and compatibility expectations
- security review checklist
- UX checklist

## Integration Modes

The starter should support two explicit modes.

### Mode A: External Adapter Mode

Use when the developer already has:

- a Shiny app
- FastAPI service
- Flask service
- Plumber API
- legacy API-backed tool
- pipeline runner or workflow service

Pattern:

- external system remains the execution engine
- Parthenon speaks to it through MCP tools or a backend adapter
- Parthenon owns discovery, permissions, source scoping, UX, audit, and persistence

This is the right default for FINNGEN-style integrations.

### Mode B: Native Parthenon Mode

Use when the developer wants to implement the tool directly inside:

- StudyAgent / Python services
- Laravel orchestration
- React workbench UI

Pattern:

- no separate external runtime required
- tool logic lives in Parthenon-owned components
- still follows the same service registry and workbench contract

This is appropriate for tools that are lightweight, deterministic, and already aligned with Parthenon internals.

## Required Architectural Shape

Every community workbench tool should implement the following layers.

### 1. Service Registry Layer

Register metadata in the service registry so ACP and frontend discovery can reason about the tool.

Minimum fields:

- service key
- endpoint
- description
- mcp tool ids
- input fields
- output fields
- validation notes
- UI hints
- repository URL
- workspace category
- availability gating notes

This mirrors the existing FINNGEN entries in [SERVICE_REGISTRY.yaml](/home/smudoshi/Github/Parthenon/study-agent/docs/SERVICE_REGISTRY.yaml).

### 2. Tool Registration Layer

Tool modules must be conditionally registered via env gating and, ideally, health validation.

The FINNGEN pattern in [tools/__init__.py](/home/smudoshi/Github/Parthenon/study-agent/mcp_server/study_agent_mcp/tools/__init__.py) already provides the baseline; the SDK should improve it by formalizing:

- env-enabled check
- config-valid check
- health probe check
- structured unavailability reason

### 3. Backend Orchestration Layer

Laravel should provide:

- a proxy/controller surface for the frontend
- input validation
- source resolution
- permission enforcement
- persisted run history
- replay/export support where feasible
- structured error normalization

This generalizes the current FINNGEN orchestration in [StudyAgentController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/StudyAgentController.php).

### 4. Domain Workbench Service Layer

Each tool should have a service class responsible for:

- payload shaping
- adapter invocation
- fallback behavior
- runtime diagnostics
- artifact indexing
- result normalization

This generalizes [FinnGenWorkbenchService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/StudyAgent/FinnGenWorkbenchService.php).

### 5. Frontend Workbench Layer

Each tool must ship with:

- route registration
- page shell
- service status badge
- run form or task builder
- result tabs or panels
- persisted run inspector
- replay/export actions when supported

The route pattern already exists in [router.tsx](/home/smudoshi/Github/Parthenon/frontend/src/app/router.tsx).

## Starter Repository Layout

```text
community-workbench-starter/
  README.md
  LICENSE
  COMPATIBILITY.md
  .env.example
  scripts/
    new-workbench-tool.sh
    package-release.sh
    verify-contracts.sh
  templates/
    service-registry.entry.yaml.tpl
    mcp-tool.py.tpl
    adapter.py.tpl
    laravel-controller.php.tpl
    laravel-service.php.tpl
    frontend-page.tsx.tpl
    frontend-api.ts.tpl
    frontend-types.ts.tpl
    test-backend.php.tpl
    test-frontend.tsx.tpl
  example-tool/
    docs/
    fixtures/
    screenshots/
  contracts/
    tool-service.schema.json
    tool-runtime.schema.json
    tool-artifact-manifest.schema.json
    tool-result-envelope.schema.json
  integration/
    study-agent/
      docs/
        SERVICE_REGISTRY.example.yaml
      mcp_server/
        study_agent_mcp/
          tools/
            __tool_id__.py
          adapters/
            __tool_id__.py
    backend/
      app/
        Http/Controllers/Api/V1/
          __ToolName__Controller.php
        Services/Workbench/
          __ToolName__WorkbenchService.php
        Models/App/
          WorkbenchToolRun.php
      database/migrations/
        2026_01_01_000000_create_workbench_tool_runs_table.php
      routes/
        api.workbench-tool.example.php
    frontend/
      src/features/workbench-template/
        api/
        components/
        hooks/
        pages/
        types/
  docs/
    AUTHORING.md
    EXTERNAL_ADAPTER_MODE.md
    NATIVE_MODE.md
    SECURITY_CHECKLIST.md
    UX_CHECKLIST.md
    RELEASE_PROCESS.md
```

## Starter Output Layout Inside Parthenon

After generation, a tool should land in a consistent structure such as:

```text
study-agent/
  mcp_server/study_agent_mcp/tools/community_variant_browser.py
  mcp_server/study_agent_mcp/adapters/community_variant_browser.py
  docs/SERVICE_REGISTRY.yaml

backend/
  app/Http/Controllers/Api/V1/CommunityVariantBrowserController.php
  app/Services/Workbench/CommunityVariantBrowserService.php
  app/Models/App/WorkbenchToolRun.php
  routes/api.php

frontend/src/features/community-variant-browser/
  api/communityVariantBrowserApi.ts
  hooks/useCommunityVariantBrowser.ts
  pages/CommunityVariantBrowserPage.tsx
  components/CommunityVariantBrowserWorkbench.tsx
  types/communityVariantBrowser.ts
```

## Standard Contracts

The SDK should define four required envelopes.

### 1. Service Descriptor

Fields:

- `service_name`
- `display_name`
- `version`
- `description`
- `mode` (`external_adapter` or `native`)
- `enabled`
- `healthy`
- `unavailability_reason`
- `ui_hints`
- `permissions`
- `source_requirements`
- `capabilities`

### 2. Runtime Metadata Envelope

Fields:

- `status`
- `adapter_mode`
- `fallback_active`
- `upstream_ready`
- `dependency_issues`
- `notes`
- `timings`
- `last_error`

### 3. Result Envelope

Fields:

- `status`
- `runtime`
- `source`
- `summary`
- `panels`
- `artifacts`
- `warnings`
- `next_actions`

### 4. Artifact Manifest

Fields:

- `artifacts[].id`
- `artifacts[].label`
- `artifacts[].kind`
- `artifacts[].content_type`
- `artifacts[].path`
- `artifacts[].summary`
- `artifacts[].downloadable`
- `artifacts[].previewable`

These contracts should be published as JSON Schema in the starter repository.

## Generated Files In The Zip

The generated `.zip` should include:

- `README.md`
- `GETTING_STARTED.md`
- `ARCHITECTURE.md`
- `COMPATIBILITY.md`
- `.env.example`
- generated source files
- fixture payloads
- screenshots
- schema files
- security checklist
- test checklist
- release notes template

It should also include a top-level `MANIFEST.json`:

```json
{
  "starter_version": "1.0.0",
  "parthenon_compatibility": "^1.0",
  "tool_mode": "external_adapter",
  "generated_on": "2026-03-15",
  "contracts_version": "1.0.0"
}
```

## Generator Inputs

The generator should require:

- tool id
- display name
- short description
- domain
- mode
- backend route slug
- env prefix
- repository URL
- accent color token
- primary visualization type

Optional inputs:

- supports run persistence
- supports replay
- supports export
- supports source scoping
- supports write operations
- supports fallback mode

## Security Requirements

Every generated tool must include a security review checklist.

### Required Controls

- explicit source scoping
- authenticated access only
- role/permission checks for execution
- deny-by-default writes
- confirmation gates before write-capable actions
- normalized error output that does not leak secrets
- audit trail for submitted runs
- artifact classification for sensitive outputs
- timeout and retry policy
- network target allowlisting for external adapters

### Forbidden Patterns

- direct frontend calls to untrusted external systems
- arbitrary shell execution from request inputs
- storing raw secrets in service registry metadata
- invisible write operations
- unbounded background execution without status tracking

## UX Best Practices

The starter should include opinionated UX conventions.

### Catalog Expectations

- visible title and purpose
- availability status
- health summary
- prerequisites
- supported sources or domains

### Workbench Expectations

- source selector if source-scoped
- compact execution form
- runtime diagnostics panel
- summary card row
- visualization tab set
- artifacts panel
- warnings panel
- empty state with setup guidance

### Error Handling Expectations

- configuration error state
- upstream unhealthy state
- source incompatible state
- validation failure state
- execution failure state

Each state should have:

- a concise explanation
- next recommended action
- optional diagnostics detail

## Persistence Model

The SDK should standardize a persisted run record similar to the current FINNGEN runs.

Suggested fields:

- `service_name`
- `display_name`
- `source_id`
- `source_snapshot`
- `request_payload`
- `result_payload`
- `runtime_payload`
- `artifact_index`
- `status`
- `submitted_at`
- `completed_at`
- `created_by`

Optional fields:

- `upstream_job_id`
- `correlation_id`
- `replay_supported`
- `export_supported`

## Testing Requirements

Every generated tool should include test stubs across all layers.

### Study-Agent Tests

- tool registration when enabled
- tool absence when disabled
- health probe behavior
- schema conformance for result envelope

### Backend Tests

- request validation
- permission enforcement
- source resolution
- error normalization
- run persistence
- replay/export behavior where supported

### Frontend Tests

- page renders with service metadata
- loading state
- unavailable state
- successful result rendering
- persisted run inspection
- error state rendering

### Contract Tests

- example payload validates against schemas
- registry metadata validates against schema
- artifact manifest validates against schema

## Versioning And Compatibility

This starter should use semantic versioning with an explicit compatibility matrix.

Track:

- starter version
- contract schema version
- minimum Parthenon version
- tested Parthenon version range

Recommended policy:

- patch: docs/test/template fixes, no contract break
- minor: additive fields, additive scaffolding
- major: breaking contract or layout changes

## Governance Model

Community tooling succeeds only if boundaries are clear.

### Core Team Owns

- starter templates
- schemas
- generator
- packaging process
- compatibility guarantees

### Community Authors Own

- domain logic
- upstream adapters
- result quality
- domain documentation
- maintenance of their specific tool

### Acceptance Criteria For Official Listing

- contracts implemented
- tests included
- security checklist completed
- source scoping implemented where applicable
- no hidden write behavior
- docs and screenshots provided

## Recommended First SDK Scope

The initial SDK should be intentionally narrow.

### Include In v1

- one external-adapter starter
- one native-tool starter
- run persistence scaffold
- service registry entry template
- frontend workbench shell
- release zip packaging
- contract schemas
- authoring docs

### Defer To v2

- multi-tool bundles
- background job orchestration framework
- marketplace/discovery UI
- one-click installer from remote registries
- signed package verification

## Mapping FINNGEN To This SDK

FINNGEN is the reference implementation for the starter.

### FINNGEN Shows

- optional registration model
- service metadata pattern
- backend orchestration pattern
- persisted run inspection
- workbench-oriented frontend surface

### FINNGEN Should Be Refactored Toward

- formal JSON Schemas for result/runtime/artifact envelopes
- generalized workbench run model naming
- reusable availability checker utilities
- reusable frontend workbench shell components
- shared generator tokens rather than hand-authored duplication

## Concrete Recommendation

Proceed with a **Community Workbench SDK** initiative, not a loose `.zip` initiative.

Deliver the following in order:

1. extract the FINNGEN integration seams into reusable templates
2. define schemas for service, runtime, result, and artifact contracts
3. build a small generator that stamps a new workbench tool
4. package the generated starter as a versioned `.zip`
5. publish authoring and security guidance alongside it

That approach gives the developer community something usable immediately while preserving platform discipline and upgradeability.

## Implementation Backlog

### Phase 1: Formalize Contracts

- create JSON Schemas for service, runtime, result, and artifact envelopes
- add schema validation to sample fixtures
- document required and optional fields

### Phase 2: Extract Starter Templates

- lift reusable patterns from FINNGEN backend/frontend/study-agent code
- replace hard-coded names with generator tokens
- create one example tool

### Phase 3: Build Generator

- implement `new-workbench-tool.sh`
- support external-adapter and native modes
- emit setup checklist after generation

### Phase 4: Package Zip

- create packaging script
- include manifest, docs, fixtures, screenshots, and compatibility metadata
- publish zip from tagged release

### Phase 5: Harden And Govern

- add CI validation for templates and example payloads
- add author checklist
- add acceptance policy for official community tools

## Success Criteria

- a developer can generate a new workbench tool in under 30 minutes
- a partner can wrap an existing app without modifying core product architecture
- optional tools fail closed and remain removable
- every tool exposes consistent diagnostics and result envelopes
- generated tools include enough UX structure to feel native inside Parthenon

