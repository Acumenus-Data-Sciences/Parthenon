# parthenon_ner_llm

Clinical NER over FHIR DocumentReference resources. Default backend
**MedGemma via Ollama** through `parthenon-ai-service` (decision Q1);
cloud OpenAI-compat behind `OPENAI_LLM_ENABLED=true` for HIPAA-cleared
deployments only.

## Pipeline

1. `ingest_fhir` — pulls DocumentReference NDJSON or paginated search
   results. Resource types are gated by the chosen profile pack
   (default `us-core`).
2. `nlp_inference` — runs the configured `NlpBackend` against each note;
   emits `note_nlp_inference.json` artifact with spans + concept
   mappings + model_name + prompt_version.

Downstream OMOP `NOTE` + `NOTE_NLP` writes happen in a customer-side
loader using the same artifact contract as the FHIR-to-OMOP templates
(Phase 1 PR-A/B/C); this template ships as the inference engine, not the
end-to-end OMOP write.

## Audit

Every inference is mirrored to `app.note_nlp_audit` with token offsets,
concept mappings, model name, prompt version, and **encrypted raw input
text retained 30 days** (decision Q5). The
`templates:prune-note-nlp-audit` artisan command nulls `raw_input` on
rows past their TTL.

## Cost cap

For the cloud OpenAI-compat path, set `OPENAI_BUDGET_USD` to a per-job
spend cap. Once accumulated estimated spend reaches the cap, the next
inference raises `LlmBudgetExceeded` (decision Q11). The cap mirrors
the perf-trigger pattern from PR #262: enforced in code, not just in
the CI lane.

## Fixtures

```bash
cd templates/manifests/parthenon_ner_llm/fixtures/synthetic
uv run python build_fixtures.py --count 100
```

Default 10 notes for fast unit / E2E iteration; spec §6 benchmark uses
`--count 100`. The companion `validation/expected/gold_standard.csv` is
regenerated alongside the FHIR fixtures so the recall metric is always
internally consistent.

## Operations

```bash
# Local Ollama default
docker compose up -d parthenon-ai-service

# Submit a run via the templates API
curl -X POST http://parthenon-templates:8001/runs \
  -H "X-Parthenon-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": "parthenon_ner_llm",
    "parameters": {
      "ndjson_dir": "/data/fhir-bulk-export",
      "profile": "us-core"
    }
  }'
```
