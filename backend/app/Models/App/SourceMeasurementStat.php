<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SourceMeasurementStat extends Model
{
    public $timestamps = false;

    protected $table = 'source_measurement_stats';

    protected $fillable = [
        'source_id',
        'measurement_concept_id',
        'mean',
        'stddev',
        'n_patients',
        'percentile_25',
        'percentile_75',
        'computed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'mean' => 'float',
            'stddev' => 'float',
            'n_patients' => 'integer',
            'percentile_25' => 'float',
            'percentile_75' => 'float',
            'computed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
