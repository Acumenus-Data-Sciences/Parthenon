<?php

namespace App\Services\Ingestion;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\FieldProfile;
use App\Models\App\IngestionJob;
use App\Models\App\IngestionProject;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\App\SourceProfile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class StagingSourceService
{
    /**
     * Create a Source + SourceDaimon + SourceProfile for a staging project.
     * Called when all files are staged and the project is ready.
     */
    public function createStagingSource(IngestionProject $project): Source
    {
        // Create or recover existing source (idempotent for retries)
        $source = Source::withTrashed()
            ->where('source_key', "STAGING-{$project->id}")
            ->first();

        if ($source) {
            // Restore if soft-deleted (re-staging scenario)
            if ($source->trashed()) {
                $source->restore();
            }
        } else {
            $source = Source::create([
                'source_name' => "Staging: {$project->name}",
                'source_key' => "STAGING-{$project->id}",
                'source_connection' => 'pgsql',
                'source_dialect' => 'postgresql',
            ]);
        }

        // Create CDM daimon pointing to the staging schema
        SourceDaimon::firstOrCreate(
            ['source_id' => $source->id, 'daimon_type' => DaimonType::CDM],
            ['table_qualifier' => $project->staging_schema, 'priority' => 1],
        );

        // Create aggregated SourceProfile from per-file profiles
        $this->createAggregatedProfile($source, $project);

        // Link project to source
        $project->update(['source_id' => $source->id]);

        Log::info('Staging source created for ingestion project', [
            'project_id' => $project->id,
            'source_id' => $source->id,
            'schema' => $project->staging_schema,
        ]);

        return $source;
    }

    /**
     * Soft-delete the staging source when a project is deleted.
     */
    public function cleanupStagingSource(IngestionProject $project): void
    {
        if ($project->source_id) {
            $source = Source::find($project->source_id);
            if ($source && str_starts_with($source->source_key, 'STAGING-')) {
                $source->delete(); // soft delete
                Log::info('Staging source soft-deleted', [
                    'project_id' => $project->id,
                    'source_id' => $source->id,
                ]);
            }
        }
    }

    /**
     * Create a SourceProfile aggregated from all per-file profiles.
     */
    private function createAggregatedProfile(Source $source, IngestionProject $project): void
    {
        $jobs = $project->jobs()->where('status', ExecutionStatus::Completed)->get();

        $tableCount = $jobs->count();
        $columnCount = 0;
        $totalRows = 0;
        $highNullColumns = 0;

        // Collect stats from per-file SourceProfile records
        foreach ($jobs as $job) {
            $profile = $job->profiles()->first();
            if (! $profile) {
                continue;
            }

            $columnCount += $profile->column_count ?? 0;
            $totalRows += $profile->row_count ?? 0;

            // Count high-null columns from field profiles
            $highNullColumns += FieldProfile::where('source_profile_id', $profile->id)
                ->where('null_percentage', '>', 50)
                ->count();
        }

        // Create or update the aggregated profile
        SourceProfile::updateOrCreate(
            ['source_id' => $source->id, 'scan_type' => 'ingestion'],
            [
                'scan_time_seconds' => 0,
                'overall_grade' => $this->computeGrade($jobs),
                'table_count' => $tableCount,
                'column_count' => $columnCount,
                'total_rows' => $totalRows,
                'row_count' => $totalRows,
                'summary_json' => [
                    'high_null_columns' => $highNullColumns,
                    'empty_tables' => $jobs->filter(fn ($j) => ($j->stats_json['row_count'] ?? 0) === 0)->count(),
                    'low_cardinality_columns' => 0,
                    'single_value_columns' => 0,
                ],
            ],
        );

        // Copy field profiles to the aggregated source profile
        $aggregatedProfile = SourceProfile::where('source_id', $source->id)
            ->where('scan_type', 'ingestion')
            ->first();

        if ($aggregatedProfile) {
            // Remove old aggregated field profiles
            FieldProfile::where('source_profile_id', $aggregatedProfile->id)->delete();

            // Copy field profiles from per-file profiles
            foreach ($jobs as $job) {
                $fileProfile = $job->profiles()->first();
                if (! $fileProfile) {
                    continue;
                }

                $fields = FieldProfile::where('source_profile_id', $fileProfile->id)->get();
                foreach ($fields as $field) {
                    $newField = $field->replicate();
                    $newField->source_profile_id = $aggregatedProfile->id;
                    $newField->table_name = $job->staging_table_name ?? $field->table_name;
                    $newField->save();
                }
            }
        }
    }

    /**
     * Compute an overall data quality grade based on null percentages.
     *
     * @param  Collection<int, IngestionJob>  $jobs
     */
    private function computeGrade($jobs): string
    {
        $totalNull = 0;
        $totalCols = 0;

        foreach ($jobs as $job) {
            $profile = $job->profiles()->first();
            if (! $profile) {
                continue;
            }

            $fields = FieldProfile::where('source_profile_id', $profile->id)->get();
            foreach ($fields as $field) {
                $totalNull += ($field->null_percentage ?? 0) / 100;
                $totalCols++;
            }
        }

        if ($totalCols === 0) {
            return 'F';
        }

        $avgNull = ($totalNull / $totalCols) * 100;

        return match (true) {
            $avgNull <= 5 => 'A',
            $avgNull <= 15 => 'B',
            $avgNull <= 30 => 'C',
            $avgNull <= 50 => 'D',
            default => 'F',
        };
    }
}
