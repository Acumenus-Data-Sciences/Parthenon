<?php

namespace App\Services\PopulationRisk;

use App\Contracts\PopulationRiskScoreInterface;

class PopulationRiskScoreRegistry
{
    /** @var array<string, PopulationRiskScoreInterface> */
    private array $scores = [];

    public function register(PopulationRiskScoreInterface $score): void
    {
        $this->scores[$score->scoreId()] = $score;
    }

    public function get(string $id): ?PopulationRiskScoreInterface
    {
        return $this->scores[strtoupper($id)] ?? null;
    }

    /** @return PopulationRiskScoreInterface[] */
    public function all(): array
    {
        return array_values($this->scores);
    }

    /** @return PopulationRiskScoreInterface[] */
    public function byCategory(string $category): array
    {
        return array_values(array_filter(
            $this->scores,
            fn ($s) => $s->category() === $category,
        ));
    }

    public function count(): int
    {
        return count($this->scores);
    }
}
