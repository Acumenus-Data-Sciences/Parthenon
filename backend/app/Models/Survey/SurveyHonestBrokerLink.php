<?php

namespace App\Models\Survey;

use App\Models\App\CohortGeneration;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SurveyHonestBrokerLink extends Model
{
    protected $fillable = [
        'survey_campaign_id',
        'survey_conduct_id',
        'person_id',
        'source_id',
        'cohort_generation_id',
        'blinded_participant_id',
        'respondent_identifier_hash',
        'respondent_identifier',
        'match_status',
        'submitted_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $hidden = [
        'respondent_identifier_hash',
        'respondent_identifier',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'respondent_identifier' => 'encrypted',
            'submitted_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<SurveyCampaign, $this>
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(SurveyCampaign::class, 'survey_campaign_id');
    }

    /**
     * @return BelongsTo<SurveyConductRecord, $this>
     */
    public function conduct(): BelongsTo
    {
        return $this->belongsTo(SurveyConductRecord::class, 'survey_conduct_id');
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return BelongsTo<CohortGeneration, $this>
     */
    public function cohortGeneration(): BelongsTo
    {
        return $this->belongsTo(CohortGeneration::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * @return HasOne<SurveyHonestBrokerContact, $this>
     */
    public function contact(): HasOne
    {
        return $this->hasOne(SurveyHonestBrokerContact::class, 'survey_honest_broker_link_id');
    }

    /**
     * @return HasMany<SurveyHonestBrokerInvitation, $this>
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(SurveyHonestBrokerInvitation::class, 'survey_honest_broker_link_id');
    }
}
