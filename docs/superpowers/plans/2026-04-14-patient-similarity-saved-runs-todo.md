# Patient Similarity Saved Runs Todo

## Goal

Researchers should be able to return to Cohort Similarities without rerunning completed comparison, similarity, downstream analysis, or LLM interpretation steps. Saved work should be scoped to the signed-in user and presented as:

- **My Comparisons** when the workflow is `Compare cohorts`
- **My Similarities** when the workflow is `Find similar patients`

## Backend

- Add persistent run metadata for each user, workflow mode, selected source, selected cohorts, similarity method, settings, status, and last-opened timestamp.
- Add persistent run step records keyed by run and step id, including status, summary, full aggregate result JSON, result hash, execution time, and completed timestamp.
- Add persistent interpretation records keyed by user, workflow context, step id, and result hash so an LLM interpretation can be reused when the aggregate data has not changed.
- Add owner-scoped API endpoints to list, create, show/open, update, delete, and save step outputs.
- Extend the on-demand interpretation endpoint to accept optional run context and return cached interpretations when possible.
- Keep all saved payloads aggregate-only for the LLM path; do not persist or send individual patient identifiers in interpretation summaries beyond the existing saved analysis result payloads.

## Frontend

- Add patient-similarity API types and React Query hooks for saved runs and saved steps.
- Add a workflow-aware dropdown in the top selection panel:
  - `My Comparisons` for compare mode.
  - `My Similarities` for expand mode.
- Selecting a saved run should restore source, cohort selections, similarity mode/settings, completed step payloads, and saved interpretations.
- Starting a new analysis after changing selections should create or update the active saved run and autosave completed step outputs.
- Interpretation requests should include run and step identifiers so returned interpretations are cached and shown on page reload.
- Maintain visual alignment with the gold-standard form controls already used by the selector panel.

## Verification

- Add backend coverage for interpretation hash/cache behavior and run ownership rules where feasible.
- Run PHP lint on touched backend files.
- Run focused Pest tests for patient similarity interpretation/persistence.
- Run TypeScript and focused frontend tests for the workspace and selector panel.
- Deploy frontend with `./deploy.sh --frontend` after frontend changes pass.
