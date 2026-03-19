<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;

class AchillesHeelResult extends Model
{
    protected $table = 'achilles_heel_results';

    protected $fillable = [
        'source_id',
        'run_id',
        'rule_id',
        'rule_name',
        'severity',
        'record_count',
        'attribute_name',
        'attribute_value',
    ];

    protected $casts = [
        'record_count' => 'integer',
    ];
}
