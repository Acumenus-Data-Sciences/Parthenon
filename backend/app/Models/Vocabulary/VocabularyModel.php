<?php

namespace App\Models\Vocabulary;

use App\Context\SourceContext;
use Illuminate\Database\Eloquent\Model;

abstract class VocabularyModel extends Model
{
    public $timestamps = false;

    protected $guarded = ['*'];

    public function getConnectionName(): string
    {
        $ctx = app(SourceContext::class);

        return $ctx->source !== null ? $ctx->vocabConnection() : 'vocab';
    }
}
