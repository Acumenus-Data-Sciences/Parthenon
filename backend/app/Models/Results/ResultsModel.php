<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;

abstract class ResultsModel extends Model
{
    protected $connection = 'results';

    public $timestamps = false;
}
