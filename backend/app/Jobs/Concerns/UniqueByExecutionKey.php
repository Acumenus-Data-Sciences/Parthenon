<?php

namespace App\Jobs\Concerns;

trait UniqueByExecutionKey
{
    public function uniqueFor(): int
    {
        return $this->timeout ?? 7200;
    }
}
