<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;

class NetworkAnalysisResult extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'network_analysis_results';

    protected $fillable = [
        'source_id',
        'analysis_id',
        'stratum_1',
        'stratum_2',
        'stratum_3',
        'count_value',
        'total_value',
        'ratio_value',
        'value_as_string',
        'run_at',
    ];

    protected function casts(): array
    {
        return [
            'run_at' => 'datetime',
            'ratio_value' => 'float',
        ];
    }

    /** Decode the network-aggregate JSON payload. */
    public function getNetworkStatsAttribute(): ?array
    {
        if ($this->source_id !== null || $this->value_as_string === null) {
            return null;
        }

        return json_decode($this->value_as_string, true);
    }

    public function isNetworkAggregate(): bool
    {
        return $this->source_id === null;
    }
}
