<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PublicationDraft extends Model
{
    protected $fillable = [
        'user_id',
        'study_id',
        'title',
        'template',
        'document_json',
        'status',
        'last_opened_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'study_id' => 'integer',
            'document_json' => 'array',
            'last_opened_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<PublicationReportBundle, $this>
     */
    public function reportBundles(): HasMany
    {
        return $this->hasMany(PublicationReportBundle::class);
    }
}
