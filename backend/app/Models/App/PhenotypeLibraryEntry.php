<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class PhenotypeLibraryEntry extends Model
{
    protected $table = 'phenotype_library';

    protected $fillable = [
        'cohort_id',
        'cohort_name',
        'description',
        'expression_json',
        'logic_description',
        'tags',
        'domain',
        'severity',
        'is_imported',
        'imported_cohort_id',
    ];

    protected $casts = [
        'expression_json' => 'array',
        'tags' => 'array',
        'is_imported' => 'boolean',
    ];
}
