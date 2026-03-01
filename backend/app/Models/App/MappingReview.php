<?php

namespace App\Models\App;

use App\Enums\MappingAction;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MappingReview extends Model
{
    protected $fillable = [
        'concept_mapping_id',
        'reviewer_id',
        'action',
        'target_concept_id',
        'comment',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'action' => MappingAction::class,
        ];
    }

    /**
     * @return BelongsTo<ConceptMapping, $this>
     */
    public function conceptMapping(): BelongsTo
    {
        return $this->belongsTo(ConceptMapping::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
