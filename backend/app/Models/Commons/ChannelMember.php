<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelMember extends Model
{
    public $timestamps = false;

    protected $table = 'commons_channel_members';

    protected $fillable = [
        'channel_id',
        'user_id',
        'role',
        'notification_preference',
        'last_read_at',
        'joined_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
            'joined_at' => 'datetime',
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

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['owner', 'admin'], true);
    }
}
