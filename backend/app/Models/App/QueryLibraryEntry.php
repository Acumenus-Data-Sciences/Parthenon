<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class QueryLibraryEntry extends Model
{
    protected $table = 'query_library_entries';

    /** @var list<string> */
    protected $fillable = [
        'slug',
        'name',
        'domain',
        'category',
        'summary',
        'description',
        'sql_template',
        'parameters_json',
        'tags_json',
        'example_questions_json',
        'template_language',
        'is_aggregate',
        'safety',
        'source',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'parameters_json' => 'array',
        'tags_json' => 'array',
        'example_questions_json' => 'array',
        'is_aggregate' => 'boolean',
    ];
}
