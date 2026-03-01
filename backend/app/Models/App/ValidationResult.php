<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ValidationResult extends Model
{
    protected $fillable = [
        'ingestion_job_id',
        'check_name',
        'check_category',
        'cdm_table',
        'cdm_column',
        'severity',
        'passed',
        'violated_rows',
        'total_rows',
        'violation_percentage',
        'description',
        'details',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'passed' => 'boolean',
            'violation_percentage' => 'decimal:2',
            'details' => 'array',
        ];
    }

    /**
     * @return BelongsTo<IngestionJob, $this>
     */
    public function ingestionJob(): BelongsTo
    {
        return $this->belongsTo(IngestionJob::class);
    }
}
