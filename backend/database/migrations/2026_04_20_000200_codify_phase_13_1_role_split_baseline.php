<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 13.2 — Codify 3 role-split deviations (D4 + D5 + D6 from
 * `.planning/phases/13.1-finngen-schema-isolation/13.1-DEPLOY-LOG.md`)
 * as a regular idempotent migration so fresh environments
 * (parthenon_testing + future staging/prod) are consistent with the
 * current dev `parthenon` DB state.
 *
 * On DEV this migration is a no-op — all 3 statements were applied
 * manually during the 13.1 Task 2 cutover window and are already in
 * effect. Guards + EXCEPTION handlers make the migration safe to run
 * repeatedly.
 *
 * Statement 3 (GRANT CREATE ON DATABASE) may fail with
 * insufficient_privilege in environments where the migration role
 * is not a DB owner or superuser. The EXCEPTION clause catches this
 * and emits a NOTICE so operators can apply the grant manually as a
 * one-time bootstrap step.
 *
 * See:
 *   - .planning/phases/13.2-finish-finngen-cutover/13.2-CONTEXT.md §D-05/D-06/D-07
 *   - .planning/phases/13.2-finish-finngen-cutover/13.2-RESEARCH.md §Pitfall 1, §Example 3
 *   - .planning/phases/13.1-finngen-schema-isolation/13.1-DEPLOY-LOG.md §Deviations D4/D5/D6
 *   - HIGHSEC.spec.md §4.1 (owner = parthenon_migrator; explicit GRANTs to parthenon_app)
 */
return new class extends Migration
{
    public function up(): void
    {
        // Skip in CI / environments without the custom role split.
        $hasRoles = DB::selectOne("SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_migrator'");
        if (! $hasRoles) {
            return;
        }

        // Statement 1 (D5): transfer ownership of app.cohort_definitions to
        // parthenon_migrator. Guarded so a second run is a no-op.
        DB::statement(<<<'SQL'
DO $mig$
BEGIN
  IF (SELECT tableowner FROM pg_tables
        WHERE schemaname = 'app' AND tablename = 'cohort_definitions'
     ) IS DISTINCT FROM 'parthenon_migrator' THEN
    ALTER TABLE app.cohort_definitions OWNER TO parthenon_migrator;
  END IF;
END;
$mig$;
SQL);

        // Statement 2 (D6): re-grant DML privileges to parthenon_app.
        // Always safe to re-issue; idempotent by PG semantics.
        // Ownership transfer above drops the prior owner's implicit rights,
        // so this statement restores the runtime connection's DML surface.
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON app.cohort_definitions TO parthenon_app');

        // Statement 3 (D4): GRANT CREATE ON DATABASE <current> TO parthenon_migrator.
        // PG requires a literal identifier for the database name, so we
        // use EXECUTE format(...) with current_database() inside a DO block.
        // The EXCEPTION handler catches insufficient_privilege so the
        // migration runs cleanly in environments where the migration role
        // is not a DB owner / superuser (operators apply manually in that
        // case — documented in the 13.2 deploy runbook).
        DB::statement(<<<'SQL'
DO $mig$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO parthenon_migrator', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Phase 13.2: migration role cannot self-grant CREATE ON DATABASE %; apply manually as DB owner or superuser.', current_database();
END;
$mig$;
SQL);
    }

    public function down(): void
    {
        // No-op. These are additive hardening grants; reversing them would
        // break runtime. If full rollback is ever required, coordinate via
        // runbook — manual revocation + ownership restore via claude_dev.
    }
};
