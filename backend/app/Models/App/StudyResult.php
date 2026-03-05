<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyResult extends Model
{
    protected $fillable = [
        'execution_id',
        'study_id',
        'study_analysis_id',
        'site_id',
        'result_type',
        'summary_data',
        'diagnostics',
        'is_primary',
        'is_publishable',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'summary_data' => 'array',
        'diagnostics' => 'array',
        'is_primary' => 'boolean',
        'is_publishable' => 'boolean',
        'reviewed_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<StudyExecution, $this>
     */
    public function execution(): BelongsTo
    {
        return $this->belongsTo(StudyExecution::class, 'execution_id');
    }

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
     * @return BelongsTo<StudySite, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(StudySite::class, 'site_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
