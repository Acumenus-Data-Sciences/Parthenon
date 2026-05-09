<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable record of user authentication and feature access events.
 */
class UserAuditLog extends Model
{
    protected $fillable = [
        'event_id',
        'user_id',
        'tenant_id',
        'action',
        'outcome',
        'feature',
        'ip_address',
        'user_agent',
        'metadata',
        'occurred_at',
        'prev_event_hash',
        'event_hash',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
