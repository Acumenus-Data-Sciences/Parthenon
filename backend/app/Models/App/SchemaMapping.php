<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SchemaMapping extends Model
{
    protected $fillable = [
        'ingestion_job_id',
        'source_table',
        'source_column',
        'cdm_table',
        'cdm_column',
        'confidence',
        'mapping_logic',
        'transform_config',
        'is_confirmed',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'confidence' => 'decimal:4',
            'transform_config' => 'array',
            'is_confirmed' => 'boolean',
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
