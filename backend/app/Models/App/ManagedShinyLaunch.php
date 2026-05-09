<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManagedShinyLaunch extends Model
{
    protected $fillable = [
        'workspace_id',
        'user_id',
        'study_id',
        'study_artifact_id',
        'study_slug',
        'artifact_type',
        'app_key',
        'runtime',
        'mode',
        'status',
        'token_hash',
        'expires_at',
        'resolved_at',
        'failed_at',
        'failure_reason',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'resolved_at' => 'datetime',
            'failed_at' => 'datetime',
            'metadata' => 'array',
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
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return BelongsTo<StudyArtifact, $this>
     */
    public function artifact(): BelongsTo
    {
        return $this->belongsTo(StudyArtifact::class, 'study_artifact_id');
    }
}
