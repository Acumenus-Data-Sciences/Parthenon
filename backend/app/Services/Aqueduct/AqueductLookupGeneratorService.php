<?php

namespace App\Services\Aqueduct;

use Illuminate\Support\Facades\File;

class AqueductLookupGeneratorService
{
    private string $basePath;

    public function __construct()
    {
        $this->basePath = resource_path('etl/lookups');
    }

    /** @return list<array{id: string, display_name: string, domain: string|null}> */
    public function listVocabularies(): array
    {
        return [
            ['id' => 'icd10cm', 'display_name' => 'ICD-10-CM', 'domain' => 'Condition'],
            ['id' => 'icd9cm', 'display_name' => 'ICD-9-CM', 'domain' => 'Condition'],
            ['id' => 'ndc', 'display_name' => 'NDC', 'domain' => 'Drug'],
            ['id' => 'loinc', 'display_name' => 'LOINC', 'domain' => 'Measurement'],
            ['id' => 'snomed', 'display_name' => 'SNOMED', 'domain' => null],
            ['id' => 'cvx', 'display_name' => 'CVX', 'domain' => 'Drug'],
            ['id' => 'nucc', 'display_name' => 'NUCC', 'domain' => 'Provider'],
            ['id' => 'procedure', 'display_name' => 'Procedure (CPT4/HCPCS/ICD10PCS/ICD9Proc)', 'domain' => 'Procedure'],
            ['id' => 'read', 'display_name' => 'Read', 'domain' => null],
            ['id' => 'revenue', 'display_name' => 'Revenue Code', 'domain' => null],
            ['id' => 'ucum', 'display_name' => 'UCUM', 'domain' => 'Unit'],
        ];
    }

    public function vocabularyExists(string $vocabulary): bool
    {
        if (! preg_match('/^[a-z0-9]+$/', $vocabulary)) {
            return false;
        }

        return File::exists("{$this->basePath}/filters/source_to_standard/{$vocabulary}.sql");
    }

    public function assembleLookupSql(string $vocabulary, string $vocabSchema, bool $includeSourceToSource = true): string
    {
        if (! preg_match('/^[a-z0-9_]+$/', $vocabSchema)) {
            throw new \InvalidArgumentException('Invalid vocab_schema: must be alphanumeric with underscores only.');
        }

        if (! preg_match('/^[a-z0-9]+$/', $vocabulary)) {
            throw new \InvalidArgumentException('Invalid vocabulary: must be alphanumeric only.');
        }

        [$conceptFilter, $stcmFilter] = $this->splitFilter('source_to_standard', $vocabulary);

        $s2sCte = $this->readTemplate('cte_source_to_standard.sql');
        $s2sCte = str_replace('{vocabulary_filter}', $conceptFilter, $s2sCte);
        $s2sCte = str_replace('{stcm_vocabulary_filter}', $stcmFilter, $s2sCte);
        $s2sCte = str_replace('{vocab_schema}', $vocabSchema, $s2sCte);

        if ($includeSourceToSource) {
            [$s2sConceptFilter, $s2sStcmFilter] = $this->splitFilter('source_to_source', $vocabulary);
            $s2sSourceCte = $this->readTemplate('cte_source_to_source.sql');
            $s2sSourceCte = str_replace('{vocabulary_filter}', $s2sConceptFilter, $s2sSourceCte);
            $s2sSourceCte = str_replace('{stcm_vocabulary_filter}', $s2sStcmFilter, $s2sSourceCte);
            $s2sSourceCte = str_replace('{vocab_schema}', $vocabSchema, $s2sSourceCte);

            $result = $this->readTemplate('cte_result.sql');
            $result = str_replace('{source_to_standard}', $s2sCte, $result);
            $result = str_replace('{source_to_source}', $s2sSourceCte, $result);
        } else {
            $result = $this->readTemplate('cte_result_standard_only.sql');
            $result = str_replace('{source_to_standard}', $s2sCte, $result);
        }

        return $result;
    }

    /** @return array{status: string, runtime: array<string, mixed>, summary: array<string, mixed>, panels: list<mixed>, artifacts: array{artifacts: list<array<string, mixed>>}, warnings: list<string>, next_actions: list<string>} */
    public function generateResultEnvelope(string|array $vocabularies, string $vocabSchema, bool $includeSourceToSource = true): array
    {
        $startTime = microtime(true);
        $artifacts = [];

        /** @var list<string> $vocabularies */
        foreach ($vocabularies as $vocabulary) {
            $sql = $this->assembleLookupSql($vocabulary, $vocabSchema, $includeSourceToSource);
            $artifacts[] = [
                'id' => "lookup_{$vocabulary}_sql",
                'label' => strtoupper($vocabulary).' Lookup SQL',
                'kind' => 'sql',
                'content_type' => 'text/sql',
                'path' => null,
                'summary' => "Assembled lookup SQL for {$vocabulary} vocabulary",
                'downloadable' => true,
                'previewable' => true,
                'content' => $sql,
            ];
        }

        $elapsedMs = (int) ((microtime(true) - $startTime) * 1000);

        return [
            'status' => 'ok',
            'runtime' => [
                'status' => 'ready',
                'adapter_mode' => 'native',
                'fallback_active' => false,
                'upstream_ready' => true,
                'dependency_issues' => [],
                'notes' => [],
                'timings' => ['assembly_ms' => $elapsedMs],
                'last_error' => null,
            ],
            'summary' => [
                'tab' => 'lookup_generator',
                'vocabularies_requested' => count($vocabularies),
                'vocabularies_assembled' => count($artifacts),
                'include_source_to_source' => $includeSourceToSource,
                'vocab_schema' => $vocabSchema,
            ],
            'panels' => [],
            'artifacts' => ['artifacts' => $artifacts],
            'warnings' => [],
            'next_actions' => ['Download lookup SQL files', 'Execute against vocabulary database'],
        ];
    }

    /** @return array{0: string, 1: string} */
    private function splitFilter(string $type, string $vocabulary): array
    {
        $raw = $this->readFilter($type, $vocabulary);
        $parts = explode('---STCM---', $raw, 2);
        $conceptPart = trim($parts[0]);
        $stcmPart = isset($parts[1]) ? trim($parts[1]) : $conceptPart;

        return [$conceptPart, $stcmPart];
    }

    private function readTemplate(string $filename): string
    {
        return File::get("{$this->basePath}/templates/{$filename}");
    }

    private function readFilter(string $type, string $vocabulary): string
    {
        return File::get("{$this->basePath}/filters/{$type}/{$vocabulary}.sql");
    }
}
