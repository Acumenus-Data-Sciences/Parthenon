<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends CdmModel
{
    protected $table = 'location';

    protected $primaryKey = 'location_id';

    public $incrementing = false;

    /**
     * @return HasMany<Person, $this>
     */
    public function persons(): HasMany
    {
        return $this->hasMany(Person::class, 'location_id');
    }

    /**
     * @return HasMany<CareSite, $this>
     */
    public function careSites(): HasMany
    {
        return $this->hasMany(CareSite::class, 'location_id');
    }
}
