<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use Illuminate\Support\Facades\DB;

/**
 * Resolves FHIR coding arrays to OMOP concept_ids using the vocabulary tables.
 *
 * Implements the HL7 Vulcan IG mapping algorithm:
 * 1. Direct match on standard vocabulary (SNOMED, LOINC, RxNorm)
 * 2. "Maps to" relationship from source vocabulary (ICD-10, CPT)
 * 3. Unmapped (concept_id = 0) with source_value preserved
 *
 * Uses an in-memory LRU cache to avoid repeated DB lookups within a sync run.
 */
class VocabularyLookupService
{
    /**
     * FHIR code system URI → OHDSI vocabulary_id.
     */
    private const SYSTEM_TO_VOCAB = [
        'http://snomed.info/sct' => 'SNOMED',
        'http://loinc.org' => 'LOINC',
        'http://www.nlm.nih.gov/research/umls/rxnorm' => 'RxNorm',
        'http://hl7.org/fhir/sid/icd-10-cm' => 'ICD10CM',
        'http://hl7.org/fhir/sid/icd-10' => 'ICD10',
        'http://hl7.org/fhir/sid/icd-9-cm' => 'ICD9CM',
        'http://www.ama-assn.org/go/cpt' => 'CPT4',
        'http://hl7.org/fhir/sid/ndc' => 'NDC',
        'http://hl7.org/fhir/sid/cvx' => 'CVX',
        'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets' => 'HCPCS',
        'urn:oid:2.16.840.1.113883.6.238' => 'Race',
        'urn:oid:2.16.840.1.113883.6.12' => 'CPT4',
        'http://unitsofmeasure.org' => 'UCUM',
    ];

    /** Priority vocabularies — direct standard matches preferred. */
    private const PRIORITY_VOCABS = ['SNOMED', 'LOINC', 'RxNorm'];

    /** Domain → CDM table mapping (used for concept-driven routing). */
    private const DOMAIN_TABLE = [
        'Condition' => 'condition_occurrence',
        'Drug' => 'drug_exposure',
        'Procedure' => 'procedure_occurrence',
        'Measurement' => 'measurement',
        'Observation' => 'observation',
        'Device' => 'device_exposure',
        'Specimen' => 'specimen',
    ];

    /** @var array<string, array|null> concept lookup cache: "vocab|code" => row */
    private array $conceptCache = [];

    /** @var array<string, array|null> "Maps to" cache: concept_id => standard concept row */
    private array $mapsToCache = [];

    private const MAX_CACHE = 50000;

    private string $vocabSchema;

    public function __construct()
    {
        // The vocab connection's search_path determines the schema
        $this->vocabSchema = config('database.connections.vocab.search_path', 'omop') ?: 'omop';
        // Extract first schema from search_path like "omop,public"
        $this->vocabSchema = explode(',', $this->vocabSchema)[0];
    }

    /**
     * Resolve a FHIR coding array to an OMOP concept mapping result.
     *
     * @param  array<int, array{system?: string, code?: string, display?: string}>  $codings
     * @return array{concept_id: int, domain_id: string, source_concept_id: int, source_value: string, cdm_table: string|null, mapping_type: string}
     */
    public function resolve(array $codings): array
    {
        $bestMatch = null;
        $bestPriority = PHP_INT_MAX;

        foreach ($codings as $coding) {
            $system = $coding['system'] ?? '';
            $code = $coding['code'] ?? '';
            $vocabId = self::SYSTEM_TO_VOCAB[$system] ?? null;

            if (! $vocabId || $code === '') {
                continue;
            }

            // Look up concept in vocabulary
            $concept = $this->lookupConcept($vocabId, $code);
            if (! $concept) {
                continue;
            }

            // Determine priority (lower = better)
            $priority = array_search($vocabId, self::PRIORITY_VOCABS, true);
            $priority = $priority === false ? 10 : $priority;

            if ($concept['standard_concept'] === 'S') {
                // Direct standard concept match
                if ($priority < $bestPriority) {
                    $bestMatch = [
                        'concept_id' => (int) $concept['concept_id'],
                        'domain_id' => $concept['domain_id'],
                        'source_concept_id' => (int) $concept['concept_id'],
                        'source_value' => "{$system}|{$code}",
                        'mapping_type' => 'direct_standard',
                    ];
                    $bestPriority = $priority;
                }
            } else {
                // Try "Maps to" relationship
                $standard = $this->followMapsTo((int) $concept['concept_id']);
                if ($standard && $priority < $bestPriority) {
                    $bestMatch = [
                        'concept_id' => (int) $standard['concept_id'],
                        'domain_id' => $standard['domain_id'],
                        'source_concept_id' => (int) $concept['concept_id'],
                        'source_value' => "{$system}|{$code}",
                        'mapping_type' => 'maps_to',
                    ];
                    $bestPriority = $priority;
                } elseif (! $standard && $bestMatch === null) {
                    // Non-standard with no mapping — use as source only
                    $bestMatch = [
                        'concept_id' => 0,
                        'domain_id' => $concept['domain_id'],
                        'source_concept_id' => (int) $concept['concept_id'],
                        'source_value' => "{$system}|{$code}",
                        'mapping_type' => 'source_only',
                    ];
                }
            }
        }

        if ($bestMatch !== null) {
            $bestMatch['cdm_table'] = self::DOMAIN_TABLE[$bestMatch['domain_id']] ?? null;

            return $bestMatch;
        }

        // Unmapped — preserve source value from first coding
        $firstCoding = $codings[0] ?? [];

        return [
            'concept_id' => 0,
            'domain_id' => 'Unknown',
            'source_concept_id' => 0,
            'source_value' => ($firstCoding['system'] ?? '').'|'.($firstCoding['code'] ?? ''),
            'cdm_table' => null,
            'mapping_type' => 'unmapped',
        ];
    }

