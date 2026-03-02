<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA007 – Population Risk Score Distribution Comparison
 *
 * Queries the RESULTS schema (population_risk_score_results) — not the CDM —
 * to compare how risk tier distributions differ across sources for each of
 * the 20 validated risk scores (RS001–RS020).
 *
 * This is a second-order network analysis: it operates on pre-computed
 * characterisation outputs rather than raw patient data, making it extremely
 * fast and privacy-preserving.
 *
 * stratum_1 = score_id ('RS001' … 'RS020')
 * stratum_2 = risk_tier ('low' | 'intermediate' | 'high' | …)
 * stratum_3 = score_name (human-readable label)
 * count_value = patient_count in this tier at this source
 * total_value = total_eligible at this source for this score
 *
 * NOTE: perSourceSqlTemplate uses {@resultsSchema} not {@cdmSchema}.
 */
class NA007RiskScoreComparison implements NetworkAnalysisInterface
{
    public function analysisId(): string    { return 'NA007'; }
    public function analysisName(): string  { return 'Risk Score Distribution Comparison'; }
    public function category(): string      { return 'Risk'; }
    public function minimumSources(): int   { return 2; }

    public function description(): string
    {
        return 'Compares population risk tier distributions (RS001–RS020) across sources '
            . 'using pre-computed risk score results. Sources with higher proportions of '
            . 'high-risk patients may reflect older, sicker, or more underserved populations.';
    }

    public function requiredTables(): array
    {
        return ['population_risk_score_results'];   // results schema, not CDM
    }

    public function perSourceSqlTemplate(): string
    {
        // This analysis queries the results schema, not the CDM schema.
        // {@resultsSchema} is rendered by SqlRendererService.
        return <<<'SQL'
            SELECT
                score_id                  AS stratum_1,
                risk_tier                 AS stratum_2,
                score_name                AS stratum_3,
                patient_count             AS count_value,
                total_eligible            AS total_value
            FROM {@resultsSchema}.population_risk_score_results
            ORDER BY score_id, risk_tier
            SQL;
    }
}
