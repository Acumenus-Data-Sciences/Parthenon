<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GisBoundaryLevelSeeder extends Seeder
{
    public function run(): void
    {
        $levels = [
            ['code' => 'ADM0', 'label' => 'Country', 'description' => 'National boundary', 'sort_order' => 0],
            ['code' => 'ADM1', 'label' => 'Province / State', 'description' => 'First-level administrative division', 'sort_order' => 1],
            ['code' => 'ADM2', 'label' => 'District / County', 'description' => 'Second-level administrative division', 'sort_order' => 2],
            ['code' => 'ADM3', 'label' => 'Sub-district', 'description' => 'Third-level administrative division', 'sort_order' => 3],
            ['code' => 'ADM4', 'label' => 'Municipality', 'description' => 'Fourth-level administrative division', 'sort_order' => 4],
            ['code' => 'ADM5', 'label' => 'Local Area', 'description' => 'Fifth-level administrative division', 'sort_order' => 5],
        ];

        foreach ($levels as $level) {
            DB::table('app.gis_boundary_levels')->updateOrInsert(
                ['code' => $level['code']],
                array_merge($level, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]),
            );
        }
    }
}
