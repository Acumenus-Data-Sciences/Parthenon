<?php

namespace App\Services\Cohort;

use App\Services\Cohort\Builders\CensoringBuilder;
use App\Services\Cohort\Builders\ConceptSetSqlBuilder;
use App\Services\Cohort\Builders\EndStrategyBuilder;
use App\Services\Cohort\Builders\InclusionCriteriaBuilder;
use App\Services\Cohort\Builders\PrimaryCriteriaBuilder;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use App\Services\SqlRenderer\SqlRendererService;

class CohortSqlCompiler
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
        private readonly CohortExpressionSchema $schema,
        private readonly ConceptSetSqlBuilder $conceptSetBuilder,
        private readonly PrimaryCriteriaBuilder $primaryBuilder,
        private readonly InclusionCriteriaBuilder $inclusionBuilder,
        private readonly CensoringBuilder $censoringBuilder,
        private readonly EndStrategyBuilder $endStrategyBuilder,
    ) {}

    /**
     * Compile a cohort expression into executable SQL that populates the cohort table.
     *
     * The output SQL:
     * 1. Deletes existing rows for this cohort_definition_id
     * 2. Uses CTEs to build concept sets, primary events, inclusion rules, and censoring
     * 3. Inserts qualifying rows into the cohort table
     *
     * @param  array<string, mixed>  $expression  The cohort expression JSON
     * @param  string  $cdmSchema  The CDM schema qualifier
     * @param  string  $vocabSchema  The vocabulary schema qualifier
     * @param  string  $resultsSchema  The results schema qualifier
     * @param  int  $cohortDefinitionId  The cohort definition ID
     * @param  string  $dialect  The SQL dialect name (default: postgresql)
     * @return string The compiled SQL
     */
    public function compile(
        array $expression,
        string $cdmSchema,
        string $vocabSchema,
        string $resultsSchema,
        int $cohortDefinitionId,
        string $dialect = 'postgresql',
    ): string {
        // 1. Validate and normalize expression
        $expression = $this->schema->validate($expression);

        // 2. Build all CTE parts
        $allCtes = [];

        // Concept set CTEs
        $conceptSetCtes = $this->conceptSetBuilder->build(
            $expression['conceptSets'],
            $vocabSchema
        );
        $allCtes = array_merge($allCtes, $conceptSetCtes);

        // Primary criteria CTEs (primary_events + qualified_events)
        $primaryCtes = $this->primaryBuilder->build(
            $expression['PrimaryCriteria'],
            $cdmSchema,
            $expression['QualifiedLimit']
        );
        $allCtes = array_merge($allCtes, $primaryCtes);

        // Inclusion criteria CTEs
        $inclusionCtes = $this->inclusionBuilder->build(
            $expression['AdditionalCriteria'],
            $expression['DemographicCriteria'],
            $cdmSchema
        );
        $allCtes = array_merge($allCtes, $inclusionCtes);

        // Censoring CTEs
        $censorResult = $this->censoringBuilder->build(
            $expression['CensoringCriteria'],
            $cdmSchema
        );
        $allCtes = array_merge($allCtes, $censorResult['ctes']);

        // 3. Build end date expression
        $endDateExpr = $this->endStrategyBuilder->build(
            $expression['EndStrategy'],
            'ie.start_date',
            'ie.end_date'
        );

        // 4. Apply censoring to end date if present
        $hasCensoring = $censorResult['censorExpr'] !== null;
        $finalEndDateExpr = $hasCensoring ? $censorResult['censorExpr'] : $endDateExpr;

        // 5. Build the final SELECT
        $fromClause = 'inclusion_events ie';
        $censorJoin = '';
        if ($hasCensoring) {
            $censorJoin = "\nLEFT JOIN censoring_events ce ON ie.person_id = ce.person_id";
        }

        // 6. Build Expression Limit
        $expressionLimit = $expression['ExpressionLimit'] ?? ['Type' => 'First'];
        $expressionLimitSql = '';
        if ($expressionLimit['Type'] === 'First') {
            // Wrap in ROW_NUMBER to get first per person
            $finalSelectCte = <<<SQL
final_cohort AS (
    SELECT
        ie.person_id,
        ie.start_date,
        {$finalEndDateExpr} AS end_date,
        ROW_NUMBER() OVER (PARTITION BY ie.person_id ORDER BY ie.start_date) AS rn
    FROM {$fromClause}{$censorJoin}
    WHERE ie.start_date <= {$endDateExpr}
)
SQL;
            $allCtes[] = $finalSelectCte;
            $finalSelect = "SELECT {$cohortDefinitionId} AS cohort_definition_id, person_id AS subject_id, start_date AS cohort_start_date, end_date AS cohort_end_date\nFROM final_cohort\nWHERE rn = 1";
        } else {
            // All events
            $finalSelectCte = <<<SQL
final_cohort AS (
    SELECT
        ie.person_id,
        ie.start_date,
        {$finalEndDateExpr} AS end_date
    FROM {$fromClause}{$censorJoin}
    WHERE ie.start_date <= {$endDateExpr}
)
SQL;
            $allCtes[] = $finalSelectCte;
            $finalSelect = "SELECT {$cohortDefinitionId} AS cohort_definition_id, person_id AS subject_id, start_date AS cohort_start_date, end_date AS cohort_end_date\nFROM final_cohort";
        }

        // 7. Assemble the complete SQL
        $cteSql = implode(",\n\n", $allCtes);

        $deleteSql = "DELETE FROM {$resultsSchema}.cohort WHERE cohort_definition_id = {$cohortDefinitionId}";

        $insertSql = <<<SQL
WITH

{$cteSql}

INSERT INTO {$resultsSchema}.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
{$finalSelect};
SQL;

        $fullSql = "{$deleteSql};\n\n{$insertSql}";

        // 8. Render through SqlRendererService to resolve dialect functions
        return $this->sqlRenderer->render($fullSql, [
            'cdmSchema' => $cdmSchema,
            'vocabSchema' => $vocabSchema,
            'resultsSchema' => $resultsSchema,
        ], $dialect);
    }

    /**
     * Compile a cohort expression into a preview SELECT (no INSERT/DELETE).
     *
     * Useful for previewing the SQL that would be generated without executing it.
     *
     * @param  array<string, mixed>  $expression  The cohort expression JSON
     * @param  string  $cdmSchema  The CDM schema qualifier
     * @param  string  $vocabSchema  The vocabulary schema qualifier
     * @param  string  $dialect  The SQL dialect name (default: postgresql)
     * @return string The preview SQL (SELECT only)
     */
    public function preview(
        array $expression,
        string $cdmSchema,
        string $vocabSchema,
        string $dialect = 'postgresql',
    ): string {
        // 1. Validate and normalize expression
        $expression = $this->schema->validate($expression);

        // 2. Build all CTE parts
        $allCtes = [];

        // Concept set CTEs
        $conceptSetCtes = $this->conceptSetBuilder->build(
            $expression['conceptSets'],
            $vocabSchema
        );
        $allCtes = array_merge($allCtes, $conceptSetCtes);

        // Primary criteria CTEs
        $primaryCtes = $this->primaryBuilder->build(
            $expression['PrimaryCriteria'],
            $cdmSchema,
            $expression['QualifiedLimit']
        );
        $allCtes = array_merge($allCtes, $primaryCtes);

        // Inclusion criteria CTEs
        $inclusionCtes = $this->inclusionBuilder->build(
            $expression['AdditionalCriteria'],
            $expression['DemographicCriteria'],
            $cdmSchema
        );
        $allCtes = array_merge($allCtes, $inclusionCtes);

        // Censoring CTEs
        $censorResult = $this->censoringBuilder->build(
            $expression['CensoringCriteria'],
            $cdmSchema
        );
        $allCtes = array_merge($allCtes, $censorResult['ctes']);

        // 3. Build end date expression
        $endDateExpr = $this->endStrategyBuilder->build(
            $expression['EndStrategy'],
            'ie.start_date',
            'ie.end_date'
        );

        // 4. Apply censoring
        $hasCensoring = $censorResult['censorExpr'] !== null;
        $finalEndDateExpr = $hasCensoring ? $censorResult['censorExpr'] : $endDateExpr;

        $fromClause = 'inclusion_events ie';
        $censorJoin = '';
        if ($hasCensoring) {
            $censorJoin = "\nLEFT JOIN censoring_events ce ON ie.person_id = ce.person_id";
        }

        // 5. Build final SELECT CTE
        $expressionLimit = $expression['ExpressionLimit'] ?? ['Type' => 'First'];

        if ($expressionLimit['Type'] === 'First') {
            $finalSelectCte = <<<SQL
final_cohort AS (
    SELECT
        ie.person_id,
        ie.start_date,
        {$finalEndDateExpr} AS end_date,
        ROW_NUMBER() OVER (PARTITION BY ie.person_id ORDER BY ie.start_date) AS rn
    FROM {$fromClause}{$censorJoin}
    WHERE ie.start_date <= {$endDateExpr}
)
SQL;
            $allCtes[] = $finalSelectCte;
            $finalSelect = "SELECT person_id, start_date AS cohort_start_date, end_date AS cohort_end_date\nFROM final_cohort\nWHERE rn = 1\nORDER BY person_id, cohort_start_date";
        } else {
            $finalSelectCte = <<<SQL
final_cohort AS (
    SELECT
        ie.person_id,
        ie.start_date,
        {$finalEndDateExpr} AS end_date
    FROM {$fromClause}{$censorJoin}
    WHERE ie.start_date <= {$endDateExpr}
)
SQL;
            $allCtes[] = $finalSelectCte;
            $finalSelect = "SELECT person_id, start_date AS cohort_start_date, end_date AS cohort_end_date\nFROM final_cohort\nORDER BY person_id, cohort_start_date";
        }

        // 6. Assemble preview SQL
        $cteSql = implode(",\n\n", $allCtes);

        $previewSql = <<<SQL
WITH

{$cteSql}

{$finalSelect};
SQL;

        // 7. Render through SqlRendererService
        return $this->sqlRenderer->render($previewSql, [
            'cdmSchema' => $cdmSchema,
            'vocabSchema' => $vocabSchema,
        ], $dialect);
    }
}
