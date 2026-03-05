<?php

namespace App\Services\Cohort\Builders;

use App\Services\Cohort\Criteria\CriteriaBuilderRegistry;
use App\Services\Cohort\Criteria\DemographicCriteriaBuilder;
use App\Services\Cohort\Schema\CohortExpressionSchema;

class InclusionCriteriaBuilder
{
    public function __construct(
        private readonly CriteriaBuilderRegistry $registry,
        private readonly CohortExpressionSchema $schema,
        private readonly TemporalWindowBuilder $temporalBuilder,
        private readonly OccurrenceFilterBuilder $occurrenceBuilder,
        private readonly DemographicCriteriaBuilder $demographicBuilder,
    ) {}

    /**
     * Build inclusion criteria CTEs from the AdditionalCriteria group.
     *
     * Each criterion produces a CTE of person_ids that satisfy it.
     * The final inclusion_events CTE combines them based on the group Type.
     *
     * @param  array<string, mixed>|null  $additionalCriteria  The AdditionalCriteria section
     * @param  list<array<string, mixed>>  $demographicCriteria  The DemographicCriteria array
     * @param  string  $cdmSchema  The CDM schema qualifier
     * @return list<string> Array of CTE definitions
     */
    public function build(?array $additionalCriteria, array $demographicCriteria, string $cdmSchema): array
    {
        $ctes = [];
        $rulePersonSets = [];
        $ruleIndex = 0;

        // Build demographic filter CTE if present
        if (! empty($demographicCriteria)) {
            $demographicClauses = $this->demographicBuilder->buildWhereClauses(
                $demographicCriteria,
                'p',
                'qe.start_date'
            );

            if (! empty($demographicClauses)) {
                $whereStr = implode("\n    AND ", $demographicClauses);
                $cteName = "inclusion_rule_{$ruleIndex}";
                $ctes[] = <<<SQL
{$cteName} AS (
    SELECT DISTINCT qe.person_id
    FROM qualified_events qe
    JOIN {@cdmSchema}.person p ON qe.person_id = p.person_id
    WHERE {$whereStr}
)
SQL;
                // Replace placeholder
                $ctes[array_key_last($ctes)] = str_replace('{@cdmSchema}', $cdmSchema, $ctes[array_key_last($ctes)]);
                $rulePersonSets[] = $cteName;
                $ruleIndex++;
            }
        }

        // Build AdditionalCriteria rules
        if ($additionalCriteria !== null) {
            $ruleCtes = $this->buildGroup($additionalCriteria, $cdmSchema, $ruleIndex);
            $ctes = array_merge($ctes, $ruleCtes['ctes']);
            $rulePersonSets = array_merge($rulePersonSets, $ruleCtes['personSets']);
        }

        // If no inclusion rules, all qualified events pass through
        if (empty($rulePersonSets)) {
            $ctes[] = <<<'SQL'
inclusion_events AS (
    SELECT person_id, start_date, end_date, concept_id, op_start_date, op_end_date
    FROM qualified_events
)
SQL;

            return $ctes;
        }

        // Combine person sets based on group type
        $groupType = $additionalCriteria['Type'] ?? 'ALL';
        $inclusionCte = $this->buildCombinedInclusion($rulePersonSets, $groupType);
        $ctes[] = $inclusionCte;

        return $ctes;
    }

    /**
     * Build CTEs for a criteria group (handles nested Groups recursively).
     *
     * @return array{ctes: list<string>, personSets: list<string>}
     */
    private function buildGroup(array $group, string $cdmSchema, int &$ruleIndex): array
    {
        $ctes = [];
        $personSets = [];

        // Process each criterion in the group's CriteriaList
        foreach ($group['CriteriaList'] ?? [] as $criterionWrapper) {
            $criteria = $criterionWrapper['Criteria'] ?? $criterionWrapper;
            $domainKey = $this->schema->extractDomainKey($criteria);

            if ($domainKey === null) {
                continue;
            }

            $domainConfig = $criteria[$domainKey];
            $builder = $this->registry->get($domainKey);

            $cteName = "inclusion_rule_{$ruleIndex}";
            $cte = $this->buildSingleCriterionCte(
                cteName: $cteName,
                builder: $builder,
                domainConfig: $domainConfig,
                criterionWrapper: $criterionWrapper,
                cdmSchema: $cdmSchema,
            );

            $ctes[] = $cte;
            $personSets[] = $cteName;
            $ruleIndex++;
        }

        // Process nested Groups recursively
        foreach ($group['Groups'] ?? [] as $nestedGroup) {
            $nestedResult = $this->buildGroup($nestedGroup, $cdmSchema, $ruleIndex);
            $ctes = array_merge($ctes, $nestedResult['ctes']);

            // If the nested group has multiple person sets, combine them into one CTE
            if (count($nestedResult['personSets']) > 1) {
                $nestedType = $nestedGroup['Type'] ?? 'ALL';
                $combinedName = "inclusion_group_{$ruleIndex}";
                $combinedCte = $this->buildGroupCombination($nestedResult['personSets'], $nestedType, $combinedName);
                $ctes[] = $combinedCte;
                $personSets[] = $combinedName;
                $ruleIndex++;
            } elseif (count($nestedResult['personSets']) === 1) {
                $personSets[] = $nestedResult['personSets'][0];
            }
        }

        return ['ctes' => $ctes, 'personSets' => $personSets];
    }

