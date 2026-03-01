<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Provider extends CdmModel
{
    protected $table = 'provider';

    protected $primaryKey = 'provider_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<CareSite, $this>
     */
    public function careSite(): BelongsTo
    {
        return $this->belongsTo(CareSite::class, 'care_site_id');
    }
}
