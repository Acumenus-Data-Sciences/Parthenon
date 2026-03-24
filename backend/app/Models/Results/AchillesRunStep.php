<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AchillesRunStep extends Model
{
    protected $table = 'achilles_run_steps';

    protected $fillable = [
        'run_id',
        'analysis_id',
        'analysis_name',
        'category',
        'status',
        'elapsed_seconds',
        'error_message',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'elapsed_seconds' => 'float',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /** @return BelongsTo<AchillesRun, $this> */
    public function run(): BelongsTo
    {
        return $this->belongsTo(AchillesRun::class, 'run_id', 'run_id');
    }
}
