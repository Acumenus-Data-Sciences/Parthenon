<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WikiRevision extends Model
{
    public $timestamps = false;

    protected $table = 'commons_wiki_revisions';

    protected $fillable = [
        'article_id',
        'body',
        'edited_by',
        'edit_summary',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function article(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'article_id');
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'edited_by');
    }
}
