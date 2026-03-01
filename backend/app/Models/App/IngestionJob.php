<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IngestionJob extends Model
{
    protected $fillable = [
        'source_id',
        'status',
        'config_json',
        'started_at',
        'completed_at',
        'stats_json',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ExecutionStatus::class,
            'config_json' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'stats_json' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
