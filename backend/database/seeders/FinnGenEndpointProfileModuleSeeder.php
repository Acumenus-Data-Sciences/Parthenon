<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\App\FinnGen\AnalysisModule;
use Illuminate\Database\Seeder;

/**
 * Seeds the co2.endpoint_profile analysis module added in Phase 18 (GENOMICS-09/10/11).
 *
 * Kept separate from FinnGenAnalysisModuleSeeder so that the base seeder's
 * module count (11) remains stable for the registry unit test, while Phase 18
 * and later modules are additive via their own seeders.
 *
 * Idempotent via updateOrCreate.
 */
class FinnGenEndpointProfileModuleSeeder extends Seeder
{
    public function run(): void
    {
        AnalysisModule::updateOrCreate(
            ['key' => 'co2.endpoint_profile'],
            [
                'label' => 'Endpoint Profile (Risteys-style)',
                'description' => 'Computes per-endpoint Kaplan-Meier survival, top-50 comorbidity matrix (phi-coefficient), and 90-day pre-index ATC3 drug-class distribution for a given (endpoint × source) pair. Writes to {source}_co2_results.endpoint_profile_* tables.',
                'darkstar_endpoint' => '/finngen/co2/endpoint-profile',
                'enabled' => true,
                'min_role' => 'researcher',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['endpoint_name', 'source_key', 'expression_hash'],
                    'properties' => [
                        'endpoint_name' => ['type' => 'string', 'title' => 'FinnGen endpoint name'],
                        'source_key' => ['type' => 'string', 'title' => 'CDM source key'],
                        'expression_hash' => ['type' => 'string', 'title' => 'SHA-256 of qualifying_event_spec'],
                        'min_subjects' => ['type' => 'integer', 'title' => 'Minimum subjects for KM (default 20)'],
                        'cohort_definition_id' => ['type' => ['integer', 'null'], 'title' => 'Cohort id (null = on-the-fly from expression)'],
                        'condition_concept_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                        'drug_concept_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                        'source_concept_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                        'source_has_death_data' => ['type' => 'boolean'],
                        'source_has_drug_data' => ['type' => 'boolean'],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'subject_count' => ['type' => 'integer'],
                        'death_count' => ['type' => 'integer'],
                        'km_points_written' => ['type' => 'integer'],
                        'comorbidities_written' => ['type' => 'integer'],
                        'drug_classes_written' => ['type' => 'integer'],
                    ],
                ],
                'result_component' => 'EndpointProfileResults',
            ]
        );
    }
}
