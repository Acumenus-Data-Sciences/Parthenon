<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\App\FinnGen\AnalysisModule;
use Illuminate\Database\Seeder;

/**
 * Seeds the finngen.prs.compute analysis module added in Phase 17 (GENOMICS-07).
 *
 * Kept separate from FinnGenAnalysisModuleSeeder so that the base seeder's
 * module count (11) remains stable for the registry unit test, while Phase 17
 * and later modules are additive via their own seeders.
 *
 * Idempotent via updateOrCreate.
 */
class FinnGenPrsAnalysisModuleSeeder extends Seeder
{
    public function run(): void
    {
        AnalysisModule::updateOrCreate(
            ['key' => 'finngen.prs.compute'],
            [
                'label' => 'Polygenic Risk Score (PRS) compute',
                'description' => 'Computes per-subject polygenic risk scores for a PGS Catalog score against a cohort using plink2 --score. Writes to {source}_gwas_results.prs_subject_scores keyed by (score_id, cohort_definition_id, subject_id).',
                'darkstar_endpoint' => '/finngen/prs/compute',
                'enabled' => true,
                'min_role' => 'researcher',
                'settings_schema' => [
                    'type' => 'object',
                    'required' => ['score_id', 'source_key'],
                    'properties' => [
                        'score_id' => ['type' => 'string', 'title' => 'PGS Catalog score id (PGS\d+)'],
                        'source_key' => ['type' => 'string', 'title' => 'CDM source key'],
                        'cohort_definition_id' => ['type' => ['integer', 'null'], 'title' => 'Target cohort id'],
                        'finngen_endpoint_generation_id' => ['type' => ['integer', 'null'], 'title' => 'FinnGen generation id (100B offset)'],
                        'overwrite_existing' => ['type' => 'boolean'],
                    ],
                ],
                'default_settings' => (object) [],
                'result_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'rows_written' => ['type' => 'integer'],
                        'score_id' => ['type' => 'string'],
                        'cohort_definition_id' => ['type' => 'number'],
                    ],
                ],
                'result_component' => null,
            ]
        );
    }
}
