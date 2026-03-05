<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareGapPatientMeasure extends Model
{
    protected $table = 'care_gap_patient_measures';

    public $timestamps = false;

    protected $fillable = [
        'source_id',
        'bundle_id',
        'measure_id',
        'person_id',
        'status',
        'last_service_date',
        'due_date',
        'days_overdue',
        'is_deduplicated',
        'refreshed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_service_date' => 'date',
            'due_date' => 'date',
            'is_deduplicated' => 'boolean',
            'refreshed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class, 'source_id');
    }

    /**
     * @return BelongsTo<ConditionBundle, $this>
     */
    public function bundle(): BelongsTo
    {
        return $this->belongsTo(ConditionBundle::class, 'bundle_id');
    }

    /**
     * @return BelongsTo<QualityMeasure, $this>
     */
    public function measure(): BelongsTo
    {
        return $this->belongsTo(QualityMeasure::class, 'measure_id');
    }
}
