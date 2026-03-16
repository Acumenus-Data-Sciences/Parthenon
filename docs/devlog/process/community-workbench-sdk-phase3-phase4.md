# Community Workbench SDK Phase 3-4 Devlog

**Date:** 2026-03-15
**Status:** Implemented and paused for later continuation
**Scope:** Promote the Community Workbench SDK from documentation and packaging into a discoverable, in-product Workbench experience with a real backend demo endpoint and a checked-in generated sample tool.

## Executive Summary

This devlog captures the work completed after the initial Community Workbench SDK design and starter-pack implementation.

At the end of this slice, Parthenon now has:

- a canonical Community Workbench SDK in-repo
- JSON Schemas, templates, generator scripts, example payloads, packaging scripts, and CI validation
- a checked-in generated sample scaffold: `community_variant_browser`
- a documentation page served through the Parthenon docs site at `/docs/community-workbench-sdk`
- a top-level Workbench link to that SDK documentation
- a dedicated in-product demo route at `/workbench/community-sdk-demo`
- a real backend endpoint serving the demo payload
- a promoted optional community sample tool visible in Workbench discovery
- a clear UI stub for the future full execution surface

The sample tool is **discoverable** and **demonstrable**, but it is **not yet a first-class executable Workbench flow** like the FINNGEN tools. That gap is intentional and is now documented as the next slice.

## Why This Work Was Needed

The earlier SDK work proved the template, packaging, and documentation path. What remained missing was proof that the SDK could become a visible product surface inside Parthenon instead of staying a repository-only artifact.

There were four concrete needs:

1. make the SDK reachable from the actual Workbench UI
2. expose a real sample scaffold generated from the SDK
3. feed the in-product demo from a real backend endpoint instead of static frontend-only data
4. promote the sample into Workbench discovery so the community tool concept is visible alongside the FINNGEN path

## What Was Added

### 1. Workbench Header Link

The Workbench page now exposes a top-level link:

- label: `Community Workbench SDK`
- target: `/docs/community-workbench-sdk`

This was added to:

- [FinnGenToolsPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/finngen/pages/FinnGenToolsPage.tsx)

This ensures the SDK is discoverable from the exact place where developers and advanced users encounter optional tool orchestration.

### 2. Docusaurus Documentation Page

A real docs page was added so the Workbench link points to something durable and human-readable:

- [14f-community-workbench-sdk.mdx](/home/smudoshi/Github/Parthenon/docs/site/docs/part4-analyses/14f-community-workbench-sdk.mdx)

This page explains:

- what the SDK is
- why it exists
- what assets it includes
- how it relates to the FINNGEN integration
- how developers and AI assistants should use it

### 3. In-Product SDK Demo Route

A dedicated frontend route was added:

- `/workbench/community-sdk-demo`

Backed by:

- [router.tsx](/home/smudoshi/Github/Parthenon/frontend/src/app/router.tsx)
- [CommunityWorkbenchSdkDemoPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/pages/CommunityWorkbenchSdkDemoPage.tsx)

The demo page shows:

- sample service descriptor
- sample normalized result envelope
- integration checklist
- generated artifact inventory
- direct links back to Workbench and SDK docs

Initially this page rendered static example payloads. That was sufficient for Phase 3 but not sufficient for an end-to-end reference path.

### 4. Generated Sample Tool Scaffold

A real sample scaffold was generated and checked into the repo:

- [community_variant_browser](/home/smudoshi/Github/Parthenon/community-workbench-sdk/generated-samples/community_variant_browser)

This sample includes:

- generated README
- generated start guide
- copied contract schemas
- copied AI assistant guidance
- generated backend and frontend template outputs
- generated service registry fragment

Supporting files were added:

- [generated-samples/README.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/generated-samples/README.md)
- [refresh-sample-tool.sh](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/refresh-sample-tool.sh)

The sample is now treated as a maintained artifact, not a one-time byproduct.

### 5. Packaging And CI Inclusion Of Generated Samples

The SDK packaging flow now includes generated samples, and CI/local checks now refresh and validate them.

Updated assets include:

- [package-release.sh](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/package-release.sh)
- [ci.yml](/home/smudoshi/Github/Parthenon/.github/workflows/ci.yml)
- [Makefile](/home/smudoshi/Github/Parthenon/Makefile)

This means the release zip now contains:

- docs
- contracts
- examples
- templates
- scripts
- generated sample scaffold

### 6. Real Backend Demo Endpoint

The frontend demo page is now fed by a real backend endpoint rather than hardcoded only in React.

Endpoint:

- `GET /api/v1/study-agent/community-workbench-sdk/demo`

Added through:

- [StudyAgentController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/StudyAgentController.php)
- [CommunityWorkbenchSdkDemoService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/StudyAgent/CommunityWorkbenchSdkDemoService.php)
- [api.php](/home/smudoshi/Github/Parthenon/backend/routes/api.php)

This endpoint returns:

- `service_descriptor`
- `result_envelope`
- `generated_sample`

Notably, the `generated_sample.files` list is computed from the real checked-in sample scaffold directory so the demo is tied to an actual generated artifact rather than a manually duplicated list.

