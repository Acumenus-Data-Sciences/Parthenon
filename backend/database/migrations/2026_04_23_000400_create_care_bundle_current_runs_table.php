<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Grant REFERENCES on sources to parthenon_owner so the FK below can be
        // added when running as that role. Skipped gracefully if role is absent.
        try {
            DB::statement('GRANT REFERENCES ON TABLE app.sources TO parthenon_owner');
        } catch (Exception $e) {
            // Role may not exist in all environments; FK will succeed as superuser.
        }

        try {
            DB::statement('GRANT REFERENCES ON TABLE app.condition_bundles TO parthenon_owner');
        } catch (Exception $e) {
            // Role may not exist in all environments; FK will succeed as superuser.
        }

        // Conditional SET ROLE — skips gracefully when parthenon_owner is absent
        // (CI fresh DB, bare test envs) so the superuser caller proceeds directly.
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        Schema::create('care_bundle_current_runs', function (Blueprint $table) {
            $table->foreignId('condition_bundle_id')
                ->constrained('condition_bundles')
                ->cascadeOnDelete();
            $table->foreignId('source_id')
                ->constrained('sources')
                ->cascadeOnDelete();
            $table->foreignId('care_bundle_run_id')
                ->constrained('care_bundle_runs');
            $table->timestamp('updated_at')->useCurrent();

            $table->primary(['condition_bundle_id', 'source_id']);
        });

        // Restore the original session role so subsequent statements execute as
        // the connecting user, not parthenon_owner.
        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('care_bundle_current_runs');
    }
};
