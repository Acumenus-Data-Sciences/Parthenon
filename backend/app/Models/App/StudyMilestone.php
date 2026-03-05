<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyMilestone extends Model
{
    protected $fillable = [
        'study_id',
        'title',
        'description',
        'milestone_type',
        'target_date',
        'actual_date',
        'status',
        'assigned_to',
        'sort_order',
    ];

    protected $casts = [
        'target_date' => 'date',
        'actual_date' => 'date',
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
    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
