<?php

namespace App\Contracts;

interface ClinicalCoherenceAnalysisInterface
{
    /**
     * Unique string identifier, e.g. 'CC001'.
     */
    public function analysisId(): string;

    public function analysisName(): string;

    /**
     * High-level grouping: 'Sex Plausibility', 'Age Plausibility', etc.
     */
    public function category(): string;

    public function description(): string;

    /**
     * 'critical' | 'major' | 'informational'
     */
    public function severity(): string;

    /**
     * Pure SELECT returning: stratum_1, stratum_2, stratum_3,
     * count_value, total_value, ratio_value, notes.
     * May reference {@cdmSchema} placeholder.
     */
    public function sqlTemplate(): string;

    public function requiredTables(): array;

    /**
     * Ratio threshold above which a result row is flagged.
     * Null means flag if count_value > 0 (any occurrence is noteworthy).
     */
    public function flagThreshold(): ?float;
}
