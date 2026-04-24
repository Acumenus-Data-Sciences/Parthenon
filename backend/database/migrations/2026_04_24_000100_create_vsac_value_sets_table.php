<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        Schema::create('vsac_value_sets', function (Blueprint $table) {
            $table->string('value_set_oid', 120)->primary();
            $table->string('name', 500);
            $table->string('definition_version', 50)->nullable();
            $table->string('expansion_version', 120)->nullable();
            $table->string('expansion_id', 50)->nullable();
            $table->string('qdm_category', 120)->nullable();
            $table->text('purpose_clinical_focus')->nullable();
            $table->text('purpose_data_scope')->nullable();
            $table->text('purpose_inclusion')->nullable();
            $table->text('purpose_exclusion')->nullable();
            $table->jsonb('source_files')->default(DB::raw("'[]'::jsonb"));
            $table->timestamp('ingested_at')->useCurrent();

            $table->index('name', 'idx_vsac_vs_name');
        });

        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('vsac_value_sets');
    }
};
