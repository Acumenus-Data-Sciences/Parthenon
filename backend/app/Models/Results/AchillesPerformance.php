<?php

namespace App\Models\Results;

class AchillesPerformance extends ResultsModel
{
    protected $table = 'achilles_performance';

    protected $primaryKey = null;

    public $incrementing = false;

    protected $fillable = [
        'analysis_id',
        'elapsed_seconds',
        'query_text',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'analysis_id' => 'integer',
            'elapsed_seconds' => 'float',
        ];
    }
}
