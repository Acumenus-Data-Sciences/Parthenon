<?php

namespace App\Events;

use App\Models\App\SourceRelease;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReleaseCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly SourceRelease $release,
    ) {}
}
