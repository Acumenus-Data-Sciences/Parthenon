<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Builder;

class AchillesResultDist extends ResultsModel
{
    protected $table = 'achilles_results_dist';

    protected $primaryKey = null;

    public $incrementing = false;

    protected $fillable = [
        'analysis_id',
        'stratum_1',
        'stratum_2',
        'stratum_3',
        'stratum_4',
        'stratum_5',
        'count_value',
        'min_value',
        'max_value',
        'avg_value',
        'stdev_value',
        'median_value',
        'p10_value',
        'p25_value',
        'p75_value',
        'p90_value',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'analysis_id' => 'integer',
            'count_value' => 'integer',
            'min_value' => 'float',
            'max_value' => 'float',
            'avg_value' => 'float',
            'stdev_value' => 'float',
            'median_value' => 'float',
            'p10_value' => 'float',
            'p25_value' => 'float',
            'p75_value' => 'float',
            'p90_value' => 'float',
        ];
    }

    /**
     * Scope to filter by one or more analysis IDs.
     *
     * @param  Builder<static>  $query
     * @param  int|array<int>  $analysisId
     * @return Builder<static>
     */
    public function scopeForAnalysis(Builder $query, int|array $analysisId): Builder
    {
        if (is_array($analysisId)) {
            return $query->whereIn('analysis_id', $analysisId);
        }

        return $query->where('analysis_id', $analysisId);
    }
}
