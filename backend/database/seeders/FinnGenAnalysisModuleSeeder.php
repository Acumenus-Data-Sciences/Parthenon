<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\App\FinnGen\AnalysisModule;
use Illuminate\Database\Seeder;

/**
 * Seeds all FinnGen analysis modules. Idempotent via updateOrCreate.
 * SP3 adds settings_schema, default_settings, result_schema, result_component
 * for all 4 CO2 modules.
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
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['case_cohort_id', 'control_cohort_id'],
                    'properties' => [
                        'case_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Case Cohort',
                        ],
                        'control_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Control Cohort',
                        ],
                        'min_cell_count' => [
                            'type' => 'integer',
                            'title' => 'Minimum Cell Count',
                            'default' => 5,
                            'minimum' => 1,
                            'maximum' => 100,
                        ],
                    ],
                ],
                'default_settings' => [
                    'min_cell_count' => 5,
                ],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'signals' => ['type' => 'array'],
                        'thresholds' => ['type' => 'object'],
                        'summary' => ['type' => 'object'],
                    ],
                ],
                'result_component' => 'CodeWASResults',
            ],
            [
                'key' => 'co2.time_codewas',
                'label' => 'timeCodeWAS',
                'description' => 'CodeWAS stratified by temporal windows around index date.',
                'darkstar_endpoint' => '/finngen/co2/time-codewas',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['case_cohort_id', 'control_cohort_id'],
                    'properties' => [
                        'case_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Case Cohort',
                        ],
                        'control_cohort_id' => [
                            'type' => 'integer',
                            'title' => 'Control Cohort',
                        ],
                        'min_cell_count' => [
                            'type' => 'integer',
                            'title' => 'Minimum Cell Count',
                            'default' => 5,
                            'minimum' => 1,
                            'maximum' => 100,
                        ],
                        'time_windows' => [
                            'type' => 'array',
                            'title' => 'Time Windows',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'start_day' => ['type' => 'integer'],
                                    'end_day' => ['type' => 'integer'],
                                ],
                            ],
                            'default' => [
                                ['start_day' => -365, 'end_day' => -1],
                                ['start_day' => 0, 'end_day' => 30],
                            ],
                        ],
                    ],
                ],
                'default_settings' => [
                    'min_cell_count' => 5,
                    'time_windows' => [
                        ['start_day' => -365, 'end_day' => -1],
                        ['start_day' => 0, 'end_day' => 30],
                    ],
                ],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'windows' => ['type' => 'array'],
                        'summary' => ['type' => 'object'],
                    ],
                ],
                'result_component' => 'TimeCodeWASResults',
            ],
            [
                'key' => 'co2.overlaps',
                'label' => 'Cohort Overlaps',
                'description' => 'Upset-plot-style overlap analysis across multiple cohorts.',
                'darkstar_endpoint' => '/finngen/co2/overlaps',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['cohort_ids'],
                    'properties' => [
                        'cohort_ids' => [
                            'type' => 'array',
                            'title' => 'Cohorts to Compare',
                            'items' => ['type' => 'integer'],
                            'minItems' => 2,
                            'maxItems' => 10,
                        ],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'sets' => ['type' => 'array'],
                        'intersections' => ['type' => 'array'],
                        'matrix' => ['type' => 'array'],
                        'summary' => ['type' => 'object'],
                    ],
                ],
                'result_component' => 'OverlapsResults',
            ],
            [
                'key' => 'co2.demographics',
                'label' => 'Cohort Demographics',
                'description' => 'Demographic summary (age histogram, gender counts) for one or more cohorts.',
                'darkstar_endpoint' => '/finngen/co2/demographics',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['cohort_ids'],
                    'properties' => [
                        'cohort_ids' => [
                            'type' => 'array',
                            'title' => 'Cohorts',
                            'items' => ['type' => 'integer'],
                            'minItems' => 1,
                            'maxItems' => 20,
                        ],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'cohorts' => ['type' => 'array'],
                    ],
                ],
                'result_component' => 'DemographicsResults',
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
            // SP4 Phase D — Cohort matching (1:N propensity matching via HadesExtras)
            [
                'key' => 'cohort.match',
                'label' => 'Cohort Matching',
                'description' => 'Match a primary cohort against 1+ comparator cohorts on age/sex/index date. Outputs SMD diagnostics and a materialized matched cohort.',
                'darkstar_endpoint' => '/finngen/cohort/match',
                'min_role' => 'researcher',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['primary_cohort_id', 'comparator_cohort_ids'],
                    'properties' => [
                        'primary_cohort_id' => ['type' => 'integer', 'title' => 'Primary cohort'],
                        'comparator_cohort_ids' => [
                            'type' => 'array',
                            'title' => 'Comparator cohorts',
                            'items' => ['type' => 'integer'],
                            'minItems' => 1,
                            'maxItems' => 10,
                        ],
                        'ratio' => ['type' => 'integer', 'title' => 'Match ratio (1:N)', 'default' => 1, 'minimum' => 1, 'maximum' => 10],
                        'match_sex' => ['type' => 'boolean', 'title' => 'Match on sex', 'default' => true],
                        'match_birth_year' => ['type' => 'boolean', 'title' => 'Match on birth year', 'default' => true],
                        'max_year_difference' => ['type' => 'integer', 'title' => 'Max birth-year difference', 'default' => 1, 'minimum' => 0, 'maximum' => 10],
                    ],
                ],
                'default_settings' => [
                    'ratio' => 1,
                    'match_sex' => true,
                    'match_birth_year' => true,
                    'max_year_difference' => 1,
                ],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'counts' => ['type' => 'array'],
                    ],
                ],
                'result_component' => 'MatchingResults',
            ],
            // SP4 Polish 2 — Materialize an operation tree to a new cohort row
            [
                'key' => 'cohort.materialize',
                'label' => 'Materialize Cohort',
                'description' => 'Write the result of an operation tree (UNION/INTERSECT/MINUS) as a new cohort in the source cohort table. Used by the workbench Materialize step.',
                'darkstar_endpoint' => '/finngen/cohort/materialize',
                'min_role' => 'researcher',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['cohort_definition_id', 'subject_sql', 'cohort_schema', 'referenced_cohort_ids'],
                    'properties' => [
                        'cohort_definition_id' => ['type' => 'integer'],
                        'subject_sql' => ['type' => 'string'],
                        'cohort_schema' => ['type' => 'string'],
                        'referenced_cohort_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'subject_count' => ['type' => 'integer'],
                        'cohort_definition_id' => ['type' => 'integer'],
                    ],
                ],
                'result_component' => null,
            ],
            // Genomics #2 — Materialize a FinnGen endpoint definition against a CDM
            [
                'key' => 'endpoint.generate',
                'label' => 'Generate FinnGen Endpoint',
                'description' => 'Materialize a curated FinnGen endpoint (~5,161 from DF14) against a source CDM. Inserts one cohort row per qualifying subject (matched by condition + drug concept descendants) with index = MIN(event_date).',
                'darkstar_endpoint' => '/finngen/endpoint/generate',
                'min_role' => 'researcher',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['cohort_definition_id'],
                    'properties' => [
                        'cohort_definition_id' => ['type' => 'integer'],
                        'condition_concept_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                        'drug_concept_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                        'source_concept_ids' => ['type' => 'array', 'items' => ['type' => 'integer']],
                        'sex_restriction' => ['type' => ['string', 'null'], 'enum' => ['male', 'female', null]],
                        'overwrite_existing' => ['type' => 'boolean'],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'subject_count' => ['type' => 'integer'],
                        'cohort_definition_id' => ['type' => 'integer'],
                    ],
                ],
                'result_component' => null,
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
