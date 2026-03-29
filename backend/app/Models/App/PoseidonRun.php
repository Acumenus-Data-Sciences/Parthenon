<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PoseidonRun extends Model
{
    protected $table = 'poseidon_runs';

    protected $fillable = [
        'dagster_run_id',
        'source_id',
        'schedule_id',
        'run_type',
        'status',
        'started_at',
        'completed_at',
        'stats',
        'error_message',
        'triggered_by',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'stats' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(PoseidonSchedule::class, 'schedule_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isRunning(): bool
    {
        return in_array($this->status, ['pending', 'running']);
    }
}
