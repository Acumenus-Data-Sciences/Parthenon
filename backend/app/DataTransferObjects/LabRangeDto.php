<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

final readonly class LabRangeDto
{
    public function __construct(
        public float $low,
        public float $high,
        public string $source,        // 'curated' | 'population'
        public string $sourceLabel,   // 'LOINC (F, 18+)' | 'SynPUF pop. P2.5–P97.5 (n=12,430)'
        public ?string $sourceRef = null,  // curated: 'Mayo' etc.
        public ?int $nObservations = null, // population: row count
    ) {}

    /** @return array{low: float, high: float, source: string, sourceLabel: string, sourceRef: ?string, nObservations: ?int} */
    public function toArray(): array
    {
        return [
            'low' => $this->low,
            'high' => $this->high,
            'source' => $this->source,
            'sourceLabel' => $this->sourceLabel,
            'sourceRef' => $this->sourceRef,
            'nObservations' => $this->nObservations,
        ];
    }
}
