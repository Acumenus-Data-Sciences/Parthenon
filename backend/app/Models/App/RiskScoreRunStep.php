<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskScoreRunStep extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'execution_id',
        'score_id',
        'status',
        'started_at',
        'completed_at',
        'elapsed_ms',
        'patient_count',
        'error_message',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ExecutionStatus::class,
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'elapsed_ms' => 'integer',
            'patient_count' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<AnalysisExecution, $this>
     */
    public function execution(): BelongsTo
    {
        return $this->belongsTo(AnalysisExecution::class, 'execution_id');
    }
}
