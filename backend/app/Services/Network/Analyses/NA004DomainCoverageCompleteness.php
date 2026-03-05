<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA004 – Domain Coverage Completeness
 *
 * For each of the 8 core OMOP CDM clinical domains, reports what fraction
 * of persons have at least one record. Sources with 0% drug exposure or
 * 0% measurement coverage are essentially unusable for those analyses.
 *
 * stratum_1 = domain name ('condition' | 'drug' | 'measurement' | …)
 * stratum_2 = ''
 * stratum_3 = ''
 * count_value = persons with ≥1 record in domain
 * total_value = total persons
 */
class NA004DomainCoverageCompleteness implements NetworkAnalysisInterface
{
    public function analysisId(): string
    {
        return 'NA004';
    }

    public function analysisName(): string
    {
        return 'Domain Coverage Completeness';
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
        return 'Reports what fraction of CDM persons have ≥1 record in each of 8 clinical '
            .'domains. Sources with < 50% coverage in any domain should be treated as '
            .'incomplete for analyses depending on that domain.';
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'drug_exposure', 'measurement',
            'observation', 'procedure_occurrence', 'visit_occurrence',
            'device_exposure', 'death'];
    }

    public function perSourceSqlTemplate(): string
    {
        return <<<'SQL'
            WITH total AS (
                SELECT COUNT(*) AS n FROM {@cdmSchema}.person
            ),
            covered AS (
                SELECT 'condition'   AS domain, COUNT(DISTINCT person_id) AS n FROM {@cdmSchema}.condition_occurrence
                UNION ALL
                SELECT 'drug',        COUNT(DISTINCT person_id) FROM {@cdmSchema}.drug_exposure
                UNION ALL
                SELECT 'measurement', COUNT(DISTINCT person_id) FROM {@cdmSchema}.measurement
                UNION ALL
                SELECT 'observation', COUNT(DISTINCT person_id) FROM {@cdmSchema}.observation
                UNION ALL
                SELECT 'procedure',   COUNT(DISTINCT person_id) FROM {@cdmSchema}.procedure_occurrence
                UNION ALL
                SELECT 'visit',       COUNT(DISTINCT person_id) FROM {@cdmSchema}.visit_occurrence
                UNION ALL
                SELECT 'device',      COUNT(DISTINCT person_id) FROM {@cdmSchema}.device_exposure
                UNION ALL
                SELECT 'death',       COUNT(DISTINCT person_id) FROM {@cdmSchema}.death
            )
            SELECT
                c.domain   AS stratum_1,
                ''         AS stratum_2,
                ''         AS stratum_3,
                c.n        AS count_value,
                t.n        AS total_value
            FROM covered c
            CROSS JOIN total t
            ORDER BY c.domain
            SQL;
    }
}
