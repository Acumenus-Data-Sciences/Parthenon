<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class StudySite extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'study_id',
        'source_id',
        'site_role',
        'status',
        'irb_protocol_number',
        'irb_approval_date',
        'irb_expiry_date',
        'irb_type',
        'dua_signed_at',
        'site_contact_user_id',
        'cdm_version',
        'vocabulary_version',
        'data_freshness_date',
        'patient_count_estimate',
        'feasibility_results',
        'execution_log',
        'results_received_at',
        'notes',
    ];

    protected $casts = [
        'irb_approval_date' => 'date',
        'irb_expiry_date' => 'date',
        'dua_signed_at' => 'datetime',
        'data_freshness_date' => 'date',
        'feasibility_results' => 'array',
        'execution_log' => 'array',
        'results_received_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function siteContact(): BelongsTo
    {
        return $this->belongsTo(User::class, 'site_contact_user_id');
    }

    /**
     * @return HasMany<StudyTeamMember, $this>
     */
    public function teamMembers(): HasMany
    {
        return $this->hasMany(StudyTeamMember::class, 'site_id');
    }

    /**
     * @return HasMany<StudyExecution, $this>
     */
    public function executions(): HasMany
    {
        return $this->hasMany(StudyExecution::class, 'site_id');
    }
}
