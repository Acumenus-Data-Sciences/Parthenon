<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HeorAnalysis extends Model
{
    protected $table = 'heor_analyses';

    protected $fillable = [
        'created_by', 'source_id', 'name', 'analysis_type', 'description',
        'perspective', 'time_horizon', 'discount_rate', 'currency',
        'target_cohort_id', 'comparator_cohort_id', 'status', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'discount_rate' => 'float',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<HeorScenario, $this> */
    public function scenarios(): HasMany
    {
        return $this->hasMany(HeorScenario::class, 'analysis_id')->orderBy('sort_order');
    }

    /** @return HasMany<HeorCostParameter, $this> */
    public function parameters(): HasMany
    {
        return $this->hasMany(HeorCostParameter::class, 'analysis_id');
    }

    /** @return HasMany<HeorResult, $this> */
    public function results(): HasMany
    {
        return $this->hasMany(HeorResult::class, 'analysis_id');
    }
}
