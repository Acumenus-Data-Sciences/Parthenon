<?php

namespace App\Models\App;

use App\Support\AnalysisTypeMap;
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
     * Override toArray to normalize analysis_type (stored as a FQCN) to the
     * short slug the API and frontend speak. Delegates to AnalysisTypeMap so the
     * translation stays in one place.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $array = parent::toArray();
        $type = $array['analysis_type'] ?? null;
        $array['analysis_type'] = is_string($type) ? AnalysisTypeMap::slug($type) : 'unknown';

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
