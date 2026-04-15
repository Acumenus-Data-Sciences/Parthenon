<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserExternalIdentity extends Model
{
    protected $table = 'user_external_identities';

    protected $fillable = [
        'user_id', 'provider', 'provider_subject',
        'provider_email_at_link', 'linked_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'linked_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
