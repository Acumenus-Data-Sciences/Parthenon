<?php

namespace App\Models\Results;

use App\Models\App\Source;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicalCoherenceResult extends Model
{
    protected $fillable = [
        'source_id',
        'analysis_id',
        'analysis_name',
        'category',
        'severity',
        'stratum_1',
        'stratum_2',
        'stratum_3',
        'count_value',
        'total_value',
        'ratio_value',
        'flagged',
        'notes',
        'run_at',
    ];

    protected $casts = [
        'count_value' => 'integer',
        'total_value' => 'integer',
        'ratio_value' => 'decimal:6',
        'flagged'     => 'boolean',
        'run_at'      => 'datetime',
    ];

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
