<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class StudyAnalysis extends Model
{
    protected $fillable = [
        'study_id',
        'analysis_type',
        'analysis_id',
    ];

    /**
     * Map fully-qualified class names to short API type names.
     */
    private const CLASS_TO_SHORT_TYPE = [
        'App\Models\App\Characterization' => 'characterization',
        'App\Models\App\IncidenceRateAnalysis' => 'incidence_rate',
        'App\Models\App\PathwayAnalysis' => 'pathway',
        'App\Models\App\EstimationAnalysis' => 'estimation',
        'App\Models\App\PredictionAnalysis' => 'prediction',
        'App\Models\App\SccsAnalysis' => 'sccs',
        'App\Models\App\EvidenceSynthesis' => 'evidence_synthesis',
    ];

    /**
     * Override toArray to normalize analysis_type to short names.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $array = parent::toArray();
        $array['analysis_type'] = self::CLASS_TO_SHORT_TYPE[$array['analysis_type'] ?? '']
            ?? $array['analysis_type'] ?? 'unknown';

        return $array;
    }

    /**
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function analysis(): MorphTo
    {
        return $this->morphTo();
    }
}
