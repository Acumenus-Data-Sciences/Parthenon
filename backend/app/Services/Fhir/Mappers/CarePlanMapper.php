<?php

declare(strict_types=1);

namespace App\Services\Fhir\Mappers;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\Support\FhirMapperSupport;
use App\Services\Fhir\VocabularyLookupService;

/**
 * Maps a FHIR R4 CarePlan to an OMOP care-extension `care_plan` row.
 *
 * CarePlan has no native OMOP CDM v5.4 landing table; the care-extension tables
 * (2026_06_21_100000_create_omop_care_extension_tables) provide an OMOP-style
 * home. status/intent are preserved verbatim in care_plan_source_value; concept
 * resolution is deferred (all *_concept_id default to 0, the OMOP "no value"
 * convention). The subject must already be ingested or the CarePlan is skipped.
 */
class CarePlanMapper implements ResourceMapper
{
    use FhirMapperSupport;

    public function __construct(
        protected readonly VocabularyLookupService $vocab,
        protected readonly CrosswalkService $crosswalk,
    ) {}

    public function resourceType(): string
    {
        return 'CarePlan';
    }

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $r, string $siteKey): array
    {
        $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $r['subject']['reference'] ?? ''));
        if ($personId === null) {
            return [];
        }

        $encRef = $r['encounter']['reference'] ?? null;

        return [['cdm_table' => 'care_plan', 'data' => [
            'person_id' => $personId,
            'care_plan_start_date' => $this->parseDate($r['period']['start'] ?? null),
            'care_plan_end_date' => $this->parseDate($r['period']['end'] ?? null),
            'status_concept_id' => 0,
            'intent_concept_id' => 0,
            'category_concept_id' => 0,
            'visit_occurrence_id' => $encRef
                ? $this->crosswalk->lookupVisitId($siteKey, str_replace('Encounter/', '', $encRef))
                : null,
            'care_plan_source_value' => substr(($r['status'] ?? '').'|'.($r['intent'] ?? ''), 0, 100),
            'care_plan_source_concept_id' => 0,
        ]]];
    }
}
