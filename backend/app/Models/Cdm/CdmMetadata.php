<?php

namespace App\Models\Cdm;

class CdmMetadata extends CdmModel
{
    protected $table = 'metadata';

    protected $primaryKey = 'metadata_id';

    public $incrementing = true;
}
