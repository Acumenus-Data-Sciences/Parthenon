<?php

namespace App\Models\Results;

use App\Context\SourceContext;
use Illuminate\Database\Eloquent\Model;

abstract class ResultsModel extends Model
{
    public $timestamps = false;

    public function getConnectionName(): string
    {
        $ctx = app(SourceContext::class);

        return $ctx->source !== null ? $ctx->resultsConnection() : 'results';
    }
}
