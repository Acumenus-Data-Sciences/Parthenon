# Patient Similarity — Cohort Similarities Save + Interpretation Devlog

**Date:** 2026-04-14  
**Area:** Patient Similarity / Cohort Similarities  
**Status:** Shipped and deployed

## Summary

The Cohort Similarities workspace moved from an ephemeral, rerun-heavy workflow to a researcher-owned workspace model. Researchers can now generate LLM interpretations for aggregate analysis steps, reopen prior comparison/similarity workflows, and avoid rerunning expensive downstream steps just to get back to the same result set.

## What Shipped

- Added aggregate-only LLM interpretation for Cohort Similarities steps:
  - profile comparison
  - covariate balance
  - propensity score matching
  - landscape projection
  - phenotype discovery
  - network fusion
  - centroid profile
  - similar-patient search
- Switched interpretation UX to an immediate modal with a spinner while the configured LLM provider responds.
- Persisted researcher-owned saved runs:
  - `patient_similarity_runs`
  - `patient_similarity_run_steps`
  - `patient_similarity_interpretations`
- Added workflow-aware saved-run selectors:
  - **My Comparisons** for compare mode
  - **My Similarities** for find-similar-patients mode
- Autosaved completed step outputs and linked interpretations by run/step/result hash.
- Removed the local data-source dropdown from the Patient Similarity setup panel. The universal topnav source selector is now the single source of truth.

## Backend Notes

The interpretation service summarizes and redacts patient-level payloads before prompting the LLM. Result reuse is keyed by:

- user
- workflow mode
- step id
- source/cohort context
- deterministic hash of sanitized aggregate results

The first database deployment exposed a useful operational constraint: the runtime/migration role can create new tables but may not be allowed to create foreign keys referencing some older app tables. New persistence migrations therefore use indexed ID columns for existing app entities and reserve foreign keys for tables created together in the same ownership context.

## Frontend Notes

The workspace now restores:

- selected workflow
- topnav source, when opening a saved run from a different source
- cohort selections
- similarity mode and settings
- completed step outputs
- saved LLM interpretations

Changing the universal source selector intentionally clears stale in-progress analysis state unless that source change came from opening a saved run.

## Verification

- PHP lint passed for touched backend files and migrations.
- Focused Pest coverage passed for deterministic interpretation hashing.
- Frontend TypeScript passed.
- Focused Patient Similarity Vitest coverage passed.
- Deployed PHP and frontend assets; smoke checks passed.

## Follow-On Pattern

The saved-run architecture is now the pattern for other long-running researcher workflows:

- persist draft/workflow state server-side by user
- autosave meaningful progress
- provide a per-user dropdown of saved work
- keep local storage only as a short-lived fallback, not as the system of record
