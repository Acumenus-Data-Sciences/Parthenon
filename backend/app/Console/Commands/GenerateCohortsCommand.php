<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\Source;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Generate cohorts from CDM data using direct SQL.
 *
 * Creates clinically meaningful cohorts in the results schema's cohort table
 * so that analyses (IR, Estimation, Prediction, etc.) can execute against them.
 */
class GenerateCohortsCommand extends Command
{
    protected $signature = 'cohorts:generate
        {--source= : Source key (e.g., ACUMENUS, EUNOMIA)}
        {--fresh : Drop existing cohort rows before generating}';

    protected $description = 'Generate cohorts from CDM data for analysis execution';

    /**
     * Cohort definitions to generate.
     * Each entry: name, description, condition_concept_ids (for simple condition-based cohorts).
     *
     * @var list<array{name: string, description: string, concept_ids: list<int>, type: string}>
     */
    private array $cohortSpecs = [
        [
            'name' => 'Essential Hypertension',
            'description' => 'Persons with at least one diagnosis of essential hypertension (concept 320128) and ≥365 days prior observation.',
            'concept_ids' => [320128],
            'type' => 'condition',
        ],
        [
            'name' => 'Ischemic Heart Disease',
            'description' => 'Persons with at least one diagnosis of ischemic heart disease (concepts 319844, 4185932, 315286) and ≥365 days prior observation.',
            'concept_ids' => [319844, 4185932, 315286],
            'type' => 'condition',
        ],
        [
            'name' => 'Type 2 Diabetes Mellitus',
            'description' => 'Persons with at least one diagnosis of type 2 diabetes mellitus (concept 201826) and ≥365 days prior observation.',
            'concept_ids' => [201826, 443238],
            'type' => 'condition',
        ],
        [
            'name' => 'Lisinopril Users',
            'description' => 'Persons with at least one drug exposure to lisinopril (ingredient concept 1308216). Cohort entry = first exposure date.',
            'concept_ids' => [1308216],
            'type' => 'drug',
        ],
        [
            'name' => 'Acute Myocardial Infarction',
            'description' => 'Persons with at least one diagnosis of acute myocardial infarction (concept 4329847) and ≥365 days prior observation.',
            'concept_ids' => [4329847, 312327, 434376],
            'type' => 'condition',
        ],
    ];

    public function handle(): int
    {
        $sourceKey = $this->option('source');

        if (! $sourceKey) {
            $sources = Source::all(['id', 'source_name', 'source_key']);
            if ($sources->isEmpty()) {
                $this->error('No data sources configured. Run the installer or seed sources first.');

                return 1;
            }
            $sourceKey = $this->choice(
                'Select a data source',
                $sources->pluck('source_name', 'source_key')->toArray(),
            );
        }

        $source = Source::where('source_key', $sourceKey)->with('daimons')->first();
        if (! $source) {
            $this->error("Source '".(is_array($sourceKey) ? implode(',', $sourceKey) : (string) $sourceKey)."' not found.");

            return 1;
        }

        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        $connectionName = $source->source_connection ?? 'omop';

        if (! $cdmSchema || ! $resultsSchema) {
            $this->error('Source is missing CDM or Results schema daimon configuration.');

            return 1;
        }

        $this->info("Source: {$source->source_name}");
        $this->info("CDM schema: {$cdmSchema}, Results schema: {$resultsSchema}");
        $this->info("Connection: {$connectionName}");
        $this->newLine();

        // Ensure cohort table exists in results schema
        $this->ensureCohortTable($connectionName, $resultsSchema);

        if ($this->option('fresh')) {
            $this->warn('Clearing existing cohort rows...');
            DB::connection($connectionName)->statement("DELETE FROM {$resultsSchema}.cohort");
        }

        $user = \App\Models\User::first();
        $totalGenerated = 0;

        foreach ($this->cohortSpecs as $spec) {
            $this->info("Generating cohort: {$spec['name']}...");

            // Create or find the cohort definition in the app DB
            $cohortDef = CohortDefinition::firstOrCreate(
                ['name' => $spec['name']],
                [
                    'description' => $spec['description'],
                    'expression_json' => [
                        'type' => 'sql_direct',
                        'concept_ids' => $spec['concept_ids'],
                        'domain' => $spec['type'],
                    ],
                    'author_id' => $user?->id ?? 1,
                ],
            );

            $cohortDefId = $cohortDef->id;

            // Clear existing rows for this cohort
            DB::connection($connectionName)->statement(
                "DELETE FROM {$resultsSchema}.cohort WHERE cohort_definition_id = ?",
                [$cohortDefId],
            );

            // Generate cohort rows
            $count = match ($spec['type']) {
                'condition' => $this->generateConditionCohort(
                    $connectionName, $cdmSchema, $resultsSchema, $cohortDefId, $spec['concept_ids'],
                ),
                'drug' => $this->generateDrugCohort(
                    $connectionName, $cdmSchema, $vocabSchema, $resultsSchema, $cohortDefId, $spec['concept_ids'],
                ),
                default => 0,
            };

            // Record generation
            CohortGeneration::updateOrCreate(
                [
                    'cohort_definition_id' => $cohortDefId,
                    'source_id' => $source->id,
                ],
                [
                    'status' => ExecutionStatus::Completed,
                    'started_at' => now(),
                    'completed_at' => now(),
                    'person_count' => $count,
                ],
            );

            $this->info("  → {$count} subjects generated (cohort_definition_id={$cohortDefId})");
            $totalGenerated += $count;
        }

        $this->newLine();
        $this->info("Done! Generated {$totalGenerated} total cohort entries across ".count($this->cohortSpecs).' cohorts.');

        // Show summary
        $rows = [];
        foreach (CohortDefinition::all() as $cd) {
            $gen = CohortGeneration::where('cohort_definition_id', $cd->id)
                ->where('source_id', $source->id)
                ->latest()
                ->first();
            $rows[] = [$cd->id, $cd->name, $gen?->person_count ?? 'N/A', $gen?->status?->value ?? 'N/A'];
        }
        $this->table(['ID', 'Cohort', 'Subjects', 'Status'], $rows);

        return 0;
    }

