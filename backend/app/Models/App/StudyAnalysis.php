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
