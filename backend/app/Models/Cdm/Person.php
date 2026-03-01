<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Person extends CdmModel
{
    protected $table = 'person';

    protected $primaryKey = 'person_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
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
     * @return HasMany<ObservationPeriod, $this>
     */
    public function observationPeriods(): HasMany
    {
        return $this->hasMany(ObservationPeriod::class, 'person_id');
    }

    /**
     * @return HasMany<VisitOccurrence, $this>
     */
    public function visitOccurrences(): HasMany
    {
        return $this->hasMany(VisitOccurrence::class, 'person_id');
    }

    /**
     * @return HasMany<ConditionOccurrence, $this>
     */
    public function conditionOccurrences(): HasMany
    {
        return $this->hasMany(ConditionOccurrence::class, 'person_id');
    }

    /**
     * @return HasMany<DrugExposure, $this>
     */
    public function drugExposures(): HasMany
    {
        return $this->hasMany(DrugExposure::class, 'person_id');
    }

    /**
     * @return HasMany<ProcedureOccurrence, $this>
     */
    public function procedureOccurrences(): HasMany
    {
        return $this->hasMany(ProcedureOccurrence::class, 'person_id');
    }

    /**
     * @return HasMany<Measurement, $this>
     */
    public function measurements(): HasMany
    {
        return $this->hasMany(Measurement::class, 'person_id');
    }

    /**
     * @return HasMany<Observation, $this>
     */
    public function observations(): HasMany
    {
        return $this->hasMany(Observation::class, 'person_id');
    }
}
