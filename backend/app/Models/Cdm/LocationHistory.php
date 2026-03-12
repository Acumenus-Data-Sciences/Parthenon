<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Model;

class LocationHistory extends Model
{
    protected $table = 'app.location_history';

    protected $primaryKey = 'location_history_id';

    protected $fillable = [
        'entity_id', 'domain_id', 'location_id',
        'start_date', 'end_date', 'relationship_type_concept_id',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }
}
