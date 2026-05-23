<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyDesignAgentSession extends Model
{
    protected $fillable = [
        'study_design_session_id',
        'study_design_version_id',
        'user_id',
        'anthropic_session_id',
        'status',
        'cost_usd',
        'tokens_in',
        'tokens_out',
        'token_id',
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
            'last_active_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<StudyDesignSession, $this>
     */
    public function session(): BelongsTo
    {
        return $this->belongsTo(StudyDesignSession::class, 'study_design_session_id');
    }

    /**
     * @return BelongsTo<StudyDesignVersion, $this>
     */
    public function version(): BelongsTo
    {
        return $this->belongsTo(StudyDesignVersion::class, 'study_design_version_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
