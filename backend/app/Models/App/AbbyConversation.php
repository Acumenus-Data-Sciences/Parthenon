<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
     * @param  Builder<AbbyConversation>  $query
     * @return Builder<AbbyConversation>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }
}
