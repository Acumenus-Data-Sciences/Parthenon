<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export;

use Illuminate\Support\Facades\DB;

class ReverseVocabularyService
{
    private const VOCAB_TO_SYSTEM = [
        'SNOMED'  => 'http://snomed.info/sct',
        'LOINC'   => 'http://loinc.org',
        'RxNorm'  => 'http://www.nlm.nih.gov/research/umls/rxnorm',
        'ICD10CM' => 'http://hl7.org/fhir/sid/icd-10-cm',
        'ICD10'   => 'http://hl7.org/fhir/sid/icd-10',
        'ICD9CM'  => 'http://hl7.org/fhir/sid/icd-9-cm',
        'CPT4'    => 'http://www.ama-assn.org/go/cpt',
        'NDC'     => 'http://hl7.org/fhir/sid/ndc',
        'CVX'     => 'http://hl7.org/fhir/sid/cvx',
        'HCPCS'   => 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets',
        'Race'    => 'urn:oid:2.16.840.1.113883.6.238',
        'UCUM'    => 'http://unitsofmeasure.org',
    ];

    private const MAX_CACHE = 50000;

    /** @var array<int, array{system: string, code: string, display: string}|null> */
    private array $cache = [];

    private string $vocabSchema;

    public function __construct()
    {
        $this->vocabSchema = config('database.connections.vocab.search_path', 'omop') ?: 'omop';
        $this->vocabSchema = explode(',', $this->vocabSchema)[0];
    }

    /**
     * Resolve an OMOP concept_id to a FHIR coding.
     *
     * @return array{concept_id: int, coding: list<array{system: string, code: string, display: string}>}
     */
    public function resolve(int $conceptId): array
    {
        if ($conceptId === 0) {
            return ['concept_id' => 0, 'coding' => []];
        }

        $coding = $this->lookupConcept($conceptId);

        return [
            'concept_id' => $conceptId,
            'coding' => $coding ? [$coding] : [],
        ];
    }

    /**
     * Build a FHIR CodeableConcept from standard + source concept IDs.
     *
     * @return array{coding?: list<array{system: string, code: string, display: string}>, text?: string, extension?: list<array>}
     */
    public function buildCodeableConcept(int $conceptId, int $sourceConceptId = 0, ?string $sourceValue = null): array
    {
        $result = [];
        $codings = [];

        // Standard concept
        if ($conceptId > 0) {
            $coding = $this->lookupConcept($conceptId);
            if ($coding) {
                $codings[] = $coding;
            }
        }

        // Source concept (if different from standard)
        if ($sourceConceptId > 0 && $sourceConceptId !== $conceptId) {
            $sourceCoding = $this->lookupConcept($sourceConceptId);
            if ($sourceCoding) {
                $codings[] = $sourceCoding;
            }
        }

        if (! empty($codings)) {
            $result['coding'] = $codings;
        }

        // Preserve source_value as text
        if ($sourceValue) {
            $result['text'] = $sourceValue;
        }

        // Data absent reason for unmapped concepts
        if ($conceptId === 0 && empty($codings)) {
            $result['extension'] = [[
                'url' => 'http://hl7.org/fhir/StructureDefinition/data-absent-reason',
                'valueCode' => 'unknown',
            ]];
        }

        return $result;
    }

    /**
     * Check if a concept belongs to a specific vocabulary.
     */
    public function isVocabulary(int $conceptId, string $vocabularyId): bool
    {
        $coding = $this->lookupConcept($conceptId);

        if (! $coding) {
            return false;
        }

        $system = self::VOCAB_TO_SYSTEM[$vocabularyId] ?? '';

        return $coding['system'] === $system;
    }

    /**
     * Resolve a concept_id to its vocabulary_id.
     */
    public function getVocabularyId(int $conceptId): ?string
    {
        if ($conceptId === 0) {
            return null;
        }

        if (array_key_exists($conceptId, $this->cache)) {
            return $this->cache[$conceptId] ? ($this->reverseSystemLookup($this->cache[$conceptId]['system']) ?? null) : null;
        }

        $row = DB::connection('vocab')
            ->table("{$this->vocabSchema}.concept")
            ->where('concept_id', $conceptId)
            ->select('vocabulary_id')
            ->first();

        return $row ? $row->vocabulary_id : null;
    }

    private function lookupConcept(int $conceptId): ?array
    {
        if (array_key_exists($conceptId, $this->cache)) {
            return $this->cache[$conceptId];
        }

        $row = DB::connection('vocab')
            ->table("{$this->vocabSchema}.concept")
            ->where('concept_id', $conceptId)
            ->select('concept_code', 'vocabulary_id', 'concept_name')
            ->first();

        if (! $row) {
            if (count($this->cache) < self::MAX_CACHE) {
                $this->cache[$conceptId] = null;
            }

            return null;
        }

        $system = self::VOCAB_TO_SYSTEM[$row->vocabulary_id] ?? null;

        $result = $system ? [
            'system' => $system,
            'code' => $row->concept_code,
            'display' => $row->concept_name,
        ] : null;

        if (count($this->cache) < self::MAX_CACHE) {
            $this->cache[$conceptId] = $result;
        }

        return $result;
    }

    private function reverseSystemLookup(string $system): ?string
    {
        $key = array_search($system, self::VOCAB_TO_SYSTEM, true);

        return $key !== false ? $key : null;
    }

    public function clearCache(): void
    {
        $this->cache = [];
    }
}
