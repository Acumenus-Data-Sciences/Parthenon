<?php

namespace App\Services\Profiler;

use App\Models\App\SourceProfile;

class ScanComparisonService
{
    /**
     * Compare two source profile scans and return regressions, improvements, and schema changes.
     *
     * @return array{summary: array<string, mixed>, regressions: list<array<string, mixed>>, improvements: list<array<string, mixed>>, schema_changes: list<array<string, mixed>>}
     */
    public function compare(SourceProfile $current, SourceProfile $baseline): array
    {
        $currentFields = $current->fields()->get();
        $baselineFields = $baseline->fields()->get();

        // Index by table_name.column_name
        $currentIndex = [];
        foreach ($currentFields as $field) {
            $key = $field->table_name.'.'.$field->column_name;
            $currentIndex[$key] = $field;
        }

        $baselineIndex = [];
        foreach ($baselineFields as $field) {
            $key = $field->table_name.'.'.$field->column_name;
            $baselineIndex[$key] = $field;
        }

        $allKeys = array_unique(array_merge(array_keys($currentIndex), array_keys($baselineIndex)));
        sort($allKeys);

        $regressions = [];
        $improvements = [];
        $schemaChanges = [];

        foreach ($allKeys as $key) {
            [$tableName, $columnName] = explode('.', $key, 2);
            $inCurrent = isset($currentIndex[$key]);
            $inBaseline = isset($baselineIndex[$key]);

            // Schema changes: added, removed, or type changed
            if ($inCurrent && ! $inBaseline) {
                $schemaChanges[] = [
                    'table' => $tableName,
                    'column' => $columnName,
                    'change' => 'added',
                    'type' => $currentIndex[$key]->inferred_type,
                    'current_type' => $currentIndex[$key]->inferred_type,
                ];

                continue;
            }

            if (! $inCurrent && $inBaseline) {
                $schemaChanges[] = [
                    'table' => $tableName,
                    'column' => $columnName,
                    'change' => 'removed',
                    'type' => $baselineIndex[$key]->inferred_type,
                    'baseline_type' => $baselineIndex[$key]->inferred_type,
                ];

                continue;
            }

            // Both exist — check for type change
            $currentField = $currentIndex[$key];
            $baselineField = $baselineIndex[$key];

            if ($currentField->inferred_type !== $baselineField->inferred_type) {
                $schemaChanges[] = [
                    'table' => $tableName,
                    'column' => $columnName,
                    'change' => 'type_changed',
                    'type' => $currentField->inferred_type,
                    'baseline_type' => $baselineField->inferred_type,
                    'current_type' => $currentField->inferred_type,
                ];
            }

            // Null percentage: regression if increased > 5pp, improvement if decreased > 5pp
            $currentNull = (float) $currentField->null_percentage;
            $baselineNull = (float) $baselineField->null_percentage;
            $nullDelta = $currentNull - $baselineNull;

            if ($nullDelta > 5) {
                $regressions[] = [
                    'table' => $tableName,
                    'column' => $columnName,
                    'metric' => 'null_pct',
                    'baseline' => $baselineNull,
                    'current' => $currentNull,
                    'delta' => round($nullDelta, 2),
                ];
            } elseif ($nullDelta < -5) {
                $improvements[] = [
                    'table' => $tableName,
                    'column' => $columnName,
                    'metric' => 'null_pct',
                    'baseline' => $baselineNull,
                    'current' => $currentNull,
                    'delta' => round($nullDelta, 2),
                ];
            }

            // Distinct count: regression if dropped > 20%
            $currentDistinct = (int) $currentField->distinct_count;
            $baselineDistinct = (int) $baselineField->distinct_count;

            if ($baselineDistinct > 0) {
                $distinctDeltaPct = ($currentDistinct - $baselineDistinct) / $baselineDistinct * 100;

                if ($distinctDeltaPct < -20) {
                    $regressions[] = [
                        'table' => $tableName,
                        'column' => $columnName,
                        'metric' => 'distinct_count',
                        'baseline' => $baselineDistinct,
                        'current' => $currentDistinct,
                        'delta' => $currentDistinct - $baselineDistinct,
                    ];
                }
            }
        }

        $summary = [
            'grade_change' => [
                'baseline' => $baseline->overall_grade,
                'current' => $current->overall_grade,
            ],
            'regressions' => count($regressions),
            'improvements' => count($improvements),
            'schema_changes' => count($schemaChanges),
            'row_count_delta' => [
                'baseline' => $baseline->total_rows,
                'current' => $current->total_rows,
                'delta_pct' => round(
                    ($current->total_rows - $baseline->total_rows) / max($baseline->total_rows, 1) * 100,
                    1,
                ),
            ],
        ];

        return [
            'summary' => $summary,
            'regressions' => $regressions,
            'improvements' => $improvements,
            'schema_changes' => $schemaChanges,
        ];
    }
}
