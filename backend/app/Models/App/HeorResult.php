<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeorResult extends Model
{
    protected $table = 'heor_results';

    protected $fillable = [
        'analysis_id', 'scenario_id',
        'total_cost', 'total_qalys', 'total_lys',
        'incremental_cost', 'incremental_qalys', 'icer',
        'net_monetary_benefit', 'willingness_to_pay_threshold',
        'roi_percent', 'payback_period_months',
        'budget_impact_year1', 'budget_impact_year3', 'budget_impact_year5',
        'sensitivity_results', 'tornado_data', 'cohort_size',
    ];

    protected function casts(): array
    {
        return [
            'total_cost' => 'float',
            'total_qalys' => 'float',
            'total_lys' => 'float',
            'incremental_cost' => 'float',
            'incremental_qalys' => 'float',
            'icer' => 'float',
            'net_monetary_benefit' => 'float',
            'willingness_to_pay_threshold' => 'float',
            'roi_percent' => 'float',
            'payback_period_months' => 'float',
            'budget_impact_year1' => 'float',
            'budget_impact_year3' => 'float',
            'budget_impact_year5' => 'float',
            'sensitivity_results' => 'array',
            'tornado_data' => 'array',
            'cohort_size' => 'integer',
        ];
    }

    /** @return BelongsTo<HeorAnalysis, $this> */
    public function analysis(): BelongsTo
    {
        return $this->belongsTo(HeorAnalysis::class, 'analysis_id');
    }

    /** @return BelongsTo<HeorScenario, $this> */
    public function scenario(): BelongsTo
    {
        return $this->belongsTo(HeorScenario::class, 'scenario_id');
    }
}