    /**
     * Get the CDM table for a given domain_id.
     */
    public function domainToTable(string $domainId): ?string
    {
        return self::DOMAIN_TABLE[$domainId] ?? null;
    }

    /**
     * Resolve a UCUM unit code to an OMOP concept_id.
     *
     * @return int The concept_id for the UCUM unit, or 0 if not found.
     */
    public function resolveUcumUnit(string $ucumCode): int
    {
        $concept = $this->lookupConcept('UCUM', $ucumCode);

        return $concept ? (int) $concept['concept_id'] : 0;
    }

    /**
     * Look up a concept by vocabulary_id + concept_code.
     *
     * @return array{concept_id: int, concept_name: string, domain_id: string, vocabulary_id: string, standard_concept: string|null}|null
     */
    private function lookupConcept(string $vocabId, string $code): ?array
    {
        $cacheKey = "{$vocabId}|{$code}";

        if (array_key_exists($cacheKey, $this->conceptCache)) {
            return $this->conceptCache[$cacheKey];
        }

        $row = DB::connection('vocab')
            ->table("{$this->vocabSchema}.concept")
            ->where('vocabulary_id', $vocabId)
            ->where('concept_code', $code)
            ->where('invalid_reason', null)
            ->select('concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'standard_concept')
            ->first();

        $result = $row ? (array) $row : null;

        if (count($this->conceptCache) < self::MAX_CACHE) {
            $this->conceptCache[$cacheKey] = $result;
        }

        return $result;
    }

    /**
     * Follow "Maps to" relationship to find the standard concept.
     *
     * @return array{concept_id: int, concept_name: string, domain_id: string}|null
     */
    private function followMapsTo(int $sourceConceptId): ?array
    {
        $cacheKey = (string) $sourceConceptId;

        if (array_key_exists($cacheKey, $this->mapsToCache)) {
            return $this->mapsToCache[$cacheKey];
        }

        $row = DB::connection('vocab')
            ->table("{$this->vocabSchema}.concept_relationship as cr")
            ->join("{$this->vocabSchema}.concept as c", 'c.concept_id', '=', 'cr.concept_id_2')
            ->where('cr.concept_id_1', $sourceConceptId)
            ->where('cr.relationship_id', 'Maps to')
            ->where('cr.invalid_reason', null)
            ->where('c.standard_concept', 'S')
            ->where('c.invalid_reason', null)
            ->select('c.concept_id', 'c.concept_name', 'c.domain_id')
            ->first();

        $result = $row ? (array) $row : null;

        if (count($this->mapsToCache) < self::MAX_CACHE) {
            $this->mapsToCache[$cacheKey] = $result;
        }

        return $result;
    }

    /**
     * Clear all caches (useful between sync runs).
     */
    public function clearCache(): void
    {
        $this->conceptCache = [];
        $this->mapsToCache = [];
    }

    /**
     * Return cache stats for logging.
     */
    public function getCacheStats(): array
    {
        return [
            'concept_cache_size' => count($this->conceptCache),
            'maps_to_cache_size' => count($this->mapsToCache),
        ];
    }
}
