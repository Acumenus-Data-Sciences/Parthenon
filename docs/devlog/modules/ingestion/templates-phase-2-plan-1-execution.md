# Phase 2 Plan 1 — NER Node + LLM Backend Execution Devlog

**Branch:** `feature/phase-2-plan-1-impl-ner-llm`
**Plan:** `docs/superpowers/plans/2026-05-05-parthenon-ingestion-templates-phase-2-plan-1-ner-node-llm.md`
**Started:** 2026-05-05

Execution log of the 15 TDD tasks landed by Phase 2 Plan 1.

## Task progress

- [x] Task 1: pin openai==2.34.0 + cryptography==44.0.0 (jsonschema already pinned)
- [x] Task 2: app.note_nlp_audit migration + NoteNlpAudit Eloquent model
- [ ] Task 3: NerSpan + NerConceptMapping + NerInferenceResult typed models
- [ ] Task 4: NlpBackend Protocol + LlmBackendError + LlmBudgetExceeded
- [ ] Task 5: PromptRegistry
- [ ] Task 6: LlmBackend Ollama path
- [ ] Task 7: LlmBackend cloud OpenAI-compat path
- [ ] Task 8: LlmBackend per-job budget cap
- [ ] Task 9: NoteNlpAuditWriter
- [ ] Task 10: NoteNlpNode
- [ ] Task 11: Clinical NER prompt v0.1.0 + JSON schema
- [ ] Task 12: parthenon_ner_llm manifest + 100-note FHIR fixture
- [ ] Task 13: Validation pack + ≥90% recall E2E
- [ ] Task 14: CI live-LLM lane
- [ ] Task 15: ADR 0009

## Notes

- Plan-pinned `openai>=1.0.0` rendered as `openai==2.34.0` (latest 1.x.0+ stable; the chat completions surface used by the LLM backend is API-stable across 1.x → 2.x).
- `jsonschema==4.23.0` was already pinned in Phase 0; satisfies the Plan 1 requirement.
- Migration uses raw SQL via `DB::statement` to match the Phase 1 PR-A/PR-C migration style (`unmapped_concepts_queue`, `consent_decisions`).
- `raw_input` is `nullable` so the daily prune command (Task 9) can null it out post-TTL without violating constraints.
