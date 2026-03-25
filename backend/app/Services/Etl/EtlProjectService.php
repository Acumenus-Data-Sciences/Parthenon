<?php

namespace App\Services\Etl;

use App\Models\App\EtlProject;
use App\Models\App\Source;
use App\Models\User;

class EtlProjectService
{
    /**
     * Create a new ETL mapping project.
     *
     * @param  array<string, mixed>  $data
     */
    public function createProject(Source $source, array $data, User $user): EtlProject
    {
        return EtlProject::create([
            'source_id' => $source->id,
            'cdm_version' => $data['cdm_version'] ?? '5.4',
            'name' => $source->source_name.' → CDM '.($data['cdm_version'] ?? '5.4'),
            'status' => 'draft',
            'created_by' => $user->id,
            'scan_profile_id' => $data['scan_profile_id'],
            'notes' => $data['notes'] ?? null,
        ]);
    }

    /**
     * Get project with table mappings and field mapping counts.
     */
    public function getProjectWithMappings(EtlProject $project): EtlProject
    {
        return $project->load(['tableMappings' => function ($q) {
            $q->withCount('fieldMappings');
        }, 'source', 'scanProfile']);
    }

    /**
     * Compute mapping progress for a project.
     *
     * @return array{mapped_tables: int, total_cdm_tables: int, field_coverage_pct: float}
     */
    public function computeProgress(EtlProject $project): array
    {
        $cdmSchema = config('cdm-schema-v54');
        $totalCdmTables = is_array($cdmSchema) ? count($cdmSchema) : 0;

        $tableMappings = $project->tableMappings()->get();
        $mappedTables = $tableMappings->pluck('target_table')->unique()->count();

        $totalFields = 0;
        $mappedFields = 0;

        foreach ($tableMappings as $tm) {
            $fieldCount = $tm->fieldMappings()->count();
            $mapped = $tm->fieldMappings()->whereNotNull('source_column')->count();
            $totalFields += $fieldCount;
            $mappedFields += $mapped;
        }

        return [
            'mapped_tables' => $mappedTables,
            'total_cdm_tables' => $totalCdmTables,
            'field_coverage_pct' => $totalFields > 0
                ? round($mappedFields / $totalFields * 100, 1)
                : 0.0,
        ];
    }
}
