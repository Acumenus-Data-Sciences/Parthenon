# Infrastructure Fixes — 2026-03-17

## Summary

Three issues fixed in a single pass: R runtime crash loop, Abby GIS analyzer Ollama connectivity, and Abby chat cold-start timeouts.

## Issue 1: R Runtime Crash Loop (Strategus missing)

**Symptom:** `parthenon-r` container in `Restarting` state, crash-looping every ~10 seconds.

**Root Cause:** Docker build cache invalidation. The `docker/r/Dockerfile` was updated in commit `9a75e8a50` (OHDSI ecosystem integration) after the March 6 image build. When the rebuild was triggered, the missing `libpng-dev` system dependency caused a cascade:

```
libpng-dev missing → R `png` package fails → `reticulate` fails → `DeepPatientLevelPrediction` fails
```

The original March 6 build had succeeded because the build cache preserved older layers where `png` had been compiled against a pre-existing `libpng`. Once the cache was invalidated (apt layer change), the missing system dependency was exposed.

**Fix:** Added `libpng-dev` to the `apt-get install` list in `docker/r/Dockerfile` (line 23). Full image rebuild completed successfully.

**Verification:** Container healthy, Plumber API returns `{"status":"ok"}` on `/health`.

## Issue 2: Abby GIS Analyzer — Hardcoded Ollama URL

**Symptom:** All GIS column analysis requests via Abby failed silently (Ollama unreachable).

**Root Cause:** `ai/app/services/abby_gis_analyzer.py` had a hardcoded `OLLAMA_URL = "http://ollama:11434"`. There is no Docker service named `ollama` — Ollama runs on the host and is accessed via `host.docker.internal:11434`. Every other file in the AI service correctly uses `settings.ollama_base_url` from `app/config.py`.

**Fix:** Replaced the hardcoded URL and model name with `settings.ollama_base_url` and `settings.ollama_model` from the centralized config. Removed the unused `OLLAMA_URL` constant.

**Verification:** `curl http://localhost:8002/health` confirms `"llm": {"status": "ok"}`. No remaining `http://ollama:` references in the codebase.

## Issue 3: Abby Chat Cold-Start Timeout

**Symptom:** Abby returns HTTP 504 ("LLM service timed out after retries") on first chat request after container restart or model eviction.

**Root Cause:** `call_ollama()` in `ai/app/routers/abby.py` used a fixed 30-second per-attempt timeout with 3 retries. MedGemma cold load takes ~44 seconds (GPU model loading), so:

1. Attempt 1: times out at 30s (model still loading)
2. Attempt 2: Ollama returns 500 (model partially loaded, request rejected)
3. Attempt 3: may also fail if load exceeds 60s total

**Fix:** First attempt now uses a 90-second timeout to accommodate cold model loads. Subsequent retries keep the 30-second timeout since the model should be warm by then.

```python
# Before: attempt_timeout = 30 (all attempts)
# After:  attempt_timeout = 90 if attempt == 0 else 30
```

**Verification:** Abby chat responds successfully even on cold start.

## Files Changed

| File | Change |
|------|--------|
| `docker/r/Dockerfile` | Added `libpng-dev` to system dependencies |
| `ai/app/services/abby_gis_analyzer.py` | Replaced hardcoded Ollama URL/model with centralized settings |
| `ai/app/routers/abby.py` | Increased first-attempt timeout from 30s to 90s for cold model loads |

## Impact

- R runtime: all HADES analytics endpoints operational (estimation, prediction, SCCS, evidence synthesis, Strategus orchestration, cohort diagnostics, characterization, ETL-Synthea)
- Abby GIS: column analysis and Q&A now reach Ollama correctly
- Abby chat: resilient to cold model loads after container restarts or GPU memory eviction
