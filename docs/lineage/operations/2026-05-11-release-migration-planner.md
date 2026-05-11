---
doc_type: lineage
status: in_progress
date: 2026-05-11
owner: acumenus
module: platform
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Console/Commands/ReleaseMigrationPlanCommand.php
  - backend/app/Providers/AppServiceProvider.php
  - backend/config/release_migrations.php
  - backend/database/migrations/2026_04_13_155948_drop_old_finngen_runs_table.php
  - backend/database/migrations/2026_05_11_220000_mark_superseded_finngen_studyagent_migrations.php
related_prs: []
---

# Release Migration Planner

Date: 2026-05-11

## Context

The Parthenon-EE `vEE-0.1.0-rc.9` LAN VM drill confirmed that the app can run
from published EE images at `http://192.168.1.66:8082`, but it also exposed a
release-operator problem. The production console guard correctly refused bare
`php artisan migrate --force` against the protected `parthenon` database, while
`migrate:status` still showed two superseded StudyAgent-era FinnGen migrations
as pending.

The pending state came from the FinnGen schema replacement migration deleting
historical migration rows after dropping the deprecated `app.finngen_runs`
table. That made the old migrations look actionable even though the current
FinnGen runtime schema had replaced them.

## Change

- Preserve historical migration rows in
  `2026_04_13_155948_drop_old_finngen_runs_table` so fresh databases do not
  create the ambiguous pending state.
- Add
  `2026_05_11_220000_mark_superseded_finngen_studyagent_migrations` to repair
  rc9-era upgraded databases by inserting only the missing superseded FinnGen
  migration rows.
- Add `parthenon:migrations:release` as the production release migration
  planner. It reports approved pending, ignored historical pending, unexpected
  pending, and approved already-ran migrations.
- Keep the dangerous-console guard in place while making it inspect the actual
  Symfony input so explicit `--path` migrations remain allowed.
- Add `config/release_migrations.php` for release-approved paths and
  documented historical pending classifications.

## Validation

- PHP syntax checks passed for the command, config, guard, and migrations.
- `php artisan list parthenon` registers `parthenon:migrations:release`.
- Running the planner in the live development PHP container failed closed when
  unapproved pending migrations were present.
- Running the planner with an invalid path produced a controlled failure rather
  than a stack trace.
