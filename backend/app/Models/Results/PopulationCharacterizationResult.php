<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;

class PopulationCharacterizationResult extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'population_characterization_results';

    protected $fillable = [
        'source_id',
        'analysis_id',
        'stratum_1',
        'stratum_2',
        'stratum_3',
        'count_value',
        'total_value',
        'ratio_value',
        'run_at',
    ];

    protected function casts(): array
    {
        return [
            'run_at' => 'datetime',
            'ratio_value' => 'float',
        ];
    }

    /**
     * For analyses that encode float values × 1000 in count_value (CV, median),
     * return the decoded real value.
     */
    public function getDecodedValueAttribute(): ?float
    {
        if ($this->count_value === null) {
            return null;
        }

        // PC004 (CV) and PC006 (median) use ×1000 encoding
        return $this->count_value / 1000.0;
    }
}
