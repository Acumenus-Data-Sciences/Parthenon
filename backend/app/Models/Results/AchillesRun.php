<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;
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
    ];
    // Note: 'status' intentionally excluded from $fillable (HIGHSEC §3.1).
    // Set via explicit update() calls only to prevent mass assignment of run status.

    protected $casts = [
        'categories' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /** @return HasMany<AchillesRunStep, $this> */
    public function steps(): HasMany
    {
        return $this->hasMany(AchillesRunStep::class, 'run_id', 'run_id');
    }
}
