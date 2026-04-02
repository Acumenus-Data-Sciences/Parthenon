<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('similarity_dimensions')->insert([
            [
                'key' => 'demographics',
                'name' => 'Demographics',
                'default_weight' => 1.0,
                'description' => 'Age, gender, and race matching',
                'config' => null,
                'is_active' => true,
            ],
            [
                'key' => 'conditions',
                'name' => 'Conditions',
                'default_weight' => 1.0,
                'description' => 'Diagnosis overlap using ancestor-weighted Jaccard similarity',
                'config' => json_encode(['ancestor_rollup_levels' => 3]),
                'is_active' => true,
            ],
            [
                'key' => 'measurements',
                'name' => 'Measurements',
                'default_weight' => 1.0,
                'description' => 'Lab value similarity using z-score normalized Euclidean distance',
                'config' => null,
                'is_active' => true,
            ],
            [
                'key' => 'drugs',
                'name' => 'Drugs',
                'default_weight' => 1.0,
                'description' => 'Medication overlap at ingredient level using Jaccard similarity',
                'config' => null,
                'is_active' => true,
            ],
            [
                'key' => 'procedures',
                'name' => 'Procedures',
                'default_weight' => 1.0,
                'description' => 'Procedure overlap using Jaccard similarity',
                'config' => null,
                'is_active' => true,
            ],
            [
                'key' => 'genomics',
                'name' => 'Genomics',
                'default_weight' => 1.0,
                'description' => 'Variant overlap weighted by pathogenicity tier',
                'config' => json_encode(['weights' => ['Pathogenic' => 3, 'Likely pathogenic' => 2, 'Uncertain significance' => 1]]),
                'is_active' => true,
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('similarity_dimensions')->whereIn('key', [
            'demographics',
            'conditions',
            'measurements',
            'drugs',
            'procedures',
            'genomics',
        ])->delete();
    }
};
