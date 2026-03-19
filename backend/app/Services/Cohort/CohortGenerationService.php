<?php

namespace App\Services\Cohort;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CohortGenerationService
{
    public function __construct(
        private readonly CohortSqlCompiler $compiler,
    ) {}

    /**
     * Generate a cohort by compiling and executing the cohort expression SQL.
     *
     * This method:
     * 1. Creates a CohortGeneration record with Running status
     * 2. Resolves schema qualifiers from the Source
     * 3. Compiles the expression into SQL via CohortSqlCompiler
     * 4. Executes the SQL against the results database
     * 5. Counts the resulting cohort members
     * 6. Updates the generation record with final status
     */
    public function generate(CohortDefinition $cohortDef, Source $source): CohortGeneration
    {
        $generation = CohortGeneration::create([
            'cohort_definition_id' => $cohortDef->id,
            'source_id' => $source->id,
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        try {
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
            $resultsSchema = $source->getTableQualifier(DaimonType::Results);

            if ($cdmSchema === null || $resultsSchema === null) {
                throw new \RuntimeException(
                    'Source is missing required CDM or Results schema configuration.'
                );
            }

            $dialect = $source->source_dialect ?? 'postgresql';

            Log::info('Cohort generation started', [
                'cohort_definition_id' => $cohortDef->id,
                'source_id' => $source->id,
                'generation_id' => $generation->id,
            ]);

            $sql = $this->compiler->compile(
                expression: $cohortDef->expression_json,
                cdmSchema: $cdmSchema,
                vocabSchema: $vocabSchema,
                resultsSchema: $resultsSchema,
                cohortDefinitionId: $cohortDef->id,
                dialect: $dialect,
            );

            // Execute the compiled SQL on the source connection
            $connectionName = $source->source_connection ?? 'omop';
            DB::connection($connectionName)->unprepared($sql);

            // Count distinct persons in the generated cohort
            $count = DB::connection($connectionName)
                ->table("{$resultsSchema}.cohort")
                ->where('cohort_definition_id', $cohortDef->id)
                ->distinct()
                ->count('subject_id');

            $generation->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'person_count' => $count,
            ]);

            Log::info('Cohort generation completed', [
                'cohort_definition_id' => $cohortDef->id,
                'generation_id' => $generation->id,
                'person_count' => $count,
            ]);
        } catch (\Throwable $e) {
            Log::error('Cohort generation failed', [
                'cohort_definition_id' => $cohortDef->id,
                'generation_id' => $generation->id,
                'error' => $e->getMessage(),
            ]);

            $generation->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
        }

        return $generation->fresh();
    }

    /**
     * Get the compiled SQL for a cohort expression without executing it.
     *
     * Useful for SQL preview / debugging.
     */
    public function previewSql(CohortDefinition $cohortDef, Source $source): string
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $dialect = $source->source_dialect ?? 'postgresql';

        if ($cdmSchema === null) {
            throw new \RuntimeException('Source is missing required CDM schema configuration.');
        }

        return $this->compiler->preview(
            expression: $cohortDef->expression_json,
            cdmSchema: $cdmSchema,
            vocabSchema: $vocabSchema,
            dialect: $dialect,
        );
    }

    /**
     * Get cohort members for a generation.
     *
     * @return array{members: list<array<string, mixed>>, total: int}
     */
    public function getMembers(CohortGeneration $generation, int $limit = 100, int $offset = 0): array
    {
        $generation->load('source', 'cohortDefinition');

        $source = $generation->source;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        $connectionName = $source->source_connection ?? 'omop';

        $query = DB::connection($connectionName)
            ->table("{$resultsSchema}.cohort")
            ->where('cohort_definition_id', $generation->cohort_definition_id);

        $total = $query->count();

        $members = $query
            ->select([
                'subject_id',
                'cohort_start_date',
                'cohort_end_date',
            ])
            ->orderBy('subject_id')
            ->orderBy('cohort_start_date')
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->toArray();

        return [
            'members' => array_map(fn ($m) => (array) $m, $members),
            'total' => $total,
        ];
    }

    /**
     * Cancel a running cohort generation.
     */
    public function cancel(CohortGeneration $generation): CohortGeneration
    {
        if ($generation->status === ExecutionStatus::Running) {
            $generation->update([
                'status' => ExecutionStatus::Cancelled,
                'completed_at' => now(),
                'fail_message' => 'Generation cancelled by user.',
            ]);
        }

        return $generation->fresh();
    }
}
