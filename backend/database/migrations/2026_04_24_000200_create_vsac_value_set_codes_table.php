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

        Schema::create('vsac_value_set_codes', function (Blueprint $table) {
            $table->id();
            $table->string('value_set_oid', 120);
            $table->string('code', 100);
            $table->text('description')->nullable();
            $table->string('code_system', 80);
            $table->string('code_system_oid', 120)->nullable();
            $table->string('code_system_version', 50)->nullable();

            $table->foreign('value_set_oid')
                ->references('value_set_oid')
                ->on('vsac_value_sets')
                ->cascadeOnDelete();

            $table->unique(['value_set_oid', 'code', 'code_system'], 'uq_vsac_vsc_oid_code_sys');
            $table->index(['code_system', 'code'], 'idx_vsac_vsc_sys_code');
            $table->index('value_set_oid', 'idx_vsac_vsc_oid');
        });

        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('vsac_value_set_codes');
    }
};
