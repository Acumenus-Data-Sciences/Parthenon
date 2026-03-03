<?php

namespace App\Contracts;

/**
 * Contract for Tier 3 Population Characterization analyses.
 *
 * These analyses describe the *clinical composition* of a CDM population —
 * comorbidity burden, polypharmacy, treatment patterns, care utilization.
 * They are informational (no error/warning severity) and produce
 * distribution tables suitable for charting.
 *
 * SQL must return rows with columns:
 *   stratum_1  VARCHAR  — primary grouping dimension
 *   stratum_2  VARCHAR  — secondary grouping dimension ('' if unused)
 *   stratum_3  VARCHAR  — tertiary grouping dimension ('' if unused)
 *   count_value  BIGINT — numerator (persons, visits, …)
 *   total_value  BIGINT — denominator (total eligible population)
 *
 * ratio_value (count / total) is computed by the engine.
 */
interface PopulationCharacterizationInterface
{
    /** Short identifier, e.g. 'PC001' */
    public function analysisId(): string;

    public function analysisName(): string;

    /**
     * 'Comorbidity' | 'Medication' | 'Treatment' | 'Provider' | 'Visit' | 'Care'
     */
    public function category(): string;

    public function description(): string;

    /**
     * SQL template run against one CDM source.
     * Placeholder: {@cdmSchema} — replaced at runtime.
     */
    public function sqlTemplate(): string;

    public function requiredTables(): array;

    /**
     * True if the analysis depends on optionally-populated CDM tables
     * (care_site, provider, visit_detail). The engine will still run it
     * but will surface a low-confidence warning in the response.
     */
    public function requiresOptionalTables(): bool;
}
