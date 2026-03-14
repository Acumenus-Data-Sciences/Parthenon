<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WikiArticle extends Model
{
    protected $table = 'commons_wiki_articles';

    protected $fillable = [
        'title',
        'slug',
        'body',
        'body_html',
        'tags',
        'created_by',
        'last_edited_by',
    ];

    protected $casts = [
        'tags' => 'array',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lastEditor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_edited_by');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(WikiRevision::class, 'article_id');
    }
}
