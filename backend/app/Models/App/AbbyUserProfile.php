<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AbbyUserProfile extends Model
{
    protected $table = 'abby_user_profiles';

    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'research_interests',
        'expertise_domains',
        'interaction_preferences',
        'frequently_used',
        'learned_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'research_interests' => 'array',
        'expertise_domains' => 'array',
        'interaction_preferences' => 'array',
        'frequently_used' => 'array',
        'learned_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
