---
phase: 13
slug: finngen-endpoint-universalization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated by the planner from RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Pest 3.x (PHP) + Vitest (TS) — both already configured |
| **Config file** | backend/phpunit.xml + frontend/vitest.config.ts |
| **Quick run command** | `docker compose exec -T php vendor/bin/pest --filter=FinnGen --parallel` |
| **Full suite command** | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen tests/Unit/FinnGen && docker compose exec -T node sh -c "cd /app && npx vitest run src/features/finngen-workbench"` |
| **Estimated runtime** | ~45 seconds (quick) / ~3 minutes (full) |

---

## Sampling Rate

- **After every task commit:** `docker compose exec -T php vendor/bin/pest --filter=FinnGen --parallel` (quick, ~45s)
- **After every plan wave:** Full suite above
- **Before `/gsd-verify-work`:** Full suite must be green AND a manual baseline-scan dry-run must be attached to the verification artifact
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Populated by the planner as tasks are authored. Each task should land a row with file/command/requirement mapping.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(planner fills)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Planner populates from RESEARCH.md open-questions and gaps.*

- [ ] Resolve `source_to_concept_map` schema target (vocab vs omop) — research flagged discrepancy between CONTEXT.md and live migration
- [ ] Verify Athena ICDO3 redistribution license (A2 assumption from research, MEDIUM risk)
- [ ] Clinical SME review of KELA_REIMB → ATC mappings (A5 assumption from research, MEDIUM risk)
- [ ] Decide tandem kela_reimb + kela_reimb_icd endpoint classification (partial vs finland_only)
- [ ] Decide truncated-resolver-output (MAX_RESOLVED=500) classification rule

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Baseline empirical scan output review | GENOMICS-12a SC-4 | Target threshold negotiation with user requires human judgment on the per-profile distribution | Run the planner-authored baseline-scan Artisan command; review its summary markdown; attach to verification |
| Endpoint browser Finland-only pill visual check | GENOMICS-12a SC-3 | Visual regression + copy review for "Requires Finnish CDM" pill + disabled Generate CTA tooltip | Load /workbench/finngen-endpoints in staging browser; confirm pill renders + Generate disabled on PANCREAS source for an endpoint classified finland_only |
| PANCREAS smoke-generation of previously-UNMAPPED endpoint | GENOMICS-12a SC-6 | End-to-end integration across Laravel → Darkstar R worker → cohort table needs a live DB | Trigger POST /api/v1/finngen/endpoints/{name}/generate for an endpoint chosen by planner (ICDO3 or ICD-8 keyed cancer phenotype); confirm finngen_endpoint_generations.status = 'completed' and subject_count > 0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
