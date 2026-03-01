<?php

namespace App\Models\Cdm;

class FactRelationship extends CdmModel
{
    protected $table = 'fact_relationship';

    protected $primaryKey = 'id';

    public $incrementing = true;
}
