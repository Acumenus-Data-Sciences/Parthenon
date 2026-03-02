<?php

namespace App\Services\ClinicalCoherence;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

class ClinicalCoherenceAnalysisRegistry
{
    /** @var array<string, ClinicalCoherenceAnalysisInterface> */
    private array $analyses = [];

    public function register(ClinicalCoherenceAnalysisInterface $analysis): void
    {
        $this->analyses[$analysis->analysisId()] = $analysis;
    }

    public function get(string $id): ?ClinicalCoherenceAnalysisInterface
    {
        return $this->analyses[$id] ?? null;
    }

    /** @return ClinicalCoherenceAnalysisInterface[] */
    public function all(): array
    {
        return array_values($this->analyses);
    }

    /** @return ClinicalCoherenceAnalysisInterface[] */
    public function byCategory(string $category): array
    {
        return array_values(array_filter(
            $this->analyses,
            fn ($a) => $a->category() === $category,
        ));
    }

    /** @return ClinicalCoherenceAnalysisInterface[] */
    public function bySeverity(string $severity): array
    {
        return array_values(array_filter(
            $this->analyses,
            fn ($a) => $a->severity() === $severity,
        ));
    }

    public function count(): int
    {
        return count($this->analyses);
    }
}
