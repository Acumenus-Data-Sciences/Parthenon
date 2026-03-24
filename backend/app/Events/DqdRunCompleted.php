<?php

namespace App\Events;

use App\Models\App\Source;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DqdRunCompleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly int $sourceId,
        public readonly string $runId,
        public readonly Source $source,
    ) {}
}
