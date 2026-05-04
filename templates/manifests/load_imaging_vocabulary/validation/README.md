# load_imaging_vocabulary — validation pack

Customer-facing inputs and expected post-conditions for end-to-end validation
of the `load_imaging_vocabulary` template against a staging Parthenon CDM
instance.

## What this pack ships

- `inputs/parameters.json` — sample parameters using the Parthenon-mirrored
  bundle URL. Replace `source_url` if you maintain your own mirror.
- `expected/post_conditions.yaml` — the assertions the staging validation
  runner enforces after the run completes.
- `dqd_checks.yaml` — DQD-equivalent checks to run via your DQD runner against
  the loaded vocabulary.

## How to validate

1. Bring up a Parthenon CDM v5.4 instance with empty `vocab.*` tables.
2. Submit the template via the Aqueduct UI or
   `curl -H "X-Parthenon-Internal-Token: $TOKEN" -X POST .../runs` with
   `inputs/parameters.json` as the body.
3. Wait for the run to reach `completed`.
4. Run the staging validation runner against this pack.
5. (Optional) Run the DQD checks for a deeper integrity sweep.
