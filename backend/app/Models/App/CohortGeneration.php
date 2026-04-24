<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CohortGeneration extends Model
{
    protected $fillable = [
        'cohort_definition_id',
        'source_id',
        'care_bundle_run_id',
        'status',
        'started_at',
        'completed_at',
        'person_count',
        'fail_message',
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
        ];
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function cohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class);
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return BelongsTo<CareBundleRun, $this>
     */
    public function careBundleRun(): BelongsTo
    {
        return $this->belongsTo(CareBundleRun::class, 'care_bundle_run_id');
    }
}
