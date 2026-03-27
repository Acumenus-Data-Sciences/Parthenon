<?php

namespace App\Models\Cdm;

use App\Context\SourceContext;
use Illuminate\Database\Eloquent\Model;
use RuntimeException;

abstract class CdmModel extends Model
{
    public $timestamps = false;

    public function getConnectionName(): string
    {
        $ctx = app(SourceContext::class);

        return $ctx->source !== null ? $ctx->cdmConnection() : 'omop';
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(fn () => throw new RuntimeException('CDM models are read-only'));
        static::updating(fn () => throw new RuntimeException('CDM models are read-only'));
        static::deleting(fn () => throw new RuntimeException('CDM models are read-only'));
    }
}
