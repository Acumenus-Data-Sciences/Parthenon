<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add CHECK constraints enforcing OMOP CDM v5.4 required fields
     * across all production CDM schemas.
     *
     * Idempotent: each constraint is wrapped in a DO/EXCEPTION block
     * that silently skips if the constraint already exists. Table
     * existence is checked before each ALTER to handle schemas that
     * don't contain every CDM table.
     *
     * Eunomia is excluded — it's a demo dataset with its own conventions.
     */
    private const SCHEMAS = ['omop', 'synpuf', 'irsf', 'pancreas'];

    /**
     * Constraint definitions: [table, constraint_suffix, check_expression]
     */
    private function constraints(): array
    {
        return [
            ['person', 'person_gender', 'gender_concept_id IS NOT NULL'],
            ['person', 'person_yob', 'year_of_birth IS NOT NULL'],
            ['visit_occurrence', 'visit_start_date', 'visit_start_date IS NOT NULL'],
            ['condition_occurrence', 'condition_start_date', 'condition_start_date IS NOT NULL'],
            ['drug_exposure', 'drug_start_date', 'drug_exposure_start_date IS NOT NULL'],
            ['observation_period', 'obs_period_dates', 'observation_period_start_date <= observation_period_end_date'],
        ];
    }

    public function up(): void
    {
        foreach (self::SCHEMAS as $schema) {
            foreach ($this->constraints() as [$table, $suffix, $expression]) {
                $constraintName = "chk_{$schema}_{$suffix}";
                $qualifiedTable = "{$schema}.{$table}";

                DB::statement(<<<SQL
                    DO \$\$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema = '{$schema}'
                              AND table_name   = '{$table}'
                        ) THEN
                            ALTER TABLE {$qualifiedTable}
                                ADD CONSTRAINT {$constraintName}
                                CHECK ({$expression});
                        END IF;
                    EXCEPTION
                        WHEN duplicate_object THEN NULL;
                    END \$\$;
                SQL);
            }
        }
    }

    public function down(): void
    {
        foreach (self::SCHEMAS as $schema) {
            foreach ($this->constraints() as [$table, $suffix, $expression]) {
                $constraintName = "chk_{$schema}_{$suffix}";
                $qualifiedTable = "{$schema}.{$table}";

                DB::statement(
                    "ALTER TABLE IF EXISTS {$qualifiedTable} DROP CONSTRAINT IF EXISTS {$constraintName}"
                );
            }
        }
    }
};
