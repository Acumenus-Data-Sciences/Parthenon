<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 17 prerequisite (per 17-RESEARCH.md §CRITICAL Pitfall lines 414-454):
 *
 * The `vocab` schema is owned by DBA `smudoshi` (or `claude_dev` in some
 * environments), not `parthenon_owner`. `parthenon_migrator` has USAGE but
 * NOT CREATE on vocab. This migration grants CREATE so downstream Phase 17
 * migrations (2026_04_25_000100_create_pgs_catalog_tables.php) can
 * `CREATE TABLE vocab.pgs_scores` / `vocab.pgs_score_variants`.
 *
 * This migration MUST be applied by a DB superuser or by a role that is
 * a member of the vocab schema owner. When `./deploy.sh --db` runs as
 * `parthenon_migrator` (the default), the GRANT statement will not take
 * effect because that role does not own vocab. We emit the GRANT
 * defensively (it is a no-op if privilege was already granted) and then
 * verify the result via `has_schema_privilege`. If the verify fails we
 * throw with the exact remediation command so the operator can unblock
 * the deploy in one shot.
 *
 * Idempotent: re-running after a successful first pass is a no-op — the
 * GRANT is issued unconditionally (PG treats a re-grant as a no-op) and
 * the verify check succeeds.
 *
 * Operator runbook (captured in DEPLOY-LOG for Plan 07):
 *   sudo -u postgres psql parthenon -c "GRANT CREATE ON SCHEMA vocab TO parthenon_migrator;"
 */
return new class extends Migration
{
    public function up(): void
    {
        // Attempt the grant. If the current role cannot grant (e.g. running as
        // parthenon_migrator on fresh envs), PG raises insufficient_privilege
        // — catch and fall through to the verify below which will throw with
        // the operator remediation. Idempotent: re-running is a no-op.
        try {
            DB::statement('GRANT CREATE ON SCHEMA vocab TO parthenon_migrator');
        } catch (Throwable) {
            // Fall through to the verify below.
        }

        $runner = DB::connection()->getConfig('username');
        $row = DB::selectOne(
            "SELECT has_schema_privilege('parthenon_migrator', 'vocab', 'CREATE') AS c"
        );
        $hasCreate = (bool) ($row?->c ?? false);

        if (! $hasCreate) {
            throw new RuntimeException(sprintf(
                'Phase 17 prerequisite: parthenon_migrator lacks CREATE on schema vocab '
                .'(running as %s). Apply as DB superuser and re-run deploy: '
                .'`sudo -u postgres psql parthenon -c "GRANT CREATE ON SCHEMA vocab TO parthenon_migrator;"`',
                (string) $runner
            ));
        }
    }

    public function down(): void
    {
        // Intentional no-op: revoking CREATE on vocab from parthenon_migrator would
        // break all Phase 17+ vocab migrations. If a rollback is truly needed, run
        // `sudo -u postgres psql parthenon -c "REVOKE CREATE ON SCHEMA vocab FROM parthenon_migrator;"`
        // manually.
    }
};
