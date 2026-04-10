<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Use the default connection (pgsql in prod, pgsql_testing in Pest).
        // Hardcoding ->connection('pgsql') bypasses the testing override and
        // causes migrate:fresh to hit the real parthenon database during tests.
        Schema::create('lab_reference_range_curated', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('measurement_concept_id');
            $table->unsignedInteger('unit_concept_id');
            $table->char('sex', 1);                       // 'M','F','A' (A = any)
            $table->unsignedSmallInteger('age_low')->nullable();
            $table->unsignedSmallInteger('age_high')->nullable();
            $table->decimal('range_low', 12, 4);
            $table->decimal('range_high', 12, 4);
            $table->string('source_ref', 64);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('measurement_concept_id');
            $table->index('unit_concept_id');
            // Unique index on (concept, unit, sex, age_low, age_high) is
            // created as a raw statement below so we can apply the PG 15+
            // NULLS NOT DISTINCT clause (not yet exposed by Laravel's Blueprint).
        });

        // Postgres 15+ supports NULLS NOT DISTINCT on unique indexes, which
        // treats NULL values as equal for uniqueness purposes. This lets us
        // keep age_low/age_high nullable while still catching duplicate
        // (concept, unit, sex, age_low, age_high) rows where one or both
        // age bounds are NULL — without the sentinel-collision bug a
        // COALESCE approach would introduce (NULL and 0 would collide).
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX lrr_curated_uniq
            ON lab_reference_range_curated (
                measurement_concept_id,
                unit_concept_id,
                sex,
                age_low,
                age_high
            )
            NULLS NOT DISTINCT
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_reference_range_curated');
    }
};
