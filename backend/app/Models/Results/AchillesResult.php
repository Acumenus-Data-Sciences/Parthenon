<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Builder;

class AchillesResult extends ResultsModel
{
    protected $table = 'achilles_results';

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
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'analysis_id' => 'integer',
            'count_value' => 'integer',
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

    /**
     * Scope to filter by a specific stratum position and value.
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeWithStratum(Builder $query, int $position, string $value): Builder
    {
        $column = "stratum_{$position}";

        return $query->where($column, $value);
    }
}
