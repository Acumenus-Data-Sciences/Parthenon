<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

class AbbyConversation extends Model
{
    protected $table = 'abby_conversations';

    /** @var list<string> */
    protected $fillable = [
        'title',
        'user_id',
        'page_context',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<AbbyMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(AbbyMessage::class, 'conversation_id')->orderBy('created_at');
    }

    /**
     * @return HasOneThrough<AbbyUserProfile, User, $this>
     */
    public function userProfile(): HasOneThrough
    {
        return $this->hasOneThrough(
            AbbyUserProfile::class,
            User::class,
            'id',        // users.id
            'user_id',   // abby_user_profiles.user_id
            'user_id',   // abby_conversations.user_id
            'id'         // users.id
        );
    }

    /**
     * @param  Builder<AbbyConversation>  $query
     * @return Builder<AbbyConversation>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }
}
