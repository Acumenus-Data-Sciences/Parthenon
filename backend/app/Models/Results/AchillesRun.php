<?php

namespace App\Models\Results;

use App\Models\App\SourceRelease;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AchillesRun extends Model
{
    protected $table = 'achilles_runs';

    protected $fillable = [
        'source_id',
        'run_id',
        'total_analyses',
        'completed_analyses',
        'failed_analyses',
        'categories',
        'started_at',
        'completed_at',
        'release_id',
    ];
    // Note: 'status' intentionally excluded from $fillable (HIGHSEC §3.1).
    // Set via explicit update() calls only to prevent mass assignment of run status.

    protected $casts = [
        'categories' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'release_id' => 'integer',
    ];

    /** @return HasMany<AchillesRunStep, $this> */
    public function steps(): HasMany
    {
        return $this->hasMany(AchillesRunStep::class, 'run_id', 'run_id');
    }

    /** @return BelongsTo<SourceRelease, $this> */
    public function release(): BelongsTo
    {
        return $this->belongsTo(SourceRelease::class, 'release_id');
    }
}
