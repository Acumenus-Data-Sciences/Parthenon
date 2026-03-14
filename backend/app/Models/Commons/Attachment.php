<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attachment extends Model
{
    protected $table = 'commons_attachments';

    public $timestamps = false;

    protected $fillable = [
        'message_id',
        'user_id',
        'original_name',
        'stored_path',
        'mime_type',
        'size_bytes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'created_at' => 'datetime',
        ];
    }

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
