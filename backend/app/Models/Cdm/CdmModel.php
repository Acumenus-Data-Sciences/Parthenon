<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Model;
use RuntimeException;

abstract class CdmModel extends Model
{
    protected $connection = 'omop';

    public $timestamps = false;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(fn () => throw new RuntimeException('CDM models are read-only'));
        static::updating(fn () => throw new RuntimeException('CDM models are read-only'));
        static::deleting(fn () => throw new RuntimeException('CDM models are read-only'));
    }
}
