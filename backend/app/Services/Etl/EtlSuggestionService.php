<?php

namespace App\Services\Etl;

use App\Models\App\EtlFieldMapping;
use App\Models\App\EtlProject;
use App\Models\App\EtlTableMapping;
use App\Models\App\FieldProfile;
use App\Models\App\SourceProfile;
use Illuminate\Support\Facades\Log;

class EtlSuggestionService
{
    private const MIN_TABLE_SCORE = 0.5;

    private const MIN_FIELD_SCORE = 0.5;

    /**
     * Generate AI suggestions for an ETL project.
     * Returns summary of what was suggested.
     *
     * @return array{table_mappings: int, field_mappings: int}
     */
    public function suggest(EtlProject $project): array
    {
        $cdmSchema = config('cdm-schema-v54');
        if (! is_array($cdmSchema)) {
            return ['table_mappings' => 0, 'field_mappings' => 0];
        }

        // Get source tables from scan profile OR ingestion project field profiles
        $sourceTables = [];
        if ($project->scanProfile) {
            $sourceTables = $this->getSourceTables($project->scanProfile);
        } elseif ($project->ingestion_project_id) {
            $sourceTables = $this->getIngestionProjectTables($project->ingestion_project_id);
        }

        if (empty($sourceTables)) {
            return ['table_mappings' => 0, 'field_mappings' => 0];
        }
        $existingMappings = $project->tableMappings()->pluck('target_table', 'source_table')->toArray();

        $tableMappingsCreated = 0;
        $fieldMappingsCreated = 0;

        foreach ($sourceTables as $sourceTable => $sourceColumns) {
            // Find best CDM table match
            $bestCdmTable = null;
            $bestScore = 0;

            foreach ($cdmSchema as $cdmTable) {
                // Skip if already mapped
                if (isset($existingMappings[$sourceTable]) && $existingMappings[$sourceTable] === $cdmTable['name']) {
                    continue;
                }

                $score = EtlSuggestionScorer::tableScore($sourceTable, $cdmTable['name']);
                if ($score > $bestScore && $score >= self::MIN_TABLE_SCORE) {
                    $bestScore = $score;
                    $bestCdmTable = $cdmTable;
                }
            }

            if (! $bestCdmTable) {
                continue;
            }

            // Skip if this source table is already mapped to this CDM table
            $existing = EtlTableMapping::where('etl_project_id', $project->id)
                ->where('source_table', $sourceTable)
                ->where('target_table', $bestCdmTable['name'])
                ->first();

            if ($existing) {
                // Suggest field mappings for existing table mapping
                $fieldMappingsCreated += $this->suggestFieldMappings(
                    $existing, $sourceColumns, $bestCdmTable['columns'], $bestScore
                );

                continue;
            }

            // Create suggested table mapping
            $tableMapping = EtlTableMapping::create([
                'etl_project_id' => $project->id,
                'source_table' => $sourceTable,
                'target_table' => $bestCdmTable['name'],
                'logic' => 'AI suggested (confidence: '.round($bestScore * 100).'%)',
                'sort_order' => $tableMappingsCreated + 1,
            ]);
            $tableMappingsCreated++;

            // Suggest field mappings
            $fieldMappingsCreated += $this->suggestFieldMappings(
                $tableMapping, $sourceColumns, $bestCdmTable['columns'], $bestScore
            );
        }

        Log::info('ETL suggestions generated', [
            'project_id' => $project->id,
            'table_mappings' => $tableMappingsCreated,
            'field_mappings' => $fieldMappingsCreated,
        ]);

        return [
            'table_mappings' => $tableMappingsCreated,
            'field_mappings' => $fieldMappingsCreated,
        ];
    }

    /**
     * Get source tables grouped with their columns from the scan profile.
     *
     * @return array<string, list<array{name: string, type: string}>>
     */
    private function getSourceTables(SourceProfile $profile): array
    {
        $fields = FieldProfile::where('source_profile_id', $profile->id)->get();
        $tables = [];

        foreach ($fields as $field) {
            $tableName = $field->table_name;
            if (! $tableName) {
                continue;
            }

            if (! isset($tables[$tableName])) {
                $tables[$tableName] = [];
            }
            $tables[$tableName][] = [
                'name' => $field->column_name,
                'type' => $field->inferred_type ?? 'text',
            ];
        }

        return $tables;
    }

    /**
     * Get source tables from all field profiles across an ingestion project's jobs.
     *
     * @return array<string, list<array{name: string, type: string}>>
     */
    private function getIngestionProjectTables(int $ingestionProjectId): array
    {
        $fields = FieldProfile::whereHas('sourceProfile.ingestionJob', function ($q) use ($ingestionProjectId) {
            $q->where('ingestion_project_id', $ingestionProjectId);
        })->get();

        $tables = [];
        foreach ($fields as $field) {
            $tableName = $field->table_name;
            if (! $tableName) {
                continue;
            }
            if (! isset($tables[$tableName])) {
                $tables[$tableName] = [];
            }
            $tables[$tableName][] = [
                'name' => $field->column_name,
                'type' => $field->inferred_type ?? 'text',
            ];
        }

        return $tables;
    }

