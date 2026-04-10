<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Must check ALL rows including soft-deleted — PostgreSQL ALTER COLUMN SET NOT NULL
        // applies to every row in the table, not just active records.
        $nullCount = DB::table('cohort_definitions')
            ->whereNull('domain')
            ->count();

        if ($nullCount > 0) {
            throw new RuntimeException(
                "Cannot make domain NOT NULL: {$nullCount} active cohorts still have NULL domain. "
                .'Run: php artisan cohort:backfill-domains'
            );
        }

        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->string('domain', 50)->nullable(false)->default('general')->change();
        });
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->string('domain', 50)->nullable()->default(null)->change();
        });
    }
};
