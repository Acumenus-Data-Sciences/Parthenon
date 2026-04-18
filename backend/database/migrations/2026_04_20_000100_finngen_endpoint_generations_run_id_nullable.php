<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13.2 — Drop NOT NULL on finngen.endpoint_generations.run_id.
 *
 * Why: Phase 13.2 D-04 reorders EndpointBrowserController::generate() to
 * upsert the FinnGenEndpointGeneration row BEFORE dispatching the Run
 * (so the controller can pass generation->id into run params as
 * `finngen_endpoint_generation_id`). That flip means run_id is unknown
 * at insert time. Rather than introduce a placeholder-then-backfill
 * pattern in the controller, drop the NOT NULL constraint here. Column
 * is still populated by the immediate `$generation->update(['run_id' => ...])`
 * call in the controller post-dispatch, so observed state is unchanged
 * for all non-racing reads.
 *
 * Idempotent via information_schema check — re-running is a no-op once applied.
 * No down(): reversing would break the controller reorder flow.
 *
 * See: .planning/phases/13.2-finish-finngen-cutover/13.2-CONTEXT.md §D-04
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'finngen'
       AND table_name   = 'endpoint_generations'
       AND column_name  = 'run_id'
       AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE finngen.endpoint_generations ALTER COLUMN run_id DROP NOT NULL;
  END IF;
END;
$mig$;
SQL);
    }

    public function down(): void
    {
        // No-op. Reversing would require backfilling NULL run_id rows (if any)
        // to a synthetic placeholder before re-applying NOT NULL — not worth
        // the risk. Phase 13.2 is additive; rollback path is plan-level revert.
    }
};
