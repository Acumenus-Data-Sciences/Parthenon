<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\ExecutionLog;
use App\Models\App\PathwayAnalysis;
use App\Models\App\Source;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PathwayService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Execute a pathway analysis.
     */
    public function execute(
        PathwayAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'Pathway analysis execution started', [
            'analysis_id' => $analysis->id,
            'source_id' => $source->id,
        ]);

        try {
            $design = $analysis->design_json;
            $targetCohortId = $design['targetCohortId'];
            $eventCohortIds = $design['eventCohortIds'] ?? [];
            $maxDepth = $design['maxDepth'] ?? 5;
            $minCellCount = $design['minCellCount'] ?? 5;
            $combinationWindow = $design['combinationWindow'] ?? 1;
            $maxPathLength = $design['maxPathLength'] ?? 5;

            if (empty($eventCohortIds)) {
                throw new \RuntimeException('No event cohort IDs specified in pathway design.');
            }

            // Resolve schemas from source daimons
            $source->load('daimons');
            $resultsSchema = $source->getTableQualifier(DaimonType::Results);

            if ($resultsSchema === null) {
                throw new \RuntimeException(
                    'Source is missing required Results schema configuration.'
                );
            }

            $dialect = $source->source_dialect ?? 'postgresql';
            $cohortTable = "{$resultsSchema}.cohort";
            $connectionName = $source->source_connection ?? 'omop';

            // Step 1: Get target cohort count
            $this->log($execution, 'info', "Counting target cohort members (cohort_id={$targetCohortId})");

            $targetCountSql = $this->buildTargetCountSql($cohortTable, $targetCohortId);
            $renderedTargetCountSql = $this->sqlRenderer->render(
                $targetCountSql,
                ['resultsSchema' => $resultsSchema, 'cohortTable' => $cohortTable],
                $dialect,
            );

            $targetCountRows = DB::connection($connectionName)->select($renderedTargetCountSql);
            $targetCount = ! empty($targetCountRows) ? (int) $targetCountRows[0]->target_count : 0;

            $this->log($execution, 'info', "Target cohort has {$targetCount} members");

            if ($targetCount === 0) {
                $execution->update([
                    'status' => ExecutionStatus::Completed,
                    'completed_at' => now(),
                    'result_json' => [
                        'target_cohort_id' => $targetCohortId,
                        'target_count' => 0,
                        'pathways' => [],
                        'event_cohorts' => [],
                        'summary' => [
                            'unique_pathways' => 0,
                            'persons_with_events' => 0,
                            'persons_without_events' => 0,
                        ],
                    ],
                ]);

                $this->log($execution, 'info', 'Pathway analysis completed (no target members)');

                return;
            }

            // Step 2: Build event cohort name map
            $eventCohortNames = $this->buildEventCohortNames($eventCohortIds);

            // Step 3: Get ordered events for all target members
            $this->log($execution, 'info', 'Querying ordered events for target cohort members');

            $orderedEventsSql = $this->buildOrderedEventsSql(
                $cohortTable,
                $targetCohortId,
                $eventCohortIds,
            );
            $renderedOrderedEventsSql = $this->sqlRenderer->render(
                $orderedEventsSql,
                ['resultsSchema' => $resultsSchema, 'cohortTable' => $cohortTable],
                $dialect,
            );

            $eventRows = DB::connection($connectionName)->select($renderedOrderedEventsSql);

            $this->log($execution, 'info', 'Retrieved '.count($eventRows).' event records');

            // Step 4: Process events in PHP to build pathways
            $this->log($execution, 'info', 'Processing event sequences into pathways');

            $pathways = $this->buildPathways(
                $eventRows,
                $combinationWindow,
                $maxDepth,
                $eventCohortNames,
            );

            // Step 5: Count pathway occurrences
            $pathwayCounts = [];
            $personsWithEvents = 0;

            foreach ($pathways as $subjectId => $pathway) {
                if (! empty($pathway)) {
                    $personsWithEvents++;
                    $pathKey = implode(' -> ', $pathway);

                    if (! isset($pathwayCounts[$pathKey])) {
                        $pathwayCounts[$pathKey] = [
                            'path' => $pathway,
                            'count' => 0,
                        ];
                    }

                    $pathwayCounts[$pathKey]['count']++;
                }
            }

            // Sort by count descending
            usort($pathwayCounts, fn ($a, $b) => $b['count'] <=> $a['count']);

            // Step 6: Apply minCellCount and compute percentages
            $filteredPathways = [];

            foreach ($pathwayCounts as $pw) {
                if ($pw['count'] >= $minCellCount) {
                    $filteredPathways[] = [
                        'path' => $pw['path'],
                        'count' => $pw['count'],
                        'percent' => $targetCount > 0
                            ? round(($pw['count'] / $targetCount) * 100, 2)
                            : 0,
                    ];
                }
            }

            $personsWithoutEvents = $targetCount - $personsWithEvents;

            $results = [
                'target_cohort_id' => $targetCohortId,
                'target_count' => $targetCount,
                'pathways' => $filteredPathways,
                'event_cohorts' => $eventCohortNames,
                'summary' => [
                    'unique_pathways' => count($pathwayCounts),
                    'persons_with_events' => $personsWithEvents,
                    'persons_without_events' => $personsWithoutEvents,
                ],
            ];

            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => $results,
            ]);

            $this->log($execution, 'info', 'Pathway analysis execution completed', [
                'unique_pathways' => count($pathwayCounts),
                'filtered_pathways' => count($filteredPathways),
                'persons_with_events' => $personsWithEvents,
            ]);

            Log::info('Pathway analysis execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'Pathway analysis execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Pathway analysis execution failed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Build SQL to count target cohort members.
     */
    private function buildTargetCountSql(string $cohortTable, int $targetCohortId): string
    {
        return "
            SELECT COUNT(DISTINCT subject_id) AS target_count
            FROM {$cohortTable}
            WHERE cohort_definition_id = {$targetCohortId}
        ";
    }

    /**
     * Build SQL to get ordered events for target cohort members.
     *
     * @param  list<int>  $eventCohortIds
     */
    private function buildOrderedEventsSql(
        string $cohortTable,
        int $targetCohortId,
        array $eventCohortIds,
    ): string {
        $eventIdList = implode(', ', array_map('intval', $eventCohortIds));

        return "
            WITH target_cohort AS (
                SELECT DISTINCT subject_id, cohort_start_date, cohort_end_date
                FROM {$cohortTable}
                WHERE cohort_definition_id = {$targetCohortId}
            ),
            events AS (
                SELECT
                    e.subject_id,
                    e.cohort_definition_id AS event_cohort_id,
                    e.cohort_start_date AS event_start_date,
                    e.cohort_end_date AS event_end_date
                FROM {$cohortTable} e
                INNER JOIN target_cohort t
                    ON e.subject_id = t.subject_id
                    AND e.cohort_start_date >= t.cohort_start_date
                    AND e.cohort_start_date <= t.cohort_end_date
                WHERE e.cohort_definition_id IN ({$eventIdList})
            )
            SELECT
                subject_id,
                event_cohort_id,
                event_start_date,
                event_end_date,
                ROW_NUMBER() OVER (
                    PARTITION BY subject_id
                    ORDER BY event_start_date, event_cohort_id
                ) AS event_order
            FROM events
            ORDER BY subject_id, event_start_date, event_cohort_id
        ";
    }

    /**
     * Build event cohort name map.
     * Uses numeric labels like "Cohort 2", "Cohort 3" etc.
     * In a full implementation, this would query cohort definitions for names.
     *
     * @param  list<int>  $eventCohortIds
     * @return array<int, string>
     */
    private function buildEventCohortNames(array $eventCohortIds): array
    {
        $names = [];

        foreach ($eventCohortIds as $id) {
            $names[$id] = "Cohort {$id}";
        }

        return $names;
    }

    /**
     * Process event rows into pathway sequences per person.
     *
     * Groups events within the combination window, then truncates
     * sequences at maxDepth steps.
     *
     * @param  list<object>  $eventRows
     * @param  array<int, string>  $eventCohortNames
     * @return array<int, list<string>>
     */
    private function buildPathways(
        array $eventRows,
        int $combinationWindow,
        int $maxDepth,
        array $eventCohortNames,
    ): array {
        // Group events by subject_id
        $eventsBySubject = [];

        foreach ($eventRows as $row) {
            $subjectId = (int) $row->subject_id;
            $eventsBySubject[$subjectId][] = $row;
        }

        $pathways = [];

        foreach ($eventsBySubject as $subjectId => $events) {
            $pathway = $this->buildPersonPathway(
                $events,
                $combinationWindow,
                $maxDepth,
                $eventCohortNames,
            );
            $pathways[$subjectId] = $pathway;
        }

        return $pathways;
    }

    /**
     * Build the pathway sequence for a single person.
     *
     * @param  list<object>  $events
     * @param  array<int, string>  $eventCohortNames
     * @return list<string>
     */
    private function buildPersonPathway(
        array $events,
        int $combinationWindow,
        int $maxDepth,
        array $eventCohortNames,
    ): array {
        if (empty($events)) {
            return [];
        }

        // Group events that start within the combination window
        $groups = [];
        $currentGroup = [$events[0]];
        $currentGroupStart = strtotime($events[0]->event_start_date);

        for ($i = 1; $i < count($events); $i++) {
            $eventStart = strtotime($events[$i]->event_start_date);
            $daysDiff = ($eventStart - $currentGroupStart) / 86400;

            if ($daysDiff <= $combinationWindow) {
                $currentGroup[] = $events[$i];
            } else {
                $groups[] = $currentGroup;
                $currentGroup = [$events[$i]];
                $currentGroupStart = $eventStart;
            }
        }

        $groups[] = $currentGroup;

        // Build pathway steps from groups, truncated at maxDepth
        $pathway = [];

        foreach ($groups as $group) {
            if (count($pathway) >= $maxDepth) {
                break;
            }

            $stepLabel = $this->getComboKey($group, $eventCohortNames);

            // Avoid consecutive duplicate steps
            if (empty($pathway) || end($pathway) !== $stepLabel) {
                $pathway[] = $stepLabel;
            }
        }

        return $pathway;
    }

    /**
     * Build a label for a group of events within the combination window.
     *
     * Merges multiple concurrent events into a combination string,
     * e.g., "Drug A + Drug B".
     *
     * @param  list<object>  $events
     * @param  array<int, string>  $eventCohortNames
     */
    public function getComboKey(array $events, array $eventCohortNames): string
    {
        $uniqueCohortIds = array_unique(
            array_map(fn ($e) => (int) $e->event_cohort_id, $events)
        );

        sort($uniqueCohortIds);

        $names = array_map(
            fn ($id) => $eventCohortNames[$id] ?? "Cohort {$id}",
            $uniqueCohortIds,
        );

        return implode(' + ', $names);
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
}
