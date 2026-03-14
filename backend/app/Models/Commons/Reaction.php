<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reaction extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'commons_message_reactions';

    /** @var list<string> */
    protected $fillable = [
        'message_id',
        'user_id',
        'emoji',
    ];

    public const ALLOWED_EMOJI = [
        'thumbsup',
        'heart',
        'laugh',
        'surprised',
        'celebrate',
        'eyes',
    ];

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'message_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
