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
        Schema::connection('pgsql')->create('lab_reference_range_curated', function (Blueprint $table) {
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
            // Partial unique: NULL age bounds collide by default in Postgres,
            // so we use COALESCE via a raw index in a follow-up statement.
        });

        // Postgres treats NULLs as distinct in unique indexes, which would
        // allow duplicate (concept, unit, sex, NULL, NULL) rows. Use COALESCE
        // sentinels to ensure uniqueness across null bounds.
        DB::connection('pgsql')->statement(<<<'SQL'
            CREATE UNIQUE INDEX lrr_curated_uniq
            ON lab_reference_range_curated (
                measurement_concept_id,
                unit_concept_id,
                sex,
                COALESCE(age_low, 0),
                COALESCE(age_high, 65535)
            )
        SQL);
    }

    public function down(): void
    {
        Schema::connection('pgsql')->dropIfExists('lab_reference_range_curated');
    }
};
