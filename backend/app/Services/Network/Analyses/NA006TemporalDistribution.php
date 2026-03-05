<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA006 – Temporal Record Distribution
 *
 * Reports the number of clinical events per calendar year per domain per source.
 * Enables detection of:
 *   - Sources with data cut-offs (sudden drop to zero in recent years)
 *   - Backfill artifacts (abnormally high early years)
 *   - Temporal coverage mismatches across sites that bias incidence studies
 *
 * stratum_1 = year (YYYY)
 * stratum_2 = domain ('condition' | 'drug' | 'measurement' | 'visit')
 * stratum_3 = ''
 * count_value = record count in that year/domain
 * total_value = total records in that domain across all years (for % calc)
 */
class NA006TemporalDistribution implements NetworkAnalysisInterface
{
    public function analysisId(): string
    {
        return 'NA006';
    }

    public function analysisName(): string
    {
        return 'Temporal Record Distribution';
    }

    public function category(): string
    {
        return 'Coverage';
    }

    public function minimumSources(): int
    {
        return 1;
    }

    public function description(): string
    {
        return 'Counts clinical events per calendar year per domain per source. '
            .'Data cut-offs, backfill artifacts, and temporal coverage mismatches '
            .'across sites are immediately visible in the resulting time-series chart.';
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'drug_exposure', 'measurement', 'visit_occurrence'];
    }

    public function perSourceSqlTemplate(): string
    {
        return <<<'SQL'
            WITH events AS (
                SELECT EXTRACT(YEAR FROM condition_start_date)::INT AS yr, 'condition' AS domain
                FROM {@cdmSchema}.condition_occurrence
                WHERE condition_start_date IS NOT NULL

                UNION ALL

                SELECT EXTRACT(YEAR FROM drug_exposure_start_date)::INT, 'drug'
                FROM {@cdmSchema}.drug_exposure
                WHERE drug_exposure_start_date IS NOT NULL

                UNION ALL

                SELECT EXTRACT(YEAR FROM measurement_date)::INT, 'measurement'
                FROM {@cdmSchema}.measurement
                WHERE measurement_date IS NOT NULL

                UNION ALL

                SELECT EXTRACT(YEAR FROM visit_start_date)::INT, 'visit'
                FROM {@cdmSchema}.visit_occurrence
                WHERE visit_start_date IS NOT NULL
            ),
            year_domain AS (
                SELECT yr, domain, COUNT(*) AS n
                FROM events
                WHERE yr BETWEEN 1980 AND EXTRACT(YEAR FROM CURRENT_DATE)::INT
                GROUP BY yr, domain
            ),
            domain_totals AS (
                SELECT domain, SUM(n) AS total_n
                FROM year_domain
                GROUP BY domain
            )
            SELECT
                yr::TEXT          AS stratum_1,
                yd.domain         AS stratum_2,
                ''                AS stratum_3,
                yd.n              AS count_value,
                dt.total_n        AS total_value
            FROM year_domain yd
            JOIN domain_totals dt ON dt.domain = yd.domain
            ORDER BY yd.domain, yd.yr
            SQL;
    }
}
