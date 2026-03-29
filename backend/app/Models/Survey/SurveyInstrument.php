<?php

namespace App\Models\Survey;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SurveyInstrument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'abbreviation',
        'version',
        'description',
        'domain',
        'item_count',
        'scoring_method',
        'loinc_panel_code',
        'omop_concept_id',
        'license_type',
        'license_detail',
        'is_public_domain',
        'is_active',
        'omop_coverage',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scoring_method' => 'array',
            'is_public_domain' => 'boolean',
            'is_active' => 'boolean',
            'item_count' => 'integer',
            'omop_concept_id' => 'integer',
        ];
    }

    /**
     * @return HasMany<SurveyItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SurveyItem::class)->orderBy('display_order');
    }

    /**
     * @return HasMany<SurveyConductRecord, $this>
     */
    public function conductRecords(): HasMany
    {
        return $this->hasMany(SurveyConductRecord::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive(mixed $query): mixed
    {
        return $query->where('is_active', true);
    }

    public function scopeByDomain(mixed $query, string $domain): mixed
    {
        return $query->where('domain', $domain);
    }

    public function scopeWithLoinc(mixed $query): mixed
    {
        return $query->whereNotNull('loinc_panel_code');
    }

    public function scopePublicDomain(mixed $query): mixed
    {
        return $query->where('is_public_domain', true);
    }
}
