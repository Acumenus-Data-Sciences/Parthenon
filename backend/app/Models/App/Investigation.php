<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Investigation extends Model
{
    protected $table = 'investigations';

    protected $fillable = [
        'title',
        'research_question',
        'status',
        'owner_id',
        'phenotype_state',
        'clinical_state',
        'genomic_state',
        'synthesis_state',
        'completed_at',
        'last_modified_by',
    ];

    protected $casts = [
        'phenotype_state' => 'array',
        'clinical_state' => 'array',
        'genomic_state' => 'array',
        'synthesis_state' => 'array',
        'completed_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function lastModifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_modified_by');
    }

    /**
     * @return HasMany<EvidencePin, $this>
     */
    public function pins(): HasMany
    {
        return $this->hasMany(EvidencePin::class)->orderBy('sort_order');
    }

    /**
     * @return HasMany<InvestigationVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(InvestigationVersion::class)->orderByDesc('version_number');
    }
}
