<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudySynthesis extends Model
{
    protected $table = 'study_synthesis';

    protected $fillable = [
        'study_id',
        'study_analysis_id',
        'synthesis_type',
        'input_result_ids',
        'method_settings',
        'output',
        'generated_at',
        'generated_by',
    ];

    protected $casts = [
        'input_result_ids' => 'array',
        'method_settings' => 'array',
        'output' => 'array',
        'generated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return BelongsTo<StudyAnalysis, $this>
     */
    public function studyAnalysis(): BelongsTo
    {
        return $this->belongsTo(StudyAnalysis::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }
}