### 7. Frontend Hook/API For The Demo Endpoint

To consume the backend payload cleanly, the frontend now includes:

- [api.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/api.ts)
- [useCommunityWorkbenchSdkDemo.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/hooks/useCommunityWorkbenchSdkDemo.ts)

The demo page now:

- shows a backend-driven loading state
- shows a backend-driven error state
- renders backend-provided service/result/sample payloads

This is the minimum viable end-to-end reference path for community tool integration inside Parthenon.

### 8. Promotion Into Workbench Discovery

The sample community tool is now appended to the service list returned by:

- `GET /api/v1/study-agent/services`

This is done in:

- [StudyAgentController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/StudyAgentController.php)

using:

- `CommunityWorkbenchSdkDemoService::serviceEntry()`

This makes the sample visible to the Workbench without requiring the Python StudyAgent service to know about the community sample directly.

On the frontend:

- `fetchFinnGenServices()` was broadened to retain both `finngen_*` and `community_*` entries
- `FinnGenToolsPage.tsx` now renders a **Community Tool Spotlight** section
- the sample tool appears as a discovery card called `Community Variant Browser`
- the card links to the demo route and SDK docs

This was a deliberate design choice:

- FINNGEN tools remain tab-driven and execution-oriented
- community samples are visible as spotlight/discovery cards first
- the sample is promoted without forcing the current FINNGEN tab renderer to become a generalized plugin surface prematurely

## Stub Added For Later Continuation

A deliberate UI stub was added to the community tool card:

- `Execution Surface Stub`

Location:

- [FinnGenToolsPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/finngen/pages/FinnGenToolsPage.tsx)

Purpose:

- make the missing next step explicit in-product
- provide a stable placeholder for later implementation
- signal that the sample tool is promoted into discovery but not yet promoted into an executable Workbench surface

This is the correct stopping point for now because it avoids pretending the sample tool is fully executable when it is not.

## Tests Added Or Updated

### Backend

- [CommunityWorkbenchSdkDemoTest.php](/home/smudoshi/Github/Parthenon/backend/tests/Feature/Api/V1/CommunityWorkbenchSdkDemoTest.php)

Coverage:

- demo endpoint returns expected payload
- `/study-agent/services` appends the community sample tool

### Frontend

- [FinnGenToolsPage.test.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/finngen/pages/__tests__/FinnGenToolsPage.test.tsx)
- [CommunityWorkbenchSdkDemoPage.test.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/pages/__tests__/CommunityWorkbenchSdkDemoPage.test.tsx)

Coverage:

- Workbench top-level SDK link
- community spotlight visibility
- sample tool discovery card
- demo route rendering
- demo route links and sample inventory rendering

### Validation / Packaging

Still in place and verified:

- [verify-contracts.py](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/verify-contracts.py)
- [package-release.sh](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/package-release.sh)
- [refresh-sample-tool.sh](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/refresh-sample-tool.sh)

## What Is Live Now

As of this devlog, the following behavior is live:

- Workbench page contains a top-level `Community Workbench SDK` docs link
- Workbench page contains a `Community Tool Spotlight` section
- `Community Variant Browser` appears as a discovered optional sample tool
- the sample tool links to:
  - SDK docs
  - live in-product demo route
- the demo route fetches a real backend payload
- the backend payload enumerates the checked-in generated sample artifact inventory
- the SDK release zip includes generated samples
- CI validates contracts, refreshes the sample scaffold, smoke-tests generation, and packages the SDK

## What Is Not Yet Implemented

The sample tool is still missing a true execution surface inside the Workbench.

Specifically, it does **not** yet have:

- a dedicated execution panel inside Workbench
- a form builder for `community_variant_browser`
- a backend execution endpoint analogous to the FINNGEN preview endpoints
- a persisted run model for community sample runs
- run replay/export flows
- source-aware execution logic beyond the demo envelope
- generalized multi-tool Workbench orchestration outside the FINNGEN tab model

This is intentional. The current slice proves:

- discovery
- documentation
- generation
- packaging
- live demo transport

without prematurely committing to a broader plugin execution architecture.

## Architectural Decisions Made

### Decision 1: Append Community Sample In Laravel, Not In Python StudyAgent

Reasoning:

- avoids coupling the Python service registry to a repo-local demo sample
- keeps the sample promotion clearly a Parthenon product concern
- preserves the distinction between canonical upstream service discovery and local product curation

Tradeoff:

- `/study-agent/services` is no longer a pure pass-through

This is acceptable because Parthenon already acts as the orchestration boundary for frontend-facing tool discovery.

### Decision 2: Spotlight Card Instead Of Fifth Tab

Reasoning:

- the current Workbench implementation is specialized to FINNGEN tools
- a fifth non-FINNGEN tab would imply execution parity that does not exist yet
- spotlight cards communicate “discovered optional tool” better than a partially functional execution tab

Tradeoff:

- the promoted sample is visible but not directly executable from the same shell

This is acceptable for the current maturity level.

### Decision 3: Backend-Fed Demo Route

Reasoning:

