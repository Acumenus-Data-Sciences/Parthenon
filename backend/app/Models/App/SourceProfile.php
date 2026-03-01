<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SourceProfile extends Model
{
    protected $fillable = [
        'ingestion_job_id',
        'file_name',
        'file_format',
        'file_size',
        'row_count',
        'column_count',
        'format_metadata',
        'storage_path',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'format_metadata' => 'array',
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
     * @return HasMany<FieldProfile, $this>
     */
    public function fields(): HasMany
    {
        return $this->hasMany(FieldProfile::class);
    }
}
