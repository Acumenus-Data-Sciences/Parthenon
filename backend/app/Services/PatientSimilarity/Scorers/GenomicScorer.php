<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

final class GenomicScorer implements DimensionScorerInterface
{
    /** @var array<string, int> */
    private const array PATHOGENICITY_WEIGHTS = [
        'Pathogenic' => 3,
        'Likely pathogenic' => 2,
        'Uncertain significance' => 1,
    ];

    public function key(): string
    {
        return 'genomics';
    }

    /**
     * Pathogenicity-tiered overlap on variant_genes.
     *
     * Build gene->max_weight maps for each patient.
     * score = sum(min weights of shared genes) / sum(max weights of all genes)
     *
     * @param  array<string, mixed>  $patientA
     * @param  array<string, mixed>  $patientB
     */
    public function score(array $patientA, array $patientB): float
    {
        /** @var array<array{gene: string, pathogenicity: string}> $variantsA */
        $variantsA = $patientA['variant_genes'] ?? [];
        /** @var array<array{gene: string, pathogenicity: string}> $variantsB */
        $variantsB = $patientB['variant_genes'] ?? [];

        if ($variantsA === [] && $variantsB === []) {
            return -1.0;
        }

        if ($variantsA === [] || $variantsB === []) {
            return 0.0;
        }

        $mapA = $this->buildGeneWeightMap($variantsA);
        $mapB = $this->buildGeneWeightMap($variantsB);

        // Shared genes: sum of min weights
        $sharedScore = 0;
        foreach ($mapA as $gene => $weightA) {
            if (isset($mapB[$gene])) {
                $sharedScore += min($weightA, $mapB[$gene]);
            }
        }

        // All genes: sum of max weights (union)
        $allGenes = $mapA + $mapB; // keys from A, then unique keys from B
        $totalScore = 0;
        foreach ($allGenes as $gene => $_) {
            $totalScore += max($mapA[$gene] ?? 0, $mapB[$gene] ?? 0);
        }

        if ($totalScore === 0) {
            return 0.0;
        }

        return $sharedScore / $totalScore;
    }

    /**
     * Build a gene -> max pathogenicity weight map.
     *
     * @param  array<array{gene: string, pathogenicity: string}>  $variants
     * @return array<string, int>
     */
    private function buildGeneWeightMap(array $variants): array
    {
        $map = [];

        foreach ($variants as $variant) {
            $gene = $variant['gene'] ?? '';
            $pathogenicity = $variant['pathogenicity'] ?? '';
            $weight = self::PATHOGENICITY_WEIGHTS[$pathogenicity] ?? 1;

            if ($gene === '') {
                continue;
            }

            $map[$gene] = max($map[$gene] ?? 0, $weight);
        }

        return $map;
    }
}
