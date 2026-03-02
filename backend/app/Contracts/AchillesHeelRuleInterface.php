<?php

namespace App\Contracts;

interface AchillesHeelRuleInterface
{
    /**
     * Unique numeric rule identifier.
     */
    public function ruleId(): int;

    /**
     * Human-readable rule name.
     */
    public function ruleName(): string;

    /**
     * Severity: 'error', 'warning', or 'notification'.
     */
    public function severity(): string;

    /**
     * Domain or category this rule applies to (e.g. 'Person', 'Death', 'All').
     */
    public function category(): string;

    /**
     * SQL template that SELECTs rows to insert into achilles_heel_results.
     *
     * Must return columns: (rule_id, rule_name, severity, record_count, attribute_name, attribute_value).
     * Placeholders: {@resultsSchema}, {@cdmSchema}.
     */
    public function sqlTemplate(): string;
}
