<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Model;

class Concept extends Model
{
    protected $connection = 'vocab';

    protected $table = 'concept';

    protected $primaryKey = 'concept_id';

    public $timestamps = false;

    protected $fillable = [];

    protected $guarded = ['*'];
}
