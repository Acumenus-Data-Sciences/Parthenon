<?php

namespace App\Services\PopulationCharacterization;

use App\Contracts\PopulationCharacterizationInterface;
use InvalidArgumentException;

class PopulationCharacterizationRegistry
{
    /** @var array<string, PopulationCharacterizationInterface> */
    private array $analyses = [];

    public function register(PopulationCharacterizationInterface $analysis): void
    {
        $this->analyses[$analysis->analysisId()] = $analysis;
    }

    public function all(): array
    {
        return array_values($this->analyses);
    }

    public function find(string $id): PopulationCharacterizationInterface
    {
        if (! isset($this->analyses[$id])) {
            throw new InvalidArgumentException("Population characterization analysis '{$id}' not registered.");
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
