<?php

namespace App\Models\App;

use App\Enums\CohortDomain;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CohortDefinition extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'expression_json',
        'author_id',
        'is_public',
        'version',
        'tags',
        'domain',
        'quality_tier',
        'share_token',
        'share_expires_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expression_json' => 'array',
            'is_public' => 'boolean',
            'tags' => 'array',
            'share_expires_at' => 'datetime',
            'domain' => CohortDomain::class,
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * @return HasMany<CohortGeneration, $this>
     */
    public function generations(): HasMany
    {
        return $this->hasMany(CohortGeneration::class);
    }

    /**
     * @return HasMany<StudyCohort, $this>
     */
    public function studyCohorts(): HasMany
    {
        return $this->hasMany(StudyCohort::class);
    }

    /**
     * Recompute quality_tier based on generation history, study usage, and expression complexity.
     * Uses updateQuietly to avoid recursive observer calls.
     */
    public function recomputeQualityTier(): void
    {
        $completedGens = $this->generations()->where('status', 'completed')->count();
        $studyUses = $this->studyCohorts()->count();

        $expression = $this->expression_json ?? [];
        $conceptSetCount = count($expression['ConceptSets'] ?? []);
        $inclusionRules = count($expression['AdditionalCriteria']['CriteriaList'] ?? []);
        $hasEndStrategy = isset($expression['EndStrategy']);
        $hasComplexity = $conceptSetCount > 0 || $inclusionRules > 0 || $hasEndStrategy;

        if ($completedGens > 0 && $studyUses > 0 && $hasComplexity) {
            $tier = 'study-ready';
        } elseif ($completedGens > 0) {
            $tier = 'validated';
        } else {
            $tier = 'draft';
        }

        if ($this->quality_tier !== $tier) {
            $this->updateQuietly(['quality_tier' => $tier]);
        }
    }
}
