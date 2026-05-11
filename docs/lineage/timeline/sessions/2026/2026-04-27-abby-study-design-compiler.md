# Abby Study Design Compiler

**Date:** 2026-04-27
**Branch:** main
**Status:** Abby-mediated Study Design Compiler shipped, deployed, reviewed, and smoke-tested
**Primary commit:** `bb105eb1b feat: complete Abby study design compiler`

## Summary

The Study Designer now behaves as a compiler-grade, user-reviewed workflow rather than a free-form AI authoring surface. Abby is the product-facing harness and workflow guide. Local MedGemma 27B on Ollama is the control-plane assistant for bounded compiler guidance, tool planning, and safe review language. Claude/Anthropic is available only through the scoped protocol-evaluation path when the dedicated cloud-evaluation flag is enabled.

The user-facing shape stays anchored in the same Study Design page. Protocol uploads inside an existing design session create a new version, populate the workbench, and keep the user in the Intent Review and downstream compiler panels. Standalone protocol intake still creates a new study and routes to that study's design tab because that flow is explicitly creating a new study container.

## What Shipped

- Added Abby Study Design orchestration services:
  - `StudyDesignAbbyOrchestrator`
  - `StudyDesignOllamaClient`
  - `StudyDesignClaudeClient`
  - `StudyDesignContextBuilder`
  - `StudyDesignToolRunner`
  - `StudyDesignGuidanceService`
  - `StudyDesignStructuredOutputSchemas`
  - `StudyDesignProtocolGateException`
- Added a named structured-output schema catalog for:
  - protocol extraction
  - compiler guidance
  - phenotype recommendation
  - concept-set draft
  - cohort draft
  - analysis-plan draft
  - asset repair suggestion
  - package-manifest review
- Added protocol extraction evidence and confidence handling:
  - evidence spans
  - field-level confidence
  - overall confidence
  - uncertainty notes
  - design assumptions
  - initial-gate issue reporting for inadequate protocols
- Added Intent Review evidence and confidence display in the frontend.
- Added compiler guidance across remaining Study Design panels:
  - intent review
  - bottom-up compatibility
  - phenotype recommendation
  - concept-set drafting, verification, repair, and materialization
  - cohort drafting, verification, repair, materialization, and linking
  - source feasibility
  - analysis-plan drafting, verification, and materialization
  - package lock readiness
- Removed the empty cohort fallback path. Cohort drafting now requires materialized, verified concept-set assets.
- Added optional Anthropic prompt caching configuration for repeated protocol/OHDSI context blocks:
  - `ABBY_PROTOCOL_PROMPT_CACHING_ENABLED`
  - `ABBY_PROTOCOL_PROMPT_CACHE_TTL`
- Updated Abby/Ollama defaults for the local harness:
  - `ABBY_OLLAMA_URL`
  - `ABBY_OLLAMA_MODEL=puyangwang/medgemma-27b-it:q4_0`
  - `ABBY_OLLAMA_TIMEOUT`
- Updated protocol-import API behavior so session uploads return the new version plus extraction metadata.
- Added focused frontend coverage across compiler panels and API envelope behavior.
- Added AI service tests for Abby/cloud routing and health behavior.

## Protocol Gate Behavior

Protocol imports now fail before persistence when the uploaded document is too thin for research-grade compilation. Abby reports the failure as an initial protocol gate failure with concrete issues, severity, evidence/confidence where available, and a summary explaining why the protocol cannot safely proceed.

This protects downstream concept-set, cohort, analysis, and package outputs from being generated from under-specified protocols.

## Review Pass Findings

- The Study Design worktree was clean before the review pass.
- User-visible Study Designer text no longer contains the prior "Claude Analysis" or "Claude is analyzing" labels.
- Remaining Claude references are provider/admin/routing internals or documentation references for Anthropic as the optional cloud evaluator.
- In-session protocol uploads do not navigate away from the active Study Design workbench.
- Standalone protocol imports still create a new study and return that newly-created study context.
- Broad frontend Vitest initially exposed an unrelated analyses/GIS red test expecting `STRATIFY_BY_LOCATION_OPTIONS` to be exported by `IncidenceRateDesigner`. A narrow export was added so the frontend suite passes.
- The matching backend GIS test remains an unrelated pre-existing RED/Wave-0 test. It still fails because `IncidenceRateService` does not yet expose `location_urban_pct` and the test imports `App\Models\App\User`, which does not exist in this app namespace.

## Verification

- `cd backend && php -d memory_limit=-1 vendor/bin/phpstan analyse`
  - passed, no errors.
- `cd backend && ./vendor/bin/pint --dirty --test`
  - passed.
- `cd backend && ./vendor/bin/pest tests/Feature/Api/V1/StudyDesignTest.php`
  - 31 tests, 419 assertions passing.
- `cd frontend && npx tsc -b --pretty false --noEmit`
  - passed.
- `cd frontend && npx eslint src/features/studies src/features/study-agent/pages/StudyDesignerPage.tsx src/features/administration/pages/AiProvidersPage.tsx src/features/auth/components/setup-steps/AiProviderStep.tsx src/i18n/appResources.ts src/i18n/commonsResources.ts src/i18n/completenessPolicy.ts`
  - passed.
- `cd frontend && npx vitest run src/features/studies/components/__tests__/studyDesignGuidance.test.ts src/features/studies/components/__tests__/studyDesignIntentAssistance.test.ts src/features/studies/components/__tests__/studyDesignCompatibilityAssistance.test.ts src/features/studies/components/__tests__/ProtocolImportProgress.test.tsx src/features/studies/components/__tests__/StudyDesignWorkbench.protocol-import.test.tsx src/features/studies/api/__tests__/studyApi.test.ts src/features/study-agent/pages/__tests__/StudyDesignerPage.test.tsx`
  - 7 files, 31 tests passing.
- `cd frontend && npx vitest run`
  - 160 files passed, 873 tests passed, 2 skipped.
  - The run emits existing jsdom canvas `getContext()` not-implemented noise, but no tests fail.
- `cd ai && pytest tests/test_abby_integration.py tests/test_health.py tests/test_rule_router.py tests/test_claude_client.py`
  - 93 tests passing.
- `./deploy.sh --frontend`
  - completed during the feature rollout.
- `./deploy.sh --php`
  - completed after the feature rollout and static-analysis fixes.
- Live smoke checks returned 200:
  - `/`
  - `/login`
  - `/jobs`
  - `/studies/hypertension-study-v3-2?tab=design`

## Follow-Ups

- Complete the separate GIS-03 backend feature if `location_urban_pct` support is still desired.
- Consider moving `STRATIFY_BY_LOCATION_OPTIONS` into a shared analyses constants file once the GIS-03 UI is implemented, then re-export it from `IncidenceRateDesigner` only if the existing test contract remains useful.
- Revisit Anthropic prompt caching after production protocol-import volume is high enough to justify enabling it by default.
- Add Playwright coverage for a real protocol upload once a stable test fixture and authenticated browser harness are available.
