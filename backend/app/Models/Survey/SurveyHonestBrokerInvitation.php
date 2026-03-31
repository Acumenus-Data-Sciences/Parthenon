<?php

namespace App\Models\Survey;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyHonestBrokerInvitation extends Model
{
    protected $fillable = [
        'survey_campaign_id',
        'survey_honest_broker_link_id',
        'survey_honest_broker_contact_id',
        'delivery_channel',
        'destination_hash',
        'one_time_token_hash',
        'token_last_four',
        'delivery_status',
        'sent_at',
        'opened_at',
        'submitted_at',
        'expires_at',
        'revoked_at',
        'last_error',
        'message_subject',
        'created_by',
        'updated_by',
    ];

    protected $hidden = [
        'destination_hash',
        'one_time_token_hash',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'opened_at' => 'datetime',
            'submitted_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
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
     * @return BelongsTo<SurveyHonestBrokerContact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(SurveyHonestBrokerContact::class, 'survey_honest_broker_contact_id');
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
}
