<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyArtifact extends Model
{
    protected $fillable = [
        'study_id',
        'artifact_type',
        'title',
        'description',
        'version',
        'file_path',
        'file_size_bytes',
        'mime_type',
        'url',
        'metadata',
        'uploaded_by',
        'is_current',
    ];

    protected $casts = [
        'metadata' => 'array',
        'is_current' => 'boolean',
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
    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
