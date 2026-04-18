<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13.2-06: grant USAGE on schema `app` to FinnGen PG roles.
 *
 * Why: Phase 13.1's role-split established parthenon_finngen_ro as a
 * SELECT-only role on finngen.* + vocab.*, and parthenon_migrator as the
 * DDL role owning app.cohort_definitions. But neither role had USAGE on
 * the `app` schema itself, meaning:
 *   - parthenon_finngen_ro can't execute the promote-flow reverse lookup
 *     (`SELECT ... FROM app.cohort_definitions WHERE expression_json->>...`)
 *   - parthenon_migrator can't ALTER TABLE app.cohort_definitions DROP
 *     COLUMN coverage_profile in a fresh parthenon_testing bootstrap
 *     (Phase 13.1's isolate_finngen_schema migration).
 *
 * DEV had USAGE implicitly because app.* was originally owned by
 * parthenon_app. After 13.1's ALTER TABLE ... OWNER TO parthenon_migrator,
 * parthenon_finngen_ro's implicit USAGE on the schema disappeared.
 *
 * This migration codifies the USAGE grants so fresh environments
 * (parthenon_testing, staging bootstrap, eventual prod) get the same
 * cross-schema access baseline as DEV.
 *
 * Idempotency: guarded with `IF EXISTS (SELECT 1 FROM pg_roles ...)` so
 * the migration is a no-op in environments where a role happens to be
 * absent (e.g. minimal bootstraps). EXECUTE format() with %I quotes the
 * role identifier safely.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['parthenon_migrator', 'parthenon_finngen_ro', 'parthenon_finngen_rw'] as $role) {
            DB::statement(<<<SQL
DO \$grants\$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{$role}') THEN
        EXECUTE format('GRANT USAGE ON SCHEMA app TO %I', '{$role}');
    END IF;
END \$grants\$;
SQL);
        }
    }

    public function down(): void
    {
        // USAGE revocation is dangerous in a multi-role production DB —
        // explicit no-op. The DEV baseline cannot be safely reverted.
    }
};
