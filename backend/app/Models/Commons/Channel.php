<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Channel extends Model
{
    /** @use HasFactory<\Database\Factories\Commons\ChannelFactory> */
    use HasFactory;

    protected $table = 'commons_channels';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'type',
        'visibility',
        'study_id',
        'created_by',
        'archived_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<ChannelMember, $this> */
    public function members(): HasMany
    {
        return $this->hasMany(ChannelMember::class, 'channel_id');
    }

    /** @return HasMany<Message, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'channel_id');
    }

    public function isPublic(): bool
    {
        return $this->visibility === 'public';
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }
}
