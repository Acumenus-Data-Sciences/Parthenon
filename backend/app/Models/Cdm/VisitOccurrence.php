<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VisitOccurrence extends CdmModel
{
    protected $table = 'visit_occurrence';

    protected $primaryKey = 'visit_occurrence_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<Person, $this>
     */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }

    /**
     * @return BelongsTo<Provider, $this>
     */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class, 'provider_id');
    }

    /**
     * @return BelongsTo<CareSite, $this>
     */
    public function careSite(): BelongsTo
    {
        return $this->belongsTo(CareSite::class, 'care_site_id');
    }

    /**
     * @return HasMany<ConditionOccurrence, $this>
     */
    public function conditionOccurrences(): HasMany
    {
        return $this->hasMany(ConditionOccurrence::class, 'visit_occurrence_id');
    }

    /**
     * @return HasMany<DrugExposure, $this>
     */
    public function drugExposures(): HasMany
    {
        return $this->hasMany(DrugExposure::class, 'visit_occurrence_id');
    }

    /**
     * @return HasMany<ProcedureOccurrence, $this>
     */
    public function procedureOccurrences(): HasMany
    {
        return $this->hasMany(ProcedureOccurrence::class, 'visit_occurrence_id');
    }

    /**
     * @return HasMany<Measurement, $this>
     */
    public function measurements(): HasMany
    {
        return $this->hasMany(Measurement::class, 'visit_occurrence_id');
    }

    /**
     * @return HasMany<Observation, $this>
     */
    public function observations(): HasMany
    {
        return $this->hasMany(Observation::class, 'visit_occurrence_id');
    }
}
