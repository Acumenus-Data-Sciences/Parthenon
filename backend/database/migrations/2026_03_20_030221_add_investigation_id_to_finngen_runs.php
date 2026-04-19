<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $legacyExists = DB::selectOne("SELECT to_regclass('app.finngen_runs') AS table_name");
        if ($legacyExists?->table_name === null) {
            return;
        }

        Schema::table('app.finngen_runs', function (Blueprint $table) {
            $table->foreignId('investigation_id')->nullable()->constrained('investigations')->nullOnDelete();
            $table->index('investigation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $legacyExists = DB::selectOne("SELECT to_regclass('app.finngen_runs') AS table_name");
        if ($legacyExists?->table_name === null) {
            return;
        }

        Schema::table('app.finngen_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('investigation_id');
        });
    }
};
