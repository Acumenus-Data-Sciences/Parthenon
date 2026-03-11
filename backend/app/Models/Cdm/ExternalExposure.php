<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Model;

class ExternalExposure extends Model
{
    protected $table = 'app.external_exposure';
    protected $primaryKey = 'external_exposure_id';

    protected $fillable = [
        'person_id', 'exposure_concept_id', 'exposure_start_date',
        'exposure_end_date', 'value_as_number', 'value_as_string',
        'value_as_concept_id', 'unit_source_value', 'unit_concept_id',
        'location_id', 'boundary_id', 'qualifier_concept_id',
        'exposure_type_concept_id', 'exposure_source_concept_id',
        'exposure_source_value',
    ];

    protected function casts(): array
    {
        return [
            'exposure_start_date' => 'date',
            'exposure_end_date' => 'date',
            'value_as_number' => 'float',
        ];
    }
}
