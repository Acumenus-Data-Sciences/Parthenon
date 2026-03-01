<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CareSite extends CdmModel
{
    protected $table = 'care_site';

    protected $primaryKey = 'care_site_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<Location, $this>
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    /**
     * @return HasMany<Person, $this>
     */
    public function persons(): HasMany
    {
        return $this->hasMany(Person::class, 'care_site_id');
    }

    /**
     * @return HasMany<Provider, $this>
     */
    public function providers(): HasMany
    {
        return $this->hasMany(Provider::class, 'care_site_id');
    }
}
