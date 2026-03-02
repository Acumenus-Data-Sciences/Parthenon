<?php

namespace App\Contracts;

interface AchillesAnalysisInterface
{
    public function analysisId(): int;

    public function analysisName(): string;

    public function category(): string;

    public function sqlTemplate(): string;

    public function isDistribution(): bool;

    /**
     * CDM tables this analysis reads from.
     *
     * @return list<string>
     */
    public function requiredTables(): array;
}
