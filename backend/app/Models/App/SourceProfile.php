<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SourceProfile extends Model
{
    protected $fillable = [
        'ingestion_job_id',
        'source_id',
        'ingestion_project_id',
        'file_name',
        'file_format',
        'file_size',
        'row_count',
        'column_count',
        'format_metadata',
        'storage_path',
        'scan_type',
        'scan_time_seconds',
        'overall_grade',
        'table_count',
        'total_rows',
        'summary_json',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'format_metadata' => 'array',
            'summary_json' => 'array',
        ];
    }

    /**
     * @return BelongsTo<IngestionJob, $this>
     */
    public function ingestionJob(): BelongsTo
    {
        return $this->belongsTo(IngestionJob::class);
    }

    /**
     * @return BelongsTo<IngestionProject, $this>
     */
    public function ingestionProject(): BelongsTo
    {
        return $this->belongsTo(IngestionProject::class);
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return HasMany<FieldProfile, $this>
     */
    public function fields(): HasMany
    {
        return $this->hasMany(FieldProfile::class);
    }
}
