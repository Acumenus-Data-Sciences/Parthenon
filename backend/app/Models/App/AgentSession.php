<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentSession extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'profile',
        'subject_type',
        'subject_id',
        'user_id',
        'anthropic_session_id',
        'status',
        'cost_usd',
        'tokens_in',
        'tokens_out',
        'token_id',
        'context_json',
        'last_active_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cost_usd' => 'float',
            'tokens_in' => 'integer',
            'tokens_out' => 'integer',
            'context_json' => 'array',
            'last_active_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Filter to sessions matching a specific profile + subject.
     *
     * @param  Builder<AgentSession>  $query
     * @return Builder<AgentSession>
     */
    public function scopeForSubject(Builder $query, string $profile, string $subjectType, int $subjectId): Builder
    {
        return $query
            ->where('profile', $profile)
            ->where('subject_type', $subjectType)
            ->where('subject_id', $subjectId);
    }
}
