# ADR 0009 — Phase 2 NER Node Design

**Status:** Accepted (2026-05-05)
**Deciders:** Phase 2 spec, Q1-Q2-Q5-Q11 — settled in PR #263.
**Implements:** Phase 2 Plan 1 (PR #264 plan; this PR is the execution).

## Context

Phase 2 of the ingestion-templates initiative adds clinical-text NER to
the templates runtime. Customers want to extract concepts from FHIR
DocumentReference resources and write OMOP `NOTE_NLP` rows. The Phase 2
design spec settled the load-bearing decisions:

- **Q1** — LLM provider default: MedGemma via Ollama (local, HIPAA
  posture); cloud OpenAI-compat behind a feature flag for HIPAA-cleared
  deployments only.
- **Q2** — Prompt versioning: prompts live as version-pinned files at
  `templates/runtime/nlp/prompts/<version>/<name>.md`; manifests pin
  `metadata.prompt_version`.
- **Q5** — NOTE_NLP audit retention: token offsets + concept mappings +
  model_name + prompt_version always; raw input encrypted in
  `app.note_nlp_audit` for 30 days then truncated.
- **Q11** — Cost ceiling: per-job spend cap (`OPENAI_BUDGET_USD`)
  enforced in the cloud LLM path; `LlmBudgetExceeded` raised once
  cumulative cost reaches the cap. Mirrors the perf-trigger pattern
  from PR #262.

## Decision

The NER subsystem is a pluggable Protocol (`NlpBackend`) with one
concrete backend in Plan 1 (`LlmBackend`). Future plans add
`SciSpacyBackend` (Plan 2) and `LlettuceBackend` (Plan 3, eval-only).

```
NoteNlpNode  (templates/runtime/nodes/note_nlp.py)
     │
     ├─ NlpBackend Protocol  (templates/runtime/nlp/backend.py)
     │      ├─ LlmBackend        (Ollama default + cloud OpenAI-compat)
     │      ├─ SciSpacyBackend   (Plan 2, sidecar)
     │      └─ LlettuceBackend   (Plan 3, eval-only)
     │
     ├─ PromptRegistry  (templates/runtime/nlp/registry.py)
     │      └─ runtime/nlp/prompts/v0.1.0/clinical_ner_v1.md (+ schema)
     │
     └─ NoteNlpAuditWriter  (templates/runtime/nlp/audit.py)
            └─ app.note_nlp_audit   (Fernet-encrypted raw_input, 30-day TTL)
```

The `NoteNlpNode` produces a `note_nlp_inference.json` artifact in the
run's `artifact_dir` per the Phase 0 node-SDK contract. Downstream
loaders write OMOP `NOTE` + `NOTE_NLP` rows from that artifact via the
same pattern Phase 1 PR-A/B/C use for FHIR-to-OMOP loaders.

The cloud OpenAI-compat path is gated by `OPENAI_LLM_ENABLED=true` AND
the presence of `OPENAI_API_KEY`. With either missing, the backend
silently falls back to Ollama. Per-call cost is computed from the
returned `usage` (prompt_tokens, completion_tokens) at GPT-4o-mini
default pricing (`OPENAI_COST_PER_1K_PROMPT`,
`OPENAI_COST_PER_1K_COMPLETION` for overrides).

CI gates the regular Pytest lane against the structural tests
(NlpBackend protocol, LlmBackend mock-based, recall harness against the
gold standard). The slow lane `ner-live` job, gated to `schedule` +
`workflow_dispatch`, runs the 100-note benchmark against a real LLM
with the per-job spend cap; logs are uploaded as 90-day artifacts.

## Consequences

- Plans 2 (SciSpaCy) and 3 (Llettuce eval) inherit the `NlpBackend`
  Protocol + prompt-versioning conventions defined here.
- `app.note_nlp_audit` becomes a repository-wide invariant for any
  clinical-text inference. The daily prune command
  (`templates:prune-note-nlp-audit`) keeps PHI exposure bounded to 30
  days per row.
- Live-LLM CI cost is bounded but introduces a recurring charge —
  capped at $30/month at $1/job × 30 nights. The pricing constants
  are env-overridable so tariff changes don't require a code release.
- Phase 3's `ai_assisted_mapping` template (T-024) inherits this
  Protocol; it can wire either the LLM backend or, if Plan 3's
  evaluation graduates Llettuce, the LlettuceBackend as the
  concept-mapping suggester.

## Alternatives considered

- **Cloud LLM as default.** Declined — HIPAA posture requires local
  inference unless the customer explicitly enables cloud and signs a BAA
  with their LLM provider.
- **Inline prompt in manifest YAML.** Declined — long clinical-NER
  prompts in YAML are brittle and don't version cleanly.
- **Store raw note text indefinitely.** Declined — PHI liability under
  HIPAA Safe Harbor; 30-day retention is the bounded compromise that
  preserves clinical replay capability.
- **Store no raw text at all.** Declined — clinical reviewers cannot
  replay an inference without the input, and replay is the gating
  workflow for any clinical-correctness escalation.
- **Per-call hard cost cap (block before the API call).** Considered;
  rejected in favor of post-call accumulation because pre-call cost
  estimation is inaccurate without the actual prompt + response token
  count. The current design lets the first call go through unbounded
  but blocks any further calls once the running total breaches the cap.

## Open follow-ups

- Phase 2 Plan 2 lands `SciSpacyBackend` and the `parthenon-scispacy`
  sidecar (decision Q3).
- Phase 2 Plan 3 lands the Llettuce evaluation harness with the +5 pp
  graduation criterion against SciSpaCy (decision Q4).
- The 100-note benchmark gold standard is synthetic in v0.1; a curated
  clinician-reviewed gold-standard set lands in Phase 3 alongside
  `ai_assisted_mapping` (T-024).
