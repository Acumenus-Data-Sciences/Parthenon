<?php

namespace App\Models\Survey;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SurveyCampaign extends Model
{
    protected $fillable = [
        'name',
        'survey_instrument_id',
        'cohort_generation_id',
        'status',
        'publish_token',
        'description',
        'closed_at',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cohort_generation_id' => 'integer',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<SurveyInstrument, $this>
     */
    public function instrument(): BelongsTo
    {
        return $this->belongsTo(SurveyInstrument::class, 'survey_instrument_id');
    }

    /**
     * @return HasMany<SurveyConductRecord, $this>
     */
    public function conductRecords(): HasMany
    {
        return $this->hasMany(SurveyConductRecord::class, 'campaign_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive(mixed $query): mixed
    {
        return $query->where('status', 'active');
    }

    public function scopeDraft(mixed $query): mixed
    {
        return $query->where('status', 'draft');
    }

    public function scopeClosed(mixed $query): mixed
    {
        return $query->where('status', 'closed');
    }
}
