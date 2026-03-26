<?php

namespace App\Services\Etl;

use App\Models\App\EtlFieldMapping;
use App\Models\App\EtlProject;
use App\Models\App\EtlTableMapping;

class EtlSqlGeneratorService
{
    /**
     * Generate SQL for all table mappings in a project.
     *
     * @return array<string, string> filename => SQL content
     */
    public function generate(EtlProject $project): array
    {
        $project->load('tableMappings.fieldMappings');
        $source = $project->source;

        // Determine schema names from source daimons
        $sourceSchema = '{source_schema}';
        $cdmSchema = '{cdm_schema}';
        $vocabSchema = '{vocab_schema}';

        if ($source) {
            $source->loadMissing('daimons');
            foreach ($source->daimons as $d) {
                if ($d->daimon_type->value === 'cdm') {
                    $sourceSchema = $d->table_qualifier;
                }
            }
            // CDM and vocab schemas come from the TARGET, not the source
            // Leave as placeholders unless we have a target source configured
        }

        $files = [];
        $allSql = "-- Aqueduct ETL SQL — {$project->name}\n";
        $allSql .= '-- Generated: '.now()->toIso8601String()."\n";
        $allSql .= "-- WARNING: Review all mappings before executing against production data.\n";
        $allSql .= "-- WARNING: 'expression' type mappings contain user-defined SQL. Verify carefully.\n\n";

        $order = 1;
        foreach ($project->tableMappings as $mapping) {
            if ($mapping->is_stem) {
                // Stem table SQL handled separately
                $sql = $this->generateStemSql($mapping, $sourceSchema, $cdmSchema, $vocabSchema);
            } else {
                $sql = $this->generateTableSql($mapping, $sourceSchema, $cdmSchema, $vocabSchema);
            }

            $filename = sprintf('%02d_%s_to_%s.sql', $order, $mapping->source_table, $mapping->target_table);
            $files[$filename] = $sql;
            $allSql .= "-- ============================================================\n";
            $allSql .= "-- {$mapping->source_table} → {$mapping->target_table}\n";
            $allSql .= "-- ============================================================\n\n";
            $allSql .= $sql."\n\n";
            $order++;
        }

        $files['_all.sql'] = $allSql;

        return $files;
    }

    private function generateTableSql(
        EtlTableMapping $mapping,
        string $sourceSchema,
        string $cdmSchema,
        string $vocabSchema,
    ): string {
        $fields = $mapping->fieldMappings()->get();

        if ($fields->isEmpty()) {
            return "-- No field mappings defined for {$mapping->source_table} → {$mapping->target_table}\n";
        }

        $targetCols = [];
        $selectExprs = [];

        foreach ($fields as $field) {
            $targetCols[] = $this->quote($field->target_column);
            $selectExprs[] = $this->buildSelectExpression($field, $sourceSchema, $vocabSchema);
        }

        $sql = '';
        if ($mapping->logic) {
            $sql .= "-- Table logic: {$mapping->logic}\n";
        }

        $sql .= "INSERT INTO {$cdmSchema}.{$this->quote($mapping->target_table)} (\n";
        $sql .= '    '.implode(",\n    ", $targetCols)."\n";
        $sql .= ")\nSELECT\n";
        $sql .= '    '.implode(",\n    ", $selectExprs)."\n";
        $sql .= "FROM {$sourceSchema}.{$this->quote($mapping->source_table)};\n";

        return $sql;
    }

    private function generateStemSql(
        EtlTableMapping $mapping,
        string $sourceSchema,
        string $cdmSchema,
        string $vocabSchema,
    ): string {
        $sql = "-- STEM TABLE: {$mapping->source_table} → stem → domain routing\n\n";

        // Step 1: Insert into stem
        $sql .= $this->generateTableSql($mapping, $sourceSchema, $cdmSchema, $vocabSchema);
        $sql .= "\n";

        // Step 2: Domain fan-out
        $routing = StemTableDefinition::domainRouting();
        foreach ($routing as $domain => $cdmTable) {
            $sql .= "-- Route domain '{$domain}' to {$cdmTable}\n";
            $sql .= "INSERT INTO {$cdmSchema}.{$this->quote($cdmTable)}\n";
            $sql .= "SELECT * FROM {$cdmSchema}._stem\n";
            $sql .= "WHERE domain_id = '{$domain}';\n\n";
        }

        return $sql;
    }

    private function buildSelectExpression(
        EtlFieldMapping $field,
        string $sourceSchema,
        string $vocabSchema,
    ): string {
        $sourceCol = $field->source_column
            ? $this->quote($field->source_column)
            : 'NULL';

        $comment = $field->logic ? " -- {$field->logic}" : '';

        return match ($field->mapping_type) {
            'direct' => "{$sourceCol}{$comment}",
            'constant' => ($field->logic ?? 'NULL').$comment,
            'transform' => ($field->logic
                ? str_replace('{col}', $sourceCol, $field->logic)
                : $sourceCol).$comment,
            'lookup' => "COALESCE((\n"
                ."        SELECT c.concept_id\n"
                ."        FROM {$vocabSchema}.concept c\n"
                ."        WHERE c.concept_code = {$sourceCol}::varchar\n"
                ."        AND c.standard_concept = 'S'\n"
                ."        LIMIT 1\n"
                ."    ), 0){$comment}",
            'concat' => ($field->logic ?? "CONCAT({$sourceCol})").$comment,
            'expression' => ($field->logic ?? 'NULL')." /* USER EXPRESSION — review before executing */{$comment}",
            default => "{$sourceCol}{$comment}",
        };
    }

    private function quote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
