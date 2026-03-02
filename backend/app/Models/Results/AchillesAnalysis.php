<?php

namespace App\Models\Results;

class AchillesAnalysis extends ResultsModel
{
    protected $table = 'achilles_analysis';

    protected $primaryKey = 'analysis_id';

    public $incrementing = false;

    protected $fillable = [
        'analysis_id',
        'analysis_name',
        'stratum_1_name',
        'stratum_2_name',
        'stratum_3_name',
        'stratum_4_name',
        'stratum_5_name',
        'analysis_type',
        'category',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'analysis_id' => 'integer',
        ];
    }
}
