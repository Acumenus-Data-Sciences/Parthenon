<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE genomic_variants ALTER COLUMN reference_allele TYPE text');
        DB::statement('ALTER TABLE genomic_variants ALTER COLUMN alternate_allele TYPE text');
        DB::statement('ALTER TABLE genomic_variants ALTER COLUMN measurement_source_value TYPE text');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE genomic_variants ALTER COLUMN reference_allele TYPE varchar(500)');
        DB::statement('ALTER TABLE genomic_variants ALTER COLUMN alternate_allele TYPE varchar(500)');
        DB::statement('ALTER TABLE genomic_variants ALTER COLUMN measurement_source_value TYPE varchar(255)');
    }
};
