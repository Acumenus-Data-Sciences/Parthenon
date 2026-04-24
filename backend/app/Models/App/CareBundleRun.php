<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CareBundleRun extends Model
{
    protected $fillable = [
        'condition_bundle_id',
        'source_id',
        'status',
        'started_at',
        'completed_at',
        'triggered_by',
        'trigger_kind',
        'qualified_person_count',
        'measure_count',
        'bundle_version',
        'cdm_fingerprint',
        'fail_message',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'qualified_person_count' => 'integer',
            'measure_count' => 'integer',
        ];
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

    /**
     * @return BelongsTo<User, $this>
     */
    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }

    /**
     * @return HasMany<CareBundleQualification, $this>
     */
    public function qualifications(): HasMany
    {
        return $this->hasMany(CareBundleQualification::class);
    }

    /**
     * @return HasMany<CareBundleMeasureResult, $this>
     */
    public function measureResults(): HasMany
    {
        return $this->hasMany(CareBundleMeasureResult::class);
    }
}