- proves the sample tool path can flow through Parthenon backend contracts
- avoids a purely static frontend showcase
- lets the demo derive file inventory from the real checked-in sample

Tradeoff:

- adds a small backend endpoint that is demo-oriented rather than core-runtime-oriented

This is acceptable because it materially improves the credibility and maintainability of the sample path.

## Files Touched In This Slice

### SDK / Docs / Packaging

- [community-workbench-sdk/README.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/README.md)
- [community-workbench-sdk/docs/START_HERE.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/docs/START_HERE.md)
- [community-workbench-sdk/docs/ASSET_INDEX.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/docs/ASSET_INDEX.md)
- [community-workbench-sdk/docs/AI_ASSISTANT_GUIDE.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/docs/AI_ASSISTANT_GUIDE.md)
- [community-workbench-sdk/docs/RELEASE_PROCESS.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/docs/RELEASE_PROCESS.md)
- [community-workbench-sdk/generated-samples/README.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/generated-samples/README.md)
- [community-workbench-sdk/generated-samples/community_variant_browser](/home/smudoshi/Github/Parthenon/community-workbench-sdk/generated-samples/community_variant_browser)
- [community-workbench-sdk/scripts/refresh-sample-tool.sh](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/refresh-sample-tool.sh)
- [community-workbench-sdk/scripts/package-release.sh](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/package-release.sh)
- [community-workbench-sdk/scripts/verify-contracts.py](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/verify-contracts.py)
- [community-workbench-sdk/dist/community-workbench-sdk-v0.1.0.zip](/home/smudoshi/Github/Parthenon/community-workbench-sdk/dist/community-workbench-sdk-v0.1.0.zip)

### Docs Site / Devlog

- [14f-community-workbench-sdk.mdx](/home/smudoshi/Github/Parthenon/docs/site/docs/part4-analyses/14f-community-workbench-sdk.mdx)
- [community-workbench-sdk.md](/home/smudoshi/Github/Parthenon/docs/devlog/process/community-workbench-sdk.md)
- [community-workbench-sdk-phase3-phase4.md](/home/smudoshi/Github/Parthenon/docs/devlog/process/community-workbench-sdk-phase3-phase4.md)

### Backend

- [StudyAgentController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/StudyAgentController.php)
- [CommunityWorkbenchSdkDemoService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/StudyAgent/CommunityWorkbenchSdkDemoService.php)
- [api.php](/home/smudoshi/Github/Parthenon/backend/routes/api.php)
- [CommunityWorkbenchSdkDemoTest.php](/home/smudoshi/Github/Parthenon/backend/tests/Feature/Api/V1/CommunityWorkbenchSdkDemoTest.php)

### Frontend

- [router.tsx](/home/smudoshi/Github/Parthenon/frontend/src/app/router.tsx)
- [api.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/api.ts)
- [useCommunityWorkbenchSdkDemo.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/hooks/useCommunityWorkbenchSdkDemo.ts)
- [CommunityWorkbenchSdkDemoPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/pages/CommunityWorkbenchSdkDemoPage.tsx)
- [CommunityWorkbenchSdkDemoPage.test.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/community-workbench-sdk/pages/__tests__/CommunityWorkbenchSdkDemoPage.test.tsx)
- [FinnGenToolsPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/finngen/pages/FinnGenToolsPage.tsx)
- [FinnGenToolsPage.test.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/finngen/pages/__tests__/FinnGenToolsPage.test.tsx)
- [frontend/src/features/finngen/api.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/finngen/api.ts)

### CI / Build

- [ci.yml](/home/smudoshi/Github/Parthenon/.github/workflows/ci.yml)
- [Makefile](/home/smudoshi/Github/Parthenon/Makefile)

## Verification Performed

The following checks were run during implementation:

- SDK contract validation script
- SDK sample refresh script
- SDK package build
- backend feature test for the demo endpoint
- backend feature test for service-list promotion
- targeted frontend tests for:
  - Workbench page
  - Community SDK demo page

At completion, all targeted checks passed.

## Exact Next Slice For Later

When work resumes, the next recommended slice is:

### Goal

Promote `community_variant_browser` from discovery/demo into a minimal executable community tool surface inside Workbench.

### Recommended Steps

1. Add a dedicated backend execution endpoint for the sample tool.
2. Add a matching frontend API client and mutation hook.
3. Add a small execution panel in Workbench for the community sample.
4. Return a real normalized result envelope from that endpoint.
5. Decide whether community tools get:
   - a separate Workbench section, or
   - a generalized tab/execution architecture
6. Add persisted run support only after the execution surface proves stable.

### Important Constraint

Do **not** force the FINNGEN-specific execution renderer to become a generalized plugin renderer in one jump. That is a larger architectural change than the current slice requires.

The safer path is:

- one sample execution surface first
- then generalize from proven behavior

## Closing State

This is a good pause point.

The SDK is now:

- documented
- packaged
- validated
- linked in-product
- represented by a generated sample
- discoverable from Workbench
- backed by a live backend demo payload

The missing execution surface is now explicit, stubbed, and documented rather than implicit.
