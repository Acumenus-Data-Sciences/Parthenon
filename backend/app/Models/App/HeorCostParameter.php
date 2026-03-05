<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeorCostParameter extends Model
{
    protected $table = 'heor_cost_parameters';

    protected $fillable = [
        'analysis_id', 'scenario_id', 'parameter_name', 'parameter_type',
        'value', 'unit', 'lower_bound', 'upper_bound', 'distribution',
        'omop_concept_id', 'source_reference',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'float',
            'lower_bound' => 'float',
            'upper_bound' => 'float',
        ];
    }

    /** @return BelongsTo<HeorAnalysis, $this> */
    public function analysis(): BelongsTo
    {
        return $this->belongsTo(HeorAnalysis::class, 'analysis_id');
    }
}
