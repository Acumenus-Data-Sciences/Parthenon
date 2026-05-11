# Abby AI: Database Awareness, Live Context Fixes, and Security Hardening

**Date:** 2026-04-03
**Module:** Abby AI
**Status:** Complete

## Summary

Abby AI's live database context was completely non-functional due to three cascading issues: wrong schema references in SQL queries, a stale PostgreSQL password blocking the AI container's connection, and firewall rules blocking container-to-host Ollama traffic. Additionally, Abby's system prompts never mentioned her database capabilities, so even when data was injected into her context, she didn't know to leverage it for answering quantitative questions.

This session resolved all of these issues and introduced a dedicated `abby_analyst` PostgreSQL role with principle-of-least-privilege access.

## Problems Found

### 1. LLM Unreachable (Ollama Firewall Block)

The AI container couldn't reach Ollama on `host.docker.internal:11434`. The host runs UFW with `INPUT policy DROP`, and while port 5432 (PostgreSQL) had an explicit allow rule for Docker subnets (`172.16.0.0/12`), port 11434 did not. Added:

```bash
sudo ufw allow from 172.16.0.0/12 to any port 11434 proto tcp
```

### 2. PostgreSQL Authentication Failure

The `DATABASE_URL` in docker-compose used `claude_dev` with `HECATE_PG_PASSWORD`, but the password had been rotated earlier in the session. The AI container was getting `FATAL: password authentication failed` on every database query.

### 3. Wrong Schema References in Live Context

`live_context.py` had three categories of incorrect schema qualifiers:

| Wrong | Correct | Impact |
|-------|---------|--------|
| `omop.concept` | `vocab.concept` | Empty results — `omop.concept` is an empty CDM shell table that shadows `vocab.concept` in the search_path |
| `achilles_results.achilles_results` | `results.achilles_results` | Schema doesn't exist — all Achilles queries failed |
| `achilles_results.dqd_results` | `app.dqd_results` | Schema doesn't exist — all DQD queries failed |

### 4. DataProfileService Wrong Schema Default

`DataProfileService` defaults `cdm_schema="cdm"` but the Abby router on line 719 never passed `settings.knowledge_cdm_schema` (which is `"omop"`), causing `cdm.observation_period does not exist` errors.

### 5. No Capability Awareness in System Prompts

None of Abby's page-specific system prompts mentioned database access. She would receive injected data context but respond with generic advice ("use the Data Explorer") instead of citing the actual numbers already in her context.

## Changes

### New: `abby_analyst` PostgreSQL Role

Created a dedicated read-only database role following HIGHSEC least-privilege principles:

- **SELECT** on all data schemas: `vocab`, `omop`, `app`, `results`, `pancreas`, `pancreas_results`, `irsf`, `irsf_results`, `eunomia_results`, `inpatient_ext`, `atlantic_health`, `mimiciv`
- **No write access** — `INSERT INTO omop.person` returns `permission denied`
- **Default privileges** set for future tables in key schemas
- **Separate env var** `ABBY_PG_PASSWORD` in `.env` (not shared with `claude_dev`)

### docker-compose.yml

- AI container `DATABASE_URL` changed from `claude_dev:${HECATE_PG_PASSWORD}` to `abby_analyst:${ABBY_PG_PASSWORD}`
- `KNOWLEDGE_VOCAB_SCHEMA` corrected from `omop` to `vocab`

### ai/app/chroma/live_context.py

- All `omop.concept` → `vocab.concept` (7 occurrences)
- All `achilles_results.achilles_results` → `results.achilles_results` (4 occurrences)
- `achilles_results.dqd_results` → `app.dqd_results`

### ai/app/routers/abby.py

- Added `CAPABILITY_PREAMBLE` — shared prompt block prepended to all page-specific prompts, describing Abby's database access, available schemas/sources, and instruction to answer data questions with real numbers
- Fixed `DataProfileService` instantiation to pass `cdm_schema=settings.knowledge_cdm_schema`

## Verification

```
Connected as: abby_analyst
Vocab concepts: 7,089,806
OMOP persons: 1,005,788

Q: "How many patients are in the CDM and what are the top 5 conditions?"
A: "The CDM contains 1,005,788 total persons. The top 5 conditions by frequency are:
   1. Removal of subgingival plaque and calculus... (952,395 records)
   2. Removal of supragingival plaque and calculus... (952,395 records)
   3. Assessment of health and social care needs (810,970 records)
   ..."
```

## Related

- Patient Similarity OOM fix and concept resolution (same session)
- Pancreas CDM lab enrichment (same session)
- `claude_dev` password rotation and pgpass update (same session)
