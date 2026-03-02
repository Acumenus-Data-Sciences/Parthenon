<?php

namespace App\Services\Achilles;

use App\Contracts\AchillesAnalysisInterface;

class AchillesAnalysisRegistry
{
    /**
     * @var array<int, AchillesAnalysisInterface>
     */
    private array $analyses = [];

    public function register(AchillesAnalysisInterface $analysis): void
    {
        $this->analyses[$analysis->analysisId()] = $analysis;
    }

    public function get(int $analysisId): ?AchillesAnalysisInterface
    {
        return $this->analyses[$analysisId] ?? null;
    }

    /**
     * @return array<int, AchillesAnalysisInterface>
     */
    public function all(): array
    {
        return $this->analyses;
    }

    /**
     * @return array<int, AchillesAnalysisInterface>
     */
    public function byCategory(string $category): array
    {
        return array_filter(
            $this->analyses,
            fn (AchillesAnalysisInterface $a) => $a->category() === $category,
        );
    }

    /**
     * @return list<string>
     */
    public function categories(): array
    {
        return array_values(array_unique(
            array_map(
                fn (AchillesAnalysisInterface $a) => $a->category(),
                $this->analyses,
            ),
        ));
    }

    public function count(): int
    {
        return count($this->analyses);
    }
}
