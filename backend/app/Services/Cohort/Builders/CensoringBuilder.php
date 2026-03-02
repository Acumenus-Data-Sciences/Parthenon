<?php

namespace App\Services\Cohort\Builders;

use App\Services\Cohort\Criteria\CriteriaBuilderRegistry;
use App\Services\Cohort\Schema\CohortExpressionSchema;

class CensoringBuilder
{
    public function __construct(
        private readonly CriteriaBuilderRegistry $registry,
        private readonly CohortExpressionSchema $schema,
    ) {}

    /**
     * Build censoring CTEs from the CensoringCriteria array.
     *
     * Each censoring criterion generates a (person_id, censoring_date) CTE.
     * The final result adjusts cohort_end_date = LEAST(end_date, MIN(censoring_date)).
     *
     * @param  list<array<string, mixed>>  $censoringCriteria  The CensoringCriteria array
     * @param  string  $cdmSchema  The CDM schema qualifier
     * @return array{ctes: list<string>, censorExpr: string|null}
     *   - ctes: CTE definitions
     *   - censorExpr: SQL expression to apply censoring to end_date, or null if no censoring
     */
    public function build(array $censoringCriteria, string $cdmSchema): array
    {
        if (empty($censoringCriteria)) {
            return ['ctes' => [], 'censorExpr' => null];
        }

        $ctes = [];
        $censoringSetNames = [];

        foreach ($censoringCriteria as $index => $criterion) {
            $domainKey = $this->schema->extractDomainKey($criterion);
            if ($domainKey === null) {
                continue;
            }

            $domainConfig = $criterion[$domainKey];
            $builder = $this->registry->get($domainKey);

            $table = $builder->cdmTable();
            $conceptCol = $builder->conceptIdColumn();
            $startDateCol = $builder->startDateColumn();
            $personIdCol = $builder->personIdColumn();

            $cteName = "censoring_{$index}";

            // CodesetId join
            $codesetId = $domainConfig['CodesetId'] ?? null;
            $codesetJoin = '';
            if ($codesetId !== null) {
                $codesetJoin = "\n    JOIN codesetId_{$codesetId} cs ON e.{$conceptCol} = cs.concept_id";
            }

            // Domain WHERE clauses
            $domainWhere = $builder->buildWhereClauses($domainConfig, 'e');
            $whereStr = '';
            if (! empty($domainWhere)) {
                $whereStr = "\n    AND " . implode("\n    AND ", $domainWhere);
            }

            $ctes[] = <<<SQL
{$cteName} AS (
    SELECT
        e.{$personIdCol} AS person_id,
        e.{$startDateCol} AS censoring_date
    FROM {$cdmSchema}.{$table} e{$codesetJoin}
    WHERE 1=1{$whereStr}
)
SQL;

            $censoringSetNames[] = $cteName;
        }

        if (empty($censoringSetNames)) {
            return ['ctes' => [], 'censorExpr' => null];
        }

        // Build a combined censoring CTE: earliest censoring date per person
        $unionParts = array_map(
            fn (string $name) => "SELECT person_id, censoring_date FROM {$name}",
            $censoringSetNames
        );
        $unionSql = implode("\n    UNION ALL\n    ", $unionParts);

        $ctes[] = <<<SQL
censoring_events AS (
    SELECT person_id, MIN(censoring_date) AS censoring_date
    FROM (
    {$unionSql}
    ) all_censoring
    GROUP BY person_id
)
SQL;

        // The censor expression adjusts the end date
        $censorExpr = 'CASE WHEN ce.censoring_date IS NOT NULL AND ce.censoring_date < ie.end_date THEN ce.censoring_date ELSE ie.end_date END';

        return ['ctes' => $ctes, 'censorExpr' => $censorExpr];
    }
}
