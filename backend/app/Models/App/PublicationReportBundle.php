<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublicationReportBundle extends Model
{
    protected $fillable = [
        'publication_draft_id',
        'user_id',
        'direction',
        'format',
        'bundle_json',
        'metadata_json',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'publication_draft_id' => 'integer',
            'user_id' => 'integer',
            'bundle_json' => 'array',
            'metadata_json' => 'array',
        ];
    }

    /**
     * @return BelongsTo<PublicationDraft, $this>
     */
    public function publicationDraft(): BelongsTo
    {
        return $this->belongsTo(PublicationDraft::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
