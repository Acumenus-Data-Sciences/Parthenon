<?php

namespace App\Models\Commons;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ObjectReference extends Model
{
    protected $table = 'commons_object_references';

    public $timestamps = false;

    protected $fillable = [
        'message_id',
        'referenceable_type',
        'referenceable_id',
        'display_name',
    ];

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'message_id');
    }
}
