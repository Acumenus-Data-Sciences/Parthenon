<?php

namespace App\Contracts;

/**
 * Contract for Tier 4 Network Analytics analyses.
 *
 * Each analysis defines SQL that is executed PER SOURCE against that source's
 * CDM schema. The engine collects per-source rows, stores them, then computes
 * cross-source network-level aggregates in PHP (no patient data leaves each site).
 *
 * Per-source SQL must return rows with columns:
 *   stratum_1  VARCHAR  — primary grouping dimension (concept_id, domain, year, …)
 *   stratum_2  VARCHAR  — secondary grouping dimension (optional, '' if unused)
 *   stratum_3  VARCHAR  — tertiary grouping dimension (optional, '' if unused)
 *   count_value  BIGINT — numerator count (persons, records, …)
 *   total_value  BIGINT — denominator (total eligible persons at this source)
 *
 * Ratio (count_value / total_value) is computed by the engine.
 * Network aggregates (mean ratio, SD, I²) are computed across sources in PHP.
 */
interface NetworkAnalysisInterface
{
    /** Short identifier, e.g. 'NA001' */
    public function analysisId(): string;

    public function analysisName(): string;

    /** 'Prevalence' | 'Demographics' | 'Coverage' | 'Heterogeneity' | 'Risk' */
    public function category(): string;

    public function description(): string;

    /**
     * SQL template run against EACH source CDM.
     * Placeholders: {@cdmSchema} — replaced at runtime.
     * Must return: stratum_1, stratum_2, stratum_3, count_value, total_value
     */
    public function perSourceSqlTemplate(): string;

    /** CDM tables required (used to skip sources missing a domain). */
    public function requiredTables(): array;

    /** Minimum number of sources needed for cross-site comparison. */
    public function minimumSources(): int;
}
