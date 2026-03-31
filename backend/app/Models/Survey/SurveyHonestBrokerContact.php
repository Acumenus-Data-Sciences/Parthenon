<?php

namespace App\Models\Survey;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyHonestBrokerContact extends Model
{
    protected $fillable = [
        'survey_honest_broker_link_id',
        'preferred_channel',
        'delivery_email',
        'delivery_phone',
        'destination_hash',
        'last_sent_at',
        'created_by',
        'updated_by',
    ];

    protected $hidden = [
        'delivery_email',
        'delivery_phone',
        'destination_hash',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'delivery_email' => 'encrypted',
            'delivery_phone' => 'encrypted',
            'last_sent_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<SurveyHonestBrokerLink, $this>
     */
    public function link(): BelongsTo
    {
        return $this->belongsTo(SurveyHonestBrokerLink::class, 'survey_honest_broker_link_id');
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
