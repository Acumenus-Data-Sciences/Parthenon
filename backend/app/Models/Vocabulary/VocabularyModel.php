<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Model;

abstract class VocabularyModel extends Model
{
    protected $connection = 'omop';

    public $timestamps = false;

    protected $guarded = ['*'];
}
