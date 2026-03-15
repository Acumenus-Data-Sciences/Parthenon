<?php

namespace App\Services\DesignProtection;

final class ExportSummary
{
    public function __construct(
        public readonly int $written = 0,
        public readonly int $deleted = 0,
        public readonly array $errors = [],
    ) {}

    public static function empty(): self
    {
        return new self;
    }
}
