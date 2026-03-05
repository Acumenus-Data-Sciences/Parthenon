<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareGapSnapshot extends Model
{
    protected $table = 'care_gap_snapshots';

    public $timestamps = false;

    protected $fillable = [
        'source_id',
        'bundle_id',
        'cohort_definition_id',
        'snapshot_date',
        'person_count',
        'measures_met',
        'measures_open',
        'measures_excluded',
        'compliance_pct',
        'risk_high_count',
        'risk_medium_count',
        'risk_low_count',
        'etl_duration_ms',
        'computed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'snapshot_date' => 'date',
            'compliance_pct' => 'float',
            'computed_at' => 'datetime',
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
}
