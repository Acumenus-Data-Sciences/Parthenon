<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class StudyComment extends Model
{
    protected $fillable = [
        'study_id',
        'parent_id',
        'commentable_type',
        'commentable_id',
        'user_id',
        'body',
        'is_resolved',
        'resolved_by',
    ];

    protected $casts = [
        'is_resolved' => 'boolean',
    ];

    /**
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<StudyComment, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(StudyComment::class, 'parent_id');
    }

    /**
     * @return HasMany<StudyComment, $this>
     */
    public function replies(): HasMany
    {
        return $this->hasMany(StudyComment::class, 'parent_id');
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function commentable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
