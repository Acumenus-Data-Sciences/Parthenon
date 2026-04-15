<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\App\FinnGen\AnalysisModule;
use Illuminate\Database\Seeder;

/**
 * Seeds the four SP1 FinnGen analysis modules. Idempotent via updateOrCreate —
 * safe to re-run. SP3 (Analysis Module Gallery) extends each row with
 * settings_schema, default_settings, result_schema, result_component.
 */
class FinnGenAnalysisModuleSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            [
                'key' => 'co2.codewas',
                'label' => 'CodeWAS',
                'description' => 'Phenome-wide association scan comparing case and control cohorts across all clinical codes.',
                'darkstar_endpoint' => '/finngen/co2/codewas',
            ],
            [
                'key' => 'co2.time_codewas',
                'label' => 'timeCodeWAS',
                'description' => 'CodeWAS stratified by temporal windows around index date.',
                'darkstar_endpoint' => '/finngen/co2/time-codewas',
            ],
            [
                'key' => 'co2.overlaps',
                'label' => 'Cohort Overlaps',
                'description' => 'Upset-plot-style overlap analysis across multiple cohorts.',
                'darkstar_endpoint' => '/finngen/co2/overlaps',
            ],
            [
                'key' => 'co2.demographics',
                'label' => 'Cohort Demographics',
                'description' => 'Demographic summary (age histogram, gender counts) for one or more cohorts.',
                'darkstar_endpoint' => '/finngen/co2/demographics',
            ],
            [
                'key' => 'romopapi.report',
                'label' => 'ROMOPAPI Report',
                'description' => 'HTML report with concept metadata, stratified counts, relationships, and hierarchy.',
                'darkstar_endpoint' => '/finngen/romopapi/report',
                'min_role' => 'researcher',
            ],
            [
                'key' => 'romopapi.setup',
                'label' => 'ROMOPAPI Source Setup',
                'description' => 'Materializes stratified_code_counts table for a CDM source. One-time per source.',
                'darkstar_endpoint' => '/finngen/romopapi/setup',
                'min_role' => 'admin',
            ],
        ];

        foreach ($modules as $mod) {
            AnalysisModule::updateOrCreate(
                ['key' => $mod['key']],
                $mod + ['enabled' => true, 'min_role' => 'researcher']
            );
        }
    }
}
