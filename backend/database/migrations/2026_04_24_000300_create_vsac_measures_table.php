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

        Schema::create('vsac_measures', function (Blueprint $table) {
            $table->string('cms_id', 50)->primary();
            $table->string('cbe_number', 50)->nullable();
            $table->string('program_candidate', 50)->nullable();
            $table->string('title', 500)->nullable();
            $table->string('expansion_version', 120)->nullable();
            $table->timestamp('ingested_at')->useCurrent();
        });

        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('vsac_measures');
    }
};
