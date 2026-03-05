<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeorValueContract extends Model
{
    protected $table = 'heor_value_contracts';

    protected $fillable = [
        'analysis_id', 'created_by', 'contract_name', 'drug_name', 'contract_type',
        'outcome_metric', 'baseline_rate', 'rebate_tiers', 'list_price',
        'net_price_floor', 'measurement_period_months', 'status', 'effective_date',
    ];

    protected function casts(): array
    {
        return [
            'baseline_rate' => 'float',
            'list_price' => 'float',
            'net_price_floor' => 'float',
            'rebate_tiers' => 'array',
            'measurement_period_months' => 'integer',
            'effective_date' => 'datetime',
        ];
    }

    /** @return BelongsTo<HeorAnalysis, $this> */
    public function analysis(): BelongsTo
    {
        return $this->belongsTo(HeorAnalysis::class, 'analysis_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
