<?php

namespace App\Contracts;

interface DqdCheckInterface
{
    /**
     * Unique identifier for this check (e.g., "completeness_required_person_person_id").
     */
    public function checkId(): string;

    /**
     * Top-level DQD category: completeness, conformance, or plausibility.
     */
    public function category(): string;

    /**
     * Subcategory within the top-level category (e.g., measurePersonCompleteness, isRequired, etc.).
     */
    public function subcategory(): string;

    /**
     * CDM table this check targets (e.g., "person", "condition_occurrence").
     */
    public function cdmTable(): string;

    /**
     * CDM column this check targets, or null for table-level checks.
     */
    public function cdmColumn(): ?string;

    /**
     * Severity level: "error", "warning", or "info".
     */
    public function severity(): string;

    /**
     * Violation percentage threshold (0.0 = no tolerance, 5.0 = up to 5% violations allowed).
     */
    public function threshold(): float;

    /**
     * SQL query returning a single row with "count" column representing the number of violated rows.
     * Parameters $cdmSchema and $vocabSchema are schema-qualified prefixes (e.g., "omop").
     */
    public function sqlViolated(string $cdmSchema, string $vocabSchema): string;

    /**
     * SQL query returning a single row with "count" column representing the total row count.
     * Parameters $cdmSchema and $vocabSchema are schema-qualified prefixes (e.g., "omop").
     */
    public function sqlTotal(string $cdmSchema, string $vocabSchema): string;

    /**
     * Human-readable description of what this check validates.
     */
    public function description(): string;
}
