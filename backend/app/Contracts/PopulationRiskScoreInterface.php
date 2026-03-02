<?php

namespace App\Contracts;

interface PopulationRiskScoreInterface
{
    /** Unique identifier, e.g. 'RS001'. */
    public function scoreId(): string;

    public function scoreName(): string;

    /** Clinical domain: 'Cardiovascular', 'Hepatic', 'Oncologic', etc. */
    public function category(): string;

    public function description(): string;

    /** Human-readable description of the eligible population (age/sex/condition constraints). */
    public function eligiblePopulation(): string;

    /**
     * Ordered list of component names required to compute a full, high-confidence score.
     * Used for documentation and confidence denominator calculation.
     *
     * @return string[]
     */
    public function requiredComponents(): array;

    /**
     * Risk tier thresholds.
     * e.g. ['low' => [0, 10], 'intermediate' => [10, 20], 'high' => [20, null]]
     *
     * @return array<string, array{0: float|null, 1: float|null}>
     */
    public function riskTiers(): array;

    /**
     * SQL SELECT returning one summary row per risk tier:
     *
     *   risk_tier         VARCHAR   — 'low' | 'intermediate' | 'high' | 'very_high' | 'uncomputable'
     *   patient_count     INTEGER   — patients in this tier
     *   total_eligible    INTEGER   — all eligible patients regardless of tier
     *   mean_score        NUMERIC   — average score value (NULL for 'uncomputable' tier)
     *   p25_score         NUMERIC   — 25th percentile of score
     *   median_score      NUMERIC   — 50th percentile of score
     *   p75_score         NUMERIC   — 75th percentile of score
     *   mean_confidence   NUMERIC   — avg confidence 0–1 (data completeness weighted)
     *   mean_completeness NUMERIC   — avg fraction of required components present
     *   missing_components TEXT     — JSON: {"component_name": missing_patient_count, ...}
     *
     * May reference {@cdmSchema} placeholder only.
     */
    public function sqlTemplate(): string;

    /** @return string[] CDM tables required by this score. */
    public function requiredTables(): array;
}
