<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyTeamMember extends Model
{
    protected $fillable = [
        'study_id',
        'user_id',
        'role',
        'site_id',
        'permissions',
        'joined_at',
        'left_at',
        'is_active',
    ];

    protected $casts = [
        'permissions' => 'array',
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'is_active' => 'boolean',
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
     * @return BelongsTo<StudySite, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(StudySite::class, 'site_id');
    }
}
