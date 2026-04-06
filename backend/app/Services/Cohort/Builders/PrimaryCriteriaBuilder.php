<?php

namespace App\Services\Cohort\Builders;

use App\Services\Cohort\Criteria\CriteriaBuilderRegistry;
use App\Services\Cohort\Schema\CohortExpressionSchema;

class PrimaryCriteriaBuilder
{
    public function __construct(
        private readonly CriteriaBuilderRegistry $registry,
        private readonly CohortExpressionSchema $schema,
    ) {}

    /**
     * Build the primary_events CTE and optional qualified_events wrapper.
     *
     * @param  array<string, mixed>  $primaryCriteria  The PrimaryCriteria section of the expression
     * @param  string  $cdmSchema  The CDM schema qualifier
     * @param  array<string, mixed>  $qualifiedLimit  The QualifiedLimit config
     * @return list<string> Array of CTE definitions
     */
    public function build(array $primaryCriteria, string $cdmSchema, array $qualifiedLimit): array
    {
        $criteriaList = $primaryCriteria['CriteriaList'];
        $obsWindow = $primaryCriteria['ObservationWindow'];
        $priorDays = (int) $obsWindow['PriorDays'];
        $postDays = (int) $obsWindow['PostDays'];

        // Build UNION ALL of all primary criteria domain queries
        $unionParts = [];

        foreach ($criteriaList as $criterion) {
            $domainKey = $this->schema->extractDomainKey($criterion);
            if ($domainKey === null) {
                continue;
            }

            $domainConfig = $criterion[$domainKey];
            $builder = $this->registry->get($domainKey);

            $table = $builder->cdmTable();
            $conceptCol = $builder->conceptIdColumn();
            $startDateCol = $builder->startDateColumn();
            $endDateCol = $builder->endDateColumn();
            $personIdCol = $builder->personIdColumn();

            // End date expression: use end_date if available, otherwise fall back to start_date
            $endDateExpr = $endDateCol !== null
                ? "COALESCE(e.{$endDateCol}, e.{$startDateCol})"
                : "e.{$startDateCol}";

            // Build WHERE clauses
            $whereClauses = $builder->buildWhereClauses($domainConfig, 'e');

            // CodesetId filter
            $codesetId = $domainConfig['CodesetId'] ?? null;
            $codesetJoin = '';
            if ($codesetId !== null) {
                $codesetJoin = "\n        JOIN codesetId_{$codesetId} cs ON e.{$conceptCol} = cs.concept_id";
            }

            // First event only filter
            $first = $domainConfig['First'] ?? false;

            // Build additional WHERE clause string
            $whereStr = '';
            if (! empty($whereClauses)) {
                $whereStr = "\n        AND ".implode("\n        AND ", $whereClauses);
            }

            // Observation period constraint
            $opJoin = "JOIN {$cdmSchema}.observation_period op\n            ON p.{$personIdCol} = op.person_id";
            $opWhere = "\n            AND e.{$startDateCol} >= DATEADD(op.observation_period_start_date, {$priorDays})"
                     ."\n            AND e.{$startDateCol} <= DATEADD(op.observation_period_end_date, -{$postDays})";

            $selectPart = <<<SQL
        SELECT
            p.person_id,
            e.{$startDateCol} AS start_date,
            {$endDateExpr} AS end_date,
            e.{$conceptCol} AS concept_id,
            op.observation_period_start_date AS op_start_date,
            op.observation_period_end_date AS op_end_date
        FROM {$cdmSchema}.person p
        JOIN {$cdmSchema}.{$table} e ON p.{$personIdCol} = e.{$personIdCol}{$codesetJoin}
        {$opJoin}{$opWhere}
        WHERE 1=1{$whereStr}
SQL;

            $unionParts[] = $selectPart;
        }

        $unionSql = implode("\n    UNION ALL\n", $unionParts);

        // Wrap in primary_events CTE with ROW_NUMBER for ordinal
        $primaryEventsCte = <<<SQL
primary_events AS MATERIALIZED (
    SELECT
        pe.person_id,
        pe.start_date,
        pe.end_date,
        pe.concept_id,
        pe.op_start_date,
        pe.op_end_date,
        ROW_NUMBER() OVER (PARTITION BY pe.person_id ORDER BY pe.start_date) AS ordinal
    FROM (
{$unionSql}
    ) pe
)
SQL;

        $ctes = [$primaryEventsCte];

        // Apply QualifiedLimit — wrap with ordinal filter
        $limitType = $qualifiedLimit['Type'] ?? 'First';

        $qualifiedCte = match ($limitType) {
            'First' => <<<'SQL'
qualified_events AS MATERIALIZED (
    SELECT *
    FROM primary_events
    WHERE ordinal = 1
)
SQL,
            'All' => <<<'SQL'
qualified_events AS MATERIALIZED (
    SELECT *
    FROM primary_events
)
SQL,
            default => <<<'SQL'
qualified_events AS MATERIALIZED (
    SELECT *
    FROM primary_events
    WHERE ordinal = 1
)
SQL,
        };

        $ctes[] = $qualifiedCte;

        return $ctes;
    }
}
