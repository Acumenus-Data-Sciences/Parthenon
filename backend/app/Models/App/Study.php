<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Study extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'short_title',
        'slug',
        'study_type',
        'study_design',
        'phase',
        'priority',
        'description',
        'scientific_rationale',
        'hypothesis',
        'primary_objective',
        'secondary_objectives',
        'study_start_date',
        'study_end_date',
        'target_enrollment_sites',
        'actual_enrollment_sites',
        'protocol_version',
        'protocol_finalized_at',
        'funding_source',
        'clinicaltrials_gov_id',
        'tags',
        'settings',
        'metadata',
        'status',
        'created_by',
        'principal_investigator_id',
        'lead_data_scientist_id',
        'lead_statistician_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'secondary_objectives' => 'array',
            'tags' => 'array',
            'settings' => 'array',
            'metadata' => 'array',
            'study_start_date' => 'date',
            'study_end_date' => 'date',
            'protocol_finalized_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Study $study) {
            if (empty($study->slug) && ! empty($study->title)) {
                $base = Str::slug($study->title);
                $slug = $base;
                $counter = 1;
                while (static::withTrashed()->where('slug', $slug)->exists()) {
                    $slug = "{$base}-{$counter}";
                    $counter++;
                }
                $study->slug = $slug;
            }
        });
    }

    /**
     * Use slug for route model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Append 'name' to JSON for backward compatibility.
     *
     * @var list<string>
     */
    protected $appends = ['name'];

    /**
     * Backward-compat: allow accessing title as 'name'.
     */
    public function getNameAttribute(): string
    {
        return $this->title ?? '';
    }

    // ── Relationships ────────────────────────────────────────────────────

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function principalInvestigator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'principal_investigator_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function leadDataScientist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_data_scientist_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function leadStatistician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_statistician_id');
    }

    /**
     * @return HasMany<StudyAnalysis, $this>
     */
    public function analyses(): HasMany
    {
        return $this->hasMany(StudyAnalysis::class);
    }

    // ── Scopes ───────────────────────────────────────────────────────────

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<Study>  $query
     * @return \Illuminate\Database\Eloquent\Builder<Study>
     */
    public function scopeSearch($query, string $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('title', 'ilike', "%{$term}%")
                ->orWhere('short_title', 'ilike', "%{$term}%")
                ->orWhere('description', 'ilike', "%{$term}%");
        });
    }
}
