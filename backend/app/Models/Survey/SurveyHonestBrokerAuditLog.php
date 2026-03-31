<?php

namespace App\Models\Survey;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyHonestBrokerAuditLog extends Model
{
    protected $fillable = [
        'survey_campaign_id',
        'survey_honest_broker_link_id',
        'survey_honest_broker_invitation_id',
        'actor_id',
        'action',
        'metadata',
        'occurred_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'occurred_at' => 'datetime',
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
     * @return BelongsTo<SurveyHonestBrokerLink, $this>
     */
    public function link(): BelongsTo
    {
        return $this->belongsTo(SurveyHonestBrokerLink::class, 'survey_honest_broker_link_id');
    }

    /**
     * @return BelongsTo<SurveyHonestBrokerInvitation, $this>
     */
    public function invitation(): BelongsTo
    {
        return $this->belongsTo(SurveyHonestBrokerInvitation::class, 'survey_honest_broker_invitation_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
