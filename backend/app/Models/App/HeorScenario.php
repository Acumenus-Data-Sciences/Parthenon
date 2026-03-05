<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class HeorScenario extends Model
{
    protected $table = 'heor_scenarios';

    protected $fillable = [
        'analysis_id', 'name', 'scenario_type', 'description',
        'parameter_overrides', 'is_base_case', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'parameter_overrides' => 'array',
            'is_base_case' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<HeorAnalysis, $this> */
    public function analysis(): BelongsTo
    {
        return $this->belongsTo(HeorAnalysis::class, 'analysis_id');
    }

    /** @return HasOne<HeorResult, $this> */
    public function result(): HasOne
    {
        return $this->hasOne(HeorResult::class, 'scenario_id');
    }
}
