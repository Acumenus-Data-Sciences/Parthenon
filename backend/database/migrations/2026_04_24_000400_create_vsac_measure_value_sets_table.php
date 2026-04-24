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

        Schema::create('vsac_measure_value_sets', function (Blueprint $table) {
            $table->string('cms_id', 50);
            $table->string('value_set_oid', 120);

            $table->foreign('cms_id')
                ->references('cms_id')
                ->on('vsac_measures')
                ->cascadeOnDelete();

            $table->foreign('value_set_oid')
                ->references('value_set_oid')
                ->on('vsac_value_sets')
                ->cascadeOnDelete();

            $table->primary(['cms_id', 'value_set_oid']);
            $table->index('value_set_oid', 'idx_vsac_mvs_oid');
        });

        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('vsac_measure_value_sets');
    }
};
