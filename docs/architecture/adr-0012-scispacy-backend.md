# ADR 0012 — Phase 2 SciSpaCy Sidecar + Backend Selection

**Status:** Accepted (2026-05-05)
**Deciders:** Phase 2 spec Q3.
**Implements:** Phase 2 Plan 2 (PR following).

## Context

Plan 1 (PR #271) shipped the LLM-backed NER subsystem with MedGemma via
Ollama as the default. HIPAA-strict customers need an offline,
deterministic alternative — the LLM path, even local Ollama, is overkill
for environments that already have spaCy/SciSpaCy in their stack.

Phase 2 spec decision Q3 settled on a **separate sidecar image**:
SciSpaCy ships in `parthenon-scispacy`, not bundled in
`parthenon-templates`. Customers who don't deploy the SciSpaCy sidecar
don't pay the ~110-750 MB model bloat.

## Decision

`SciSpacyBackend` (Python client) implements the `NlpBackend` Protocol
defined by Plan 1. It routes through `parthenon-scispacy` over HTTP at
`http://parthenon-scispacy:5101/v1/ner/infer`. The sidecar's HTTP
contract matches `parthenon-ai-service` (used by the LLM backend) so
`NoteNlpNode` can swap backends with `params.backend = "scispacy"`
versus `params.backend = "llm"`.

```
NoteNlpNode (params.backend → backend dispatch)
  ├── "llm"     → LlmBackend       → parthenon-ai-service (Plan 1)
  ├── "scispacy"→ SciSpacyBackend  → parthenon-scispacy   (Plan 2; this ADR)
  └── "llettuce"→ LlettuceBackend  → eval-only            (Plan 3, eval-only)
```

The sidecar preloads `en_core_sci_md` at Docker build time (RUN layer)
so the first request does not pay the ~5 second model-load cost. The
container is non-root (HIGHSEC §4.1: `scisvc` user). Healthcheck via
`/health` endpoint.

v0.1 ships **span extraction only** — concept_id mappings via the
SciSpaCy UMLS linker pipeline are deferred to Phase 3 alongside the
AI-assisted mapping template (T-024).

## Consequences

- Plan 3 (Llettuce evaluation harness) gets a real comparand. Without
  SciSpaCy, the eval harness has nothing to compare the LLM against.
- The CI templates workflow grows by one sidecar build + healthcheck +
  named E2E step. The build adds ~2 minutes (model download); future
  optimization candidate is `actions/cache@v4` on the buildx layer.
- Customers running `docker compose up -d parthenon-scispacy` see a
  ~750 MB image pull. Documented in the manifest README.
- The HTTP contract parity between `parthenon-scispacy` and
  `parthenon-ai-service` lets Plan 3's `LlettuceBackend` reuse the same
  pattern when its upstream package matures into a service.

## Alternatives considered

- **Bundle SciSpaCy in the main `parthenon-templates` image.** Declined
  per Q3 — bloats every customer's image even if they never use NER.
- **Fetch SciSpaCy model at first use.** Declined per Q3 — runtime
  network egress is unreliable; HIPAA-strict customers may have egress
  blocked entirely.
- **Pure-Python in-process spaCy load inside `parthenon-templates`.**
  Declined — long startup cost on every node invocation; can't share
  the loaded model across template runs without making the templates
  container stateful.
- **Use the SciSpaCy UMLS linker in v0.1.** Declined — model size +
  load time grows ~10x; defer to Phase 3 where AI-assisted mapping is
  the primary template anyway.

## Open follow-ups

- **UMLS linker** for concept_id mappings — Phase 3 (T-024).
- **Model upgrade** `en_core_sci_md` → `en_core_sci_lg` — pending
  recall comparison via Plan 3's eval harness.
- **Sidecar build cache** via `actions/cache@v4` to amortize the model
  download across CI runs.
- **Multi-language model packs** — current setup is English-only. Add
  `de_core_sci_md` (German) via env var override when a customer asks.
