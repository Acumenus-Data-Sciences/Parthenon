<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    protected $table = 'commons_messages';

    protected $fillable = [
        'channel_id',
        'user_id',
        'parent_id',
        'depth',
        'body',
        'body_html',
        'is_edited',
        'edited_at',
        'deleted_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'depth' => 'integer',
            'is_edited' => 'boolean',
            'edited_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Channel, $this> */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class, 'channel_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Message, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'parent_id');
    }

    /** @return HasMany<Message, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(Message::class, 'parent_id');
    }

    /** @return HasMany<Reaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class, 'message_id');
    }

    /** @return HasMany<ObjectReference, $this> */
    public function objectReferences(): HasMany
    {
        return $this->hasMany(ObjectReference::class, 'message_id');
    }

    /** @return HasMany<Attachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class, 'message_id');
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }
}