    private function ensureCohortTable(string $connectionName, string $resultsSchema): void
    {
        $exists = DB::connection($connectionName)->selectOne(
            "SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = ? AND table_name = 'cohort'
            ) as exists",
            [$resultsSchema],
        );

        if (! $exists->exists) {
            $this->warn("Creating {$resultsSchema}.cohort table...");
            DB::connection($connectionName)->statement("
                CREATE TABLE {$resultsSchema}.cohort (
                    cohort_definition_id BIGINT NOT NULL,
                    subject_id BIGINT NOT NULL,
                    cohort_start_date DATE NOT NULL,
                    cohort_end_date DATE NOT NULL
                )
            ");
            DB::connection($connectionName)->statement(
                "CREATE INDEX idx_{$resultsSchema}_cohort_def_id ON {$resultsSchema}.cohort (cohort_definition_id)"
            );
            DB::connection($connectionName)->statement(
                "CREATE INDEX idx_{$resultsSchema}_cohort_subject ON {$resultsSchema}.cohort (subject_id)"
            );
            $this->info("  Created {$resultsSchema}.cohort with indexes.");
        }
    }

    /**
     * Generate a condition-based cohort.
     *
     * Entry: first condition occurrence date with ≥365 days prior observation.
     * Exit: observation period end date.
     */
    private function generateConditionCohort(
        string $connectionName,
        string $cdmSchema,
        string $resultsSchema,
        int $cohortDefId,
        array $conceptIds,
    ): int {
        $placeholders = implode(',', $conceptIds);

        $sql = "
            INSERT INTO {$resultsSchema}.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
            SELECT
                {$cohortDefId} AS cohort_definition_id,
                first_dx.person_id AS subject_id,
                first_dx.cohort_start_date,
                op.observation_period_end_date AS cohort_end_date
            FROM (
                SELECT
                    co.person_id,
                    MIN(co.condition_start_date) AS cohort_start_date
                FROM {$cdmSchema}.condition_occurrence co
                WHERE co.condition_concept_id IN ({$placeholders})
                GROUP BY co.person_id
            ) first_dx
            JOIN {$cdmSchema}.observation_period op
                ON first_dx.person_id = op.person_id
                AND first_dx.cohort_start_date >= op.observation_period_start_date
                AND first_dx.cohort_start_date <= op.observation_period_end_date
            WHERE first_dx.cohort_start_date >= (op.observation_period_start_date + INTERVAL '365 days')
        ";

        DB::connection($connectionName)->statement($sql);

        return (int) DB::connection($connectionName)->selectOne(
            "SELECT COUNT(DISTINCT subject_id) as cnt FROM {$resultsSchema}.cohort WHERE cohort_definition_id = ?",
            [$cohortDefId],
        )->cnt;
    }

    /**
     * Generate a drug-based cohort.
     *
     * Entry: first drug exposure date (using concept descendants for ingredient).
     * Exit: observation period end date.
     */
    private function generateDrugCohort(
        string $connectionName,
        string $cdmSchema,
        string $vocabSchema,
        string $resultsSchema,
        int $cohortDefId,
        array $conceptIds,
    ): int {
        $placeholders = implode(',', $conceptIds);

        $sql = "
            INSERT INTO {$resultsSchema}.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
            SELECT
                {$cohortDefId} AS cohort_definition_id,
                first_rx.person_id AS subject_id,
                first_rx.cohort_start_date,
                op.observation_period_end_date AS cohort_end_date
            FROM (
                SELECT
                    de.person_id,
                    MIN(de.drug_exposure_start_date) AS cohort_start_date
                FROM {$cdmSchema}.drug_exposure de
                JOIN {$vocabSchema}.concept_ancestor ca
                    ON de.drug_concept_id = ca.descendant_concept_id
                WHERE ca.ancestor_concept_id IN ({$placeholders})
                GROUP BY de.person_id
            ) first_rx
            JOIN {$cdmSchema}.observation_period op
                ON first_rx.person_id = op.person_id
                AND first_rx.cohort_start_date >= op.observation_period_start_date
                AND first_rx.cohort_start_date <= op.observation_period_end_date
            WHERE first_rx.cohort_start_date >= (op.observation_period_start_date + INTERVAL '365 days')
        ";

        DB::connection($connectionName)->statement($sql);

        return (int) DB::connection($connectionName)->selectOne(
            "SELECT COUNT(DISTINCT subject_id) as cnt FROM {$resultsSchema}.cohort WHERE cohort_definition_id = ?",
            [$cohortDefId],
        )->cnt;
    }
}
