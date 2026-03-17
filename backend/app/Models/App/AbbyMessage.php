<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AbbyMessage extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'abby_messages';

    /** @var list<string> */
    protected $fillable = [
        'conversation_id',
        'role',
        'content',
        'metadata',
        'embedding',
        'embedding_model',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    /**
     * @return BelongsTo<AbbyConversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AbbyConversation::class, 'conversation_id');
    }
}
