# parthenon_ner_scispacy

Clinical NER over FHIR DocumentReference resources, **offline** via the
SciSpaCy `en_core_sci_md` model preloaded into the `parthenon-scispacy`
sidecar container. This is the HIPAA-strict path: no LLM, no network
egress at run time, deterministic outputs.

## When to use this template (vs `parthenon_ner_llm`)

- **HIPAA-strict deployments** where no clinical text may leave the
  customer's environment, even to a local Ollama. SciSpaCy runs entirely
  inside the sidecar.
- **Deterministic outputs** where the same note must always extract the
  same spans. SciSpaCy is rule-bound; MedGemma may vary across runs.
- **Trade-off**: lower recall vs the LLM. SciSpaCy gates at ≥0.85 on the
  shared gold standard; MedGemma gates at ≥0.90.

## v0.1 limitations

- **Span extraction only** — no concept_id mappings. The SciSpaCy UMLS
  linker pipeline (which produces concept_id mappings) is bigger and
  costlier; we defer it to Phase 3 alongside the AI-assisted mapping
  template (T-024). Customers who need concept_id mappings today should
  use the LLM backend or wait for the linker integration.
- **`en_core_sci_md` only** — to swap to `en_core_sci_lg` (~750 MB,
  better recall on rare entities), set `SCISPACY_MODEL=en_core_sci_lg`
  on the `parthenon-scispacy` container and rebuild. Plan 3's evaluation
  harness can quantify the recall trade-off if helpful.

## Operations

```bash
# Build + start the sidecar (one-time)
docker compose build parthenon-scispacy
docker compose up -d parthenon-scispacy

# Wait for the sidecar to load the model (~30s on first start).
docker compose ps parthenon-scispacy

# Submit a run via the templates API.
curl -X POST http://parthenon-templates:8001/runs \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": "parthenon_ner_scispacy",
    "parameters": {
      "source": "ndjson",
      "ndjson_dir": "/data/fhir-bulk-export",
      "profile": "us-core"
    }
  }'
```

## Reference benchmark

Uses the same 10/100-note synthetic FHIR DocumentReference fixture as
`parthenon_ner_llm`. Run the fixture builder to populate it:

```bash
uv run python templates/manifests/parthenon_ner_llm/fixtures/synthetic/build_fixtures.py --count 100
```

Validation pack at `validation/expected/post_conditions.yaml` references
the shared gold standard so backend recall is directly comparable to
`parthenon_ner_llm`.

## Audit

Same as `parthenon_ner_llm`: every inference is mirrored to
`app.note_nlp_audit` with token offsets, encrypted raw input, and a
30-day TTL. The `templates:prune-note-nlp-audit` artisan command nulls
`raw_input` post-TTL.

## See also

- ADR 0009 — Phase 2 NER node design (LLM backend, shared infrastructure)
- ADR 0012 — Phase 2 SciSpaCy sidecar + backend selection
- `parthenon_ner_llm` — sister template using MedGemma / OpenAI-compat
