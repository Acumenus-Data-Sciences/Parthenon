<?php

namespace App\Models\App;

use App\Enums\GateStage;
use App\Enums\GateStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row of the study gate ledger (ADR-0020 Phase 3): the evaluated metrics,
 * the thresholds they were checked against, the resulting status, and the
 * human decision (approval or justified override) that cleared it.
 */
class StudyGate extends Model
{
    protected $fillable = [
        'study_id',
        'stage',
        'gate_key',
        'status',
        'metrics_json',
        'threshold_json',
        'decision',
        'decided_by',
        'decided_at',
        'override_rationale',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stage' => GateStage::class,
            'status' => GateStatus::class,
            'metrics_json' => 'array',
            'threshold_json' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
