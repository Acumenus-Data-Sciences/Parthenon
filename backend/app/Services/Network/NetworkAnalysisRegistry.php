<?php

namespace App\Services\Network;

use App\Contracts\NetworkAnalysisInterface;
use InvalidArgumentException;

class NetworkAnalysisRegistry
{
    /** @var array<string, NetworkAnalysisInterface> */
    private array $analyses = [];

    public function register(NetworkAnalysisInterface $analysis): void
    {
        $this->analyses[$analysis->analysisId()] = $analysis;
    }

    public function all(): array
    {
        return array_values($this->analyses);
    }

    public function find(string $id): NetworkAnalysisInterface
    {
        if (! isset($this->analyses[$id])) {
            throw new InvalidArgumentException("Network analysis '{$id}' not registered.");
        }

        return $this->analyses[$id];
    }

    public function byCategory(): array
    {
        $grouped = [];
        foreach ($this->analyses as $a) {
            $grouped[$a->category()][] = $a;
        }

        return $grouped;
    }

    public function count(): int
    {
        return count($this->analyses);
    }
}
