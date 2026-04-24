<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareBundleQualification extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'care_bundle_run_id',
        'condition_bundle_id',
        'source_id',
        'person_id',
        'qualifies',
        'measure_summary',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'person_id' => 'integer',
            'qualifies' => 'boolean',
            'measure_summary' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<CareBundleRun, $this>
     */
    public function run(): BelongsTo
    {
        return $this->belongsTo(CareBundleRun::class, 'care_bundle_run_id');
    }

    /**
     * @return BelongsTo<ConditionBundle, $this>
     */
    public function bundle(): BelongsTo
    {
        return $this->belongsTo(ConditionBundle::class, 'condition_bundle_id');
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
