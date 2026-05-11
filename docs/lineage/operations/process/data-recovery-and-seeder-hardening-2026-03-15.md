# Data Recovery and Seeder Hardening — 2026-03-15

**Severity:** Critical incident
**Duration:** ~45 minutes
**Data loss:** Temporary (fully recovered from backup)

## Incident

During a deploy cycle, `db:seed` wiped all 16 real production users and their associated data via `TRUNCATE CASCADE` through foreign key relationships. The `DatabaseSeeder` was creating `admin@parthenon.local` instead of `admin@acumenus.net`, and sample data seeders ran unconditionally on every deploy.

## Root Causes

1. **Wrong admin email in 5 seeders** — `DatabaseSeeder`, `CohortDefinitionSeeder`, `ConceptSetSeeder`, `AnalysisSeeder`, `StudySeeder` all referenced `admin@parthenon.local` (leftover from initial scaffolding)
2. **No production data guard** — `DatabaseSeeder` ran all sample data seeders unconditionally, including ones that use `firstOrCreate` with factory-generated users
3. **CASCADE destruction** — When sample data seeders touched tables with FK constraints back to `users`, PostgreSQL's CASCADE propagated deletions across the entire app schema

## Recovery

1. Located real user data in compressed backup: `backups/app-schema-20260314-180001.sql.gz`
2. Truncated fake data: `TRUNCATE app.users CASCADE`
3. Restored from backup: `zcat backup.sql.gz | psql -U smudoshi -d ohdsi`
4. Fixed admin password: `UPDATE app.users SET password = bcrypt('superuser'), must_change_password = false WHERE email = 'admin@acumenus.net'`
5. Removed stale `admin@parthenon.local` account
6. Re-seeded all app data individually via `--class=` flags
7. Re-imported OHDSI QueryLibrary (201 entries) and re-indexed Solr
8. Re-seeded Commons demo data via `commons:seed-demo`
9. Re-seeded data sources via `eunomia:seed-source` and `acumenus:seed-source`

## Permanent Fixes

### 1. Admin email corrected (commit 3b8b79b4)
All 5 seeders now use `admin@acumenus.net`. Zero remaining references to `admin@parthenon.local` in the codebase.

### 2. Production data guard in DatabaseSeeder (commit 4bc94351)
`DatabaseSeeder.run()` now checks for real users before running sample data seeders:

```php
$realUserCount = User::query()
    ->where('email', '!=', 'admin@acumenus.net')
    ->where('email', 'NOT LIKE', '%@example.%')
    ->where('email', 'NOT LIKE', '%@parthenon.local')
    ->count();

if ($realUserCount > 0) {
    // Only run safe infrastructure seeders (roles, providers, condition bundles)
    // Skip: cohorts, analyses, studies, commons, HEOR, PACS
    return;
}
```

Deploy output when real users exist:
```
Skipping sample data seeders — 15 real user(s) detected.
Run individual seeders with --class= if needed.
```

## Verified Recovery State

| Data | Count | Status |
|------|-------|--------|
| Users (all real) | 16 | Restored |
| Cohort definitions | 5 | Re-seeded |
| Concept sets | 12 | Re-seeded |
| Analyses (7 types) | 13 | Re-seeded |
| HEOR analyses | 5 | Re-seeded |
| Studies | 41 | Re-seeded |
| Commons (channels, messages, wiki) | 5/16/3 | Re-seeded |
| Sources | 4 | Re-seeded |
| Query Library + Solr | 201 | Re-imported |
| App settings | 1 | Restored |

## Lessons

1. **NEVER run db:seed blindly on databases with real users** — seeders are for fresh installs
2. **Compressed app-schema backups saved us** — the plain `parthenon-*.sql` backups were already post-wipe
3. **deploy.sh runs seeders every time** — the production guard makes this safe now
4. **Always verify admin credentials after any seeder run**
