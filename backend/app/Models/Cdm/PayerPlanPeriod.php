<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayerPlanPeriod extends CdmModel
{
    protected $table = 'payer_plan_period';

    protected $primaryKey = 'payer_plan_period_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<Person, $this>
     */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }
}
