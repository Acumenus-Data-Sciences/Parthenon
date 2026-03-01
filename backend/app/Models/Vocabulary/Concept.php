<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Concept extends VocabularyModel
{
    protected $table = 'concepts';

    protected $primaryKey = 'concept_id';

    public $incrementing = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'valid_start_date' => 'date',
            'valid_end_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Vocabulary, $this>
     */
    public function vocabulary(): BelongsTo
    {
        return $this->belongsTo(Vocabulary::class, 'vocabulary_id', 'vocabulary_id');
    }

    /**
     * @return BelongsTo<Domain, $this>
     */
    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class, 'domain_id', 'domain_id');
    }

    /**
     * @return BelongsTo<ConceptClass, $this>
     */
    public function conceptClass(): BelongsTo
    {
        return $this->belongsTo(ConceptClass::class, 'concept_class_id', 'concept_class_id');
    }

    /**
     * @return HasMany<ConceptSynonym, $this>
     */
    public function synonyms(): HasMany
    {
        return $this->hasMany(ConceptSynonym::class, 'concept_id', 'concept_id');
    }

    /**
     * @return HasMany<ConceptRelationship, $this>
     */
    public function relationships(): HasMany
    {
        return $this->hasMany(ConceptRelationship::class, 'concept_id_1', 'concept_id');
    }

    /**
     * @return HasMany<ConceptAncestor, $this>
     */
    public function ancestors(): HasMany
    {
        return $this->hasMany(ConceptAncestor::class, 'descendant_concept_id', 'concept_id');
    }

    /**
     * @return HasMany<ConceptAncestor, $this>
     */
    public function descendants(): HasMany
    {
        return $this->hasMany(ConceptAncestor::class, 'ancestor_concept_id', 'concept_id');
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeStandard(Builder $query): Builder
    {
        return $query->where('standard_concept', 'S');
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeInDomain(Builder $query, string $domainId): Builder
    {
        return $query->where('domain_id', $domainId);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeInVocabulary(Builder $query, string $vocabularyId): Builder
    {
        return $query->where('vocabulary_id', $vocabularyId);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->whereRaw(
            'concept_name ILIKE ?',
            ['%'.$term.'%']
        )->orderByRaw(
            'CASE WHEN concept_name ILIKE ? THEN 0 ELSE 1 END, concept_name',
            [$term.'%']
        );
    }
}