    /**
     * Build a CTE for a single inclusion criterion.
     */
    private function buildSingleCriterionCte(
        string $cteName,
        \App\Services\Cohort\Criteria\CriteriaBuilderInterface $builder,
        array $domainConfig,
        array $criterionWrapper,
        string $cdmSchema,
    ): string {
        $table = $builder->cdmTable();
        $conceptCol = $builder->conceptIdColumn();
        $startDateCol = $builder->startDateColumn();
        $personIdCol = $builder->personIdColumn();

        // CodesetId join
        $codesetId = $domainConfig['CodesetId'] ?? null;
        $codesetJoin = '';
        if ($codesetId !== null) {
            $codesetJoin = "\n    JOIN codesetId_{$codesetId} cs ON e.{$conceptCol} = cs.concept_id";
        }

        // Domain-specific WHERE clauses
        $domainWhere = $builder->buildWhereClauses($domainConfig, 'e');

        // Temporal window constraints
        $windowClauses = [];
        if (isset($criterionWrapper['StartWindow'])) {
            $windowClauses = array_merge(
                $windowClauses,
                $this->temporalBuilder->build($criterionWrapper['StartWindow'], "e.{$startDateCol}", 'qe.start_date')
            );
        }
        if (isset($criterionWrapper['EndWindow'])) {
            $windowClauses = array_merge(
                $windowClauses,
                $this->temporalBuilder->build($criterionWrapper['EndWindow'], "e.{$startDateCol}", 'qe.end_date')
            );
        }

        // Restrict to observation period
        $restrictVisit = $criterionWrapper['RestrictVisit'] ?? false;

        // Combine all WHERE clauses
        $allWhere = array_merge($domainWhere, $windowClauses);
        $whereStr = '';
        if (! empty($allWhere)) {
            $whereStr = "\n    AND ".implode("\n    AND ", $allWhere);
        }

        // Occurrence filter
        $occurrence = $criterionWrapper['Occurrence'] ?? null;
        $havingClause = $this->occurrenceBuilder->buildClause($occurrence);

        // Build the CTE
        $selectExpr = 'qe.person_id';
        $groupBy = 'GROUP BY qe.person_id';

        if (! empty($havingClause)) {
            return <<<SQL
{$cteName} AS (
    SELECT {$selectExpr}
    FROM qualified_events qe
    JOIN {$cdmSchema}.{$table} e ON qe.person_id = e.{$personIdCol}{$codesetJoin}
    WHERE 1=1{$whereStr}
    {$groupBy}
    {$havingClause}
)
SQL;
        }

        return <<<SQL
{$cteName} AS (
    SELECT DISTINCT {$selectExpr}
    FROM qualified_events qe
    JOIN {$cdmSchema}.{$table} e ON qe.person_id = e.{$personIdCol}{$codesetJoin}
    WHERE 1=1{$whereStr}
)
SQL;
    }

    /**
     * Build the final inclusion_events CTE that combines all rule results.
     */
    private function buildCombinedInclusion(array $rulePersonSets, string $groupType): string
    {
        if (count($rulePersonSets) === 1) {
            $set = $rulePersonSets[0];

            return <<<SQL
inclusion_events AS (
    SELECT qe.person_id, qe.start_date, qe.end_date, qe.concept_id, qe.op_start_date, qe.op_end_date
    FROM qualified_events qe
    WHERE qe.person_id IN (SELECT person_id FROM {$set})
)
SQL;
        }

        $personFilter = $this->buildGroupCombinationSql($rulePersonSets, $groupType);

        return <<<SQL
inclusion_events AS (
    SELECT qe.person_id, qe.start_date, qe.end_date, qe.concept_id, qe.op_start_date, qe.op_end_date
    FROM qualified_events qe
    WHERE {$personFilter}
)
SQL;
    }

    /**
     * Build a CTE that combines multiple person sets based on group type.
     */
    private function buildGroupCombination(array $personSets, string $groupType, string $cteName): string
    {
        $filter = $this->buildGroupCombinationSql($personSets, $groupType);

        return <<<SQL
{$cteName} AS (
    SELECT DISTINCT person_id
    FROM qualified_events qe
    WHERE {$filter}
)
SQL;
    }

    /**
     * Build the SQL WHERE fragment for combining person sets.
     */
    private function buildGroupCombinationSql(array $personSets, string $groupType): string
    {
        return match ($groupType) {
            'ALL' => implode(
                "\n    AND ",
                array_map(fn (string $set) => "qe.person_id IN (SELECT person_id FROM {$set})", $personSets)
            ),
            'ANY' => '('.implode(
                "\n    OR ",
                array_map(fn (string $set) => "qe.person_id IN (SELECT person_id FROM {$set})", $personSets)
            ).')',
            'AT_MOST_0' => implode(
                "\n    AND ",
                array_map(fn (string $set) => "qe.person_id NOT IN (SELECT person_id FROM {$set})", $personSets)
            ),
            default => implode(
                "\n    AND ",
                array_map(fn (string $set) => "qe.person_id IN (SELECT person_id FROM {$set})", $personSets)
            ),
        };
    }
}
