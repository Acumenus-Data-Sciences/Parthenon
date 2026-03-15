<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\ExecutionLog;
use App\Models\App\Source;
use App\Services\Analysis\Features\ConditionFeatureBuilder;
use App\Services\Analysis\Features\DemographicFeatureBuilder;
use App\Services\Analysis\Features\DrugFeatureBuilder;
use App\Services\Analysis\Features\FeatureBuilderInterface;
use App\Services\Analysis\Features\MeasurementFeatureBuilder;
use App\Services\Analysis\Features\ProcedureFeatureBuilder;
use App\Services\Analysis\Features\VisitFeatureBuilder;
use App\Services\SqlRenderer\SqlRendererService;
use App\Support\CharacterizationResultNormalizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CharacterizationService
{
    /**
     * @var array<string, FeatureBuilderInterface>
     */
    private array $builders = [];

    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {
        $this->registerBuilders();
    }

    /**
     * Register all available feature builders.
     */
    private function registerBuilders(): void
    {
        $builders = [
            new DemographicFeatureBuilder,
            new ConditionFeatureBuilder,
            new DrugFeatureBuilder,
            new ProcedureFeatureBuilder,
            new MeasurementFeatureBuilder,
            new VisitFeatureBuilder,
        ];

        foreach ($builders as $builder) {
            $this->builders[$builder->key()] = $builder;
        }
    }

    /**
     * Execute a characterization analysis.
     */
    public function execute(
        Characterization $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'Characterization execution started', [
            'analysis_id' => $analysis->id,
            'source_id' => $source->id,
        ]);

        try {
            $design = $analysis->design_json;
            $targetCohortIds = $design['targetCohortIds'] ?? [];
            $comparatorCohortIds = $design['comparatorCohortIds'] ?? [];
            $featureTypes = $design['featureTypes'] ?? array_keys($this->builders);
            $minCellCount = $design['minCellCount'] ?? 5;

            // Resolve schemas from source daimons
            $source->load('daimons');
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
            $resultsSchema = $source->getTableQualifier(DaimonType::Results);

            if ($cdmSchema === null || $resultsSchema === null) {
                throw new \RuntimeException(
                    'Source is missing required CDM or Results schema configuration.'
                );
            }

            $dialect = $source->source_dialect ?? 'postgresql';
            $cohortTable = "{$resultsSchema}.cohort";
            $connectionName = $source->source_connection ?? 'cdm';

            $results = [
                'targetCohorts' => [],
                'comparatorCohorts' => [],
            ];

            // Compute features for each target cohort
            foreach ($targetCohortIds as $cohortId) {
                $this->log($execution, 'info', "Processing target cohort {$cohortId}");
                $cohortResults = $this->computeFeaturesForCohort(
                    $cohortId,
                    $featureTypes,
                    $cdmSchema,
                    $vocabSchema,
                    $cohortTable,
                    $dialect,
                    $connectionName,
                    $minCellCount,
                    $execution,
                );
                $results['targetCohorts'][$cohortId] = $cohortResults;
            }

            // Compute features for comparator cohorts if specified
            if (! empty($comparatorCohortIds)) {
                foreach ($comparatorCohortIds as $cohortId) {
                    $this->log($execution, 'info', "Processing comparator cohort {$cohortId}");
                    $cohortResults = $this->computeFeaturesForCohort(
                        $cohortId,
                        $featureTypes,
                        $cdmSchema,
                        $vocabSchema,
                        $cohortTable,
                        $dialect,
                        $connectionName,
                        $minCellCount,
                        $execution,
                    );
                    $results['comparatorCohorts'][$cohortId] = $cohortResults;
                }

                // Compute standardized mean differences (SMD) between target and comparator cohorts
                foreach ($targetCohortIds as $targetId) {
                    foreach ($comparatorCohortIds as $comparatorId) {
                        $smdKey = "smd_{$targetId}_vs_{$comparatorId}";
                        $results[$smdKey] = $this->computeSmd(
                            $results['targetCohorts'][$targetId] ?? [],
                            $results['comparatorCohorts'][$comparatorId] ?? [],
                            $featureTypes,
                        );
                    }
                }
            }

            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => CharacterizationResultNormalizer::normalize($results),
            ]);

            $this->log($execution, 'info', 'Characterization execution completed');

            Log::info('Characterization execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'Characterization execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Characterization execution failed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Compute features for a single cohort.
     *
     * @param  list<string>  $featureTypes
     * @return array<string, list<array<string, mixed>>>
     */
    private function computeFeaturesForCohort(
        int $cohortDefinitionId,
        array $featureTypes,
        string $cdmSchema,
        string $vocabSchema,
        string $cohortTable,
        string $dialect,
        string $connectionName,
        int $minCellCount,
        AnalysisExecution $execution,
    ): array {
        $cohortResults = [];

        foreach ($featureTypes as $featureType) {
            $builder = $this->builders[$featureType] ?? null;

            if (! $builder) {
                $this->log($execution, 'warning', "Unknown feature type: {$featureType}");

                continue;
            }

            $this->log($execution, 'info', "Computing feature: {$builder->label()} for cohort {$cohortDefinitionId}");

            try {
                $rawSql = $builder->buildSql(
                    $cdmSchema,
                    $vocabSchema,
                    $cohortTable,
                    $cohortDefinitionId,
                    $dialect,
                );

                $renderedSql = $this->sqlRenderer->render(
                    $rawSql,
                    [
                        'cdmSchema' => $cdmSchema,
                        'vocabSchema' => $vocabSchema,
                        'cohortTable' => $cohortTable,
                    ],
                    $dialect,
                );

                // Demographics returns multiple statements (age, gender, race)
                if ($featureType === 'demographics') {
                    $statements = $this->splitStatements($renderedSql);
                    $featureResults = [];

                    foreach ($statements as $statement) {
                        $statement = trim($statement);
                        if ($statement !== '') {
                            $rows = DB::connection($connectionName)
                                ->select($statement);
                            $featureResults = array_merge(
                                $featureResults,
                                $this->applyMinCellCount(
                                    array_map(fn ($row) => (array) $row, $rows),
                                    $minCellCount,
                                ),
                            );
                        }
                    }

                    $cohortResults[$featureType] = $featureResults;
                } else {
                    $rows = DB::connection($connectionName)
                        ->select($renderedSql);

                    $cohortResults[$featureType] = $this->applyMinCellCount(
                        array_map(fn ($row) => (array) $row, $rows),
                        $minCellCount,
                    );
                }

                $this->log($execution, 'info', "Feature {$builder->label()} computed: ".count($cohortResults[$featureType]).' rows');
            } catch (\Throwable $e) {
                $this->log($execution, 'error', "Feature {$builder->label()} failed: {$e->getMessage()}");
                $cohortResults[$featureType] = [
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $cohortResults;
    }

    /**
     * Apply minimum cell count privacy protection.
     * Replace counts below the threshold with -1.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function applyMinCellCount(array $rows, int $minCellCount): array
    {
        return array_map(function (array $row) use ($minCellCount) {
            if (isset($row['person_count']) && $row['person_count'] > 0 && $row['person_count'] < $minCellCount) {
                $row['person_count'] = -1;
                $row['percent_value'] = -1;
            }

            return $row;
        }, $rows);
    }

    /**
     * Compute standardized mean differences between target and comparator feature sets.
     *
     * @param  array<string, list<array<string, mixed>>>  $targetFeatures
     * @param  array<string, list<array<string, mixed>>>  $comparatorFeatures
     * @param  list<string>  $featureTypes
     * @return array<string, list<array<string, mixed>>>
     */
    private function computeSmd(
        array $targetFeatures,
        array $comparatorFeatures,
        array $featureTypes,
    ): array {
        $smdResults = [];

        foreach ($featureTypes as $featureType) {
            $targetRows = $targetFeatures[$featureType] ?? [];
            $comparatorRows = $comparatorFeatures[$featureType] ?? [];

            // Skip if either has an error
            if (isset($targetRows['error']) || isset($comparatorRows['error'])) {
                continue;
            }

            // Index comparator rows by a key for matching
            $comparatorIndex = [];
            foreach ($comparatorRows as $row) {
                $key = $this->getRowKey($row, $featureType);
                $comparatorIndex[$key] = $row;
            }

            $smdForFeature = [];
            foreach ($targetRows as $targetRow) {
                $key = $this->getRowKey($targetRow, $featureType);
                $comparatorRow = $comparatorIndex[$key] ?? null;

                $targetPct = (float) ($targetRow['percent_value'] ?? 0);
                $comparatorPct = $comparatorRow ? (float) ($comparatorRow['percent_value'] ?? 0) : 0.0;

                // Skip masked values
                if ($targetPct < 0 || $comparatorPct < 0) {
                    $smd = null;
                } else {
                    // SMD for binary proportions: (p1 - p2) / sqrt((p1(1-p1) + p2(1-p2)) / 2)
                    $p1 = $targetPct / 100;
                    $p2 = $comparatorPct / 100;
                    $denominator = sqrt(($p1 * (1 - $p1) + $p2 * (1 - $p2)) / 2);
                    $smd = $denominator > 0 ? round(abs($p1 - $p2) / $denominator, 4) : 0.0;
                }

                $smdForFeature[] = array_merge($targetRow, [
                    'comparator_count' => $comparatorRow['person_count'] ?? 0,
                    'comparator_percent' => $comparatorPct,
                    'smd' => $smd,
                ]);
            }

            $smdResults[$featureType] = $smdForFeature;
        }

        return $smdResults;
    }

    /**
     * Get a unique key for a feature row to enable matching across cohorts.
     *
     * @param  array<string, mixed>  $row
     */
    private function getRowKey(array $row, string $featureType): string
    {
        if ($featureType === 'demographics') {
            return ($row['feature_name'] ?? '').'|'.($row['category'] ?? '');
        }

        return (string) ($row['concept_id'] ?? $row['category'] ?? '');
    }

    /**
     * Get available feature types.
     *
     * @return list<array{key: string, label: string}>
     */
    public function getAvailableFeatures(): array
    {
        return array_map(
            fn (FeatureBuilderInterface $builder) => [
                'key' => $builder->key(),
                'label' => $builder->label(),
            ],
            array_values($this->builders),
        );
    }

    /**
     * Log a message to the execution logs.
     *
     * @param  array<string, mixed>  $context
     */
    private function log(
        AnalysisExecution $execution,
        string $level,
        string $message,
        array $context = [],
    ): void {
        ExecutionLog::create([
            'execution_id' => $execution->id,
            'level' => $level,
            'message' => $message,
            'context' => ! empty($context) ? $context : null,
        ]);
    }

    /**
     * Split a multi-statement SQL string into individual statements.
     *
     * @return list<string>
     */
    private function splitStatements(string $sql): array
    {
        $statements = [];
        $current = '';
        $inSingleQuote = false;

        for ($i = 0; $i < strlen($sql); $i++) {
            $char = $sql[$i];

            if ($char === "'" && ($i === 0 || $sql[$i - 1] !== '\\')) {
                $inSingleQuote = ! $inSingleQuote;
            }

            if ($char === ';' && ! $inSingleQuote) {
                $trimmed = trim($current);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $current = '';
            } else {
                $current .= $char;
            }
        }

        $trimmed = trim($current);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }
}