    /**
     * Return ranked field mapping suggestions for a specific table mapping WITHOUT creating records.
     *
     * @return list<array{target_column: string, is_required: bool, suggestions: list<array{source_column: string, score: float, mapping_type: string}>}>
     */
    public function suggestFieldsForTable(EtlTableMapping $tableMapping): array
    {
        $project = $tableMapping->project;

        // Resolve source columns for this specific source table
        $allSourceTables = [];
        if ($project->scanProfile) {
            $allSourceTables = $this->getSourceTables($project->scanProfile);
        } elseif ($project->ingestion_project_id) {
            $allSourceTables = $this->getIngestionProjectTables($project->ingestion_project_id);
        }

        $sourceColumns = $allSourceTables[$tableMapping->source_table] ?? [];
        if (empty($sourceColumns)) {
            return [];
        }

        // Get CDM columns for the target table
        $cdmSchema = config('cdm-schema-v54');
        if (! is_array($cdmSchema)) {
            return [];
        }

        $cdmColumns = [];
        foreach ($cdmSchema as $cdmTable) {
            if ($cdmTable['name'] === $tableMapping->target_table) {
                $cdmColumns = $cdmTable['columns'];
                break;
            }
        }

        if (empty($cdmColumns)) {
            return [];
        }

        // Get already-mapped CDM columns to skip them
        $mappedTargetColumns = $tableMapping->fieldMappings()
            ->pluck('target_column')
            ->toArray();

        $results = [];

        foreach ($cdmColumns as $cdmCol) {
            if (in_array($cdmCol['name'], $mappedTargetColumns, true)) {
                continue;
            }

            // Score ALL source columns, collect top 3 with score >= 0.4
            $candidates = [];
            foreach ($sourceColumns as $sourceCol) {
                $score = EtlSuggestionScorer::fieldScore(
                    $sourceCol['name'],
                    $cdmCol['name'],
                    $sourceCol['type']
                );
                if ($score >= 0.4) {
                    $inference = EtlSuggestionScorer::inferMappingWithLogic(
                        $sourceCol['name'],
                        $cdmCol['name'],
                        $sourceCol['type'] ?? null,
                        $cdmCol['type'] ?? null,
                        $cdmCol['fk_table'] ?? null,
                        $cdmCol['fk_domain'] ?? null,
                    );
                    $candidates[] = [
                        'source_column' => $sourceCol['name'],
                        'score' => round($score, 2),
                        'mapping_type' => $inference['mapping_type'],
                        'logic' => $inference['logic'],
                    ];
                }
            }

            // Sort by score descending and take top 3
            usort($candidates, fn (array $a, array $b): int => $b['score'] <=> $a['score']);
            $topCandidates = array_slice($candidates, 0, 3);

            $results[] = [
                'target_column' => $cdmCol['name'],
                'is_required' => $cdmCol['required'] ?? false,
                'suggestions' => $topCandidates,
            ];
        }

        return $results;
    }

    /**
     * Suggest field-level mappings for a table pair.
     *
     * @param  list<array{name: string, type: string}>  $sourceColumns
     * @param  list<array{name: string, type: string, required: bool, description: string}>  $cdmColumns
     */
    private function suggestFieldMappings(
        EtlTableMapping $tableMapping,
        array $sourceColumns,
        array $cdmColumns,
        float $tableConfidence,
    ): int {
        $count = 0;
        $usedSourceCols = [];

        foreach ($cdmColumns as $cdmCol) {
            // Skip if already mapped
            $existing = EtlFieldMapping::where('etl_table_mapping_id', $tableMapping->id)
                ->where('target_column', $cdmCol['name'])
                ->first();
            if ($existing) {
                continue;
            }

            // Find best source column match
            $bestSource = null;
            $bestScore = 0;

            foreach ($sourceColumns as $sourceCol) {
                if (in_array($sourceCol['name'], $usedSourceCols)) {
                    continue;
                }

                $score = EtlSuggestionScorer::fieldScore(
                    $sourceCol['name'], $cdmCol['name'], $sourceCol['type']
                );
                if ($score > $bestScore && $score >= self::MIN_FIELD_SCORE) {
                    $bestScore = $score;
                    $bestSource = $sourceCol;
                }
            }

            if (! $bestSource) {
                continue;
            }

            $mappingType = EtlSuggestionScorer::inferMappingType($cdmCol['name']);
            $confidence = round($bestScore * $tableConfidence, 2);

            EtlFieldMapping::create([
                'etl_table_mapping_id' => $tableMapping->id,
                'source_column' => $bestSource['name'],
                'target_column' => $cdmCol['name'],
                'mapping_type' => $mappingType,
                'logic' => null,
                'is_required' => $cdmCol['required'] ?? false,
                'confidence' => $confidence,
                'is_ai_suggested' => true,
                'is_reviewed' => false,
            ]);

            $usedSourceCols[] = $bestSource['name'];
            $count++;
        }

        return $count;
    }
}
