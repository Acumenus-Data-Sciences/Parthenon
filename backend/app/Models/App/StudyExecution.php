<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyExecution extends Model
{
    protected $fillable = [
        'study_id',
        'study_analysis_id',
        'site_id',
        'status',
        'submitted_by',
        'submitted_at',
        'started_at',
        'completed_at',
        'execution_engine',
        'execution_params',
        'log_output',
        'error_message',
        'result_hash',
        'result_file_path',
    ];

    protected $casts = [
        'execution_params' => 'array',
        'submitted_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
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
     * @return BelongsTo<StudySite, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(StudySite::class, 'site_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * @return HasMany<StudyResult, $this>
     */
    public function results(): HasMany
    {
        return $this->hasMany(StudyResult::class, 'execution_id');
    }
}
