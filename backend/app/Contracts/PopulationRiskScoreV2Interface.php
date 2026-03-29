<?php

namespace App\Contracts;

interface PopulationRiskScoreV2Interface
{
    /** Unique identifier, e.g. 'RS005'. */
    public function scoreId(): string;

    public function scoreName(): string;

    /** Clinical domain: 'Cardiovascular', 'Comorbidity Burden', etc. */
    public function category(): string;

    public function description(): string;

    /** Human-readable description of the eligible population. */
    public function eligiblePopulation(): string;

    /**
     * Structured eligibility criteria for programmatic evaluation.
     *
     * @return array{
     *     population_type: 'universal'|'condition_specific'|'age_restricted',
     *     min_age?: int,
     *     max_age?: int,
     *     required_condition_ancestors?: int[],
     * }
     */
    public function eligibilityCriteria(): array;

    /**
     * Condition groups used for scoring, each mapped to an OMOP ancestor concept.
     *
     * @return list<array{label: string, ancestor_concept_id: int, weight: int|float}>
     */
    public function conditionGroups(): array;

    /**
     * Measurement requirements (lab values, vitals) needed for scoring.
     *
     * @return list<array{label: string, concept_id: int, unit: string}>
     */
    public function measurementRequirements(): array;

    /**
     * Risk tier thresholds: tier_name => [lower_bound, upper_bound).
     *
     * @return array<string, array{0: float|int, 1: float|int|null}>
     */
    public function riskTiers(): array;

    /**
     * Pure scoring function. Receives pre-extracted patient data and returns computed result.
     *
     * @param  array{
     *     person_id: int,
     *     age: int,
     *     gender_concept_id: int,
     *     conditions: int[],
     *     measurements: array<int, float>,
     * }  $patientData  Conditions are already resolved to ANCESTOR concept IDs.
     * @return array{
     *     score: float|null,
     *     tier: string,
     *     confidence: float,
     *     completeness: float,
     *     missing: string[],
     * }
     */
    public function compute(array $patientData): array;

    /**
     * CDM tables required by this score.
     *
     * @return string[]
     */
    public function requiredTables(): array;
}
