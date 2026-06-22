<?php

declare(strict_types=1);

namespace App\Services\Fhir\Mappers;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\Support\FhirMapperSupport;
use App\Services\Fhir\VocabularyLookupService;

/**
 * Maps a FHIR R4 ServiceRequest to an OMOP CDM `procedure_occurrence` row.
 *
 * Only actionable orders are mapped: status in {active, completed} and intent in
 * {order, original-order, reflex-order}. Proposals, plans, drafts, and revoked
 * requests are skipped. The patient must already be ingested or the request is
 * skipped.
 */
class ServiceRequestMapper implements ResourceMapper
{
    use FhirMapperSupport;

    public function __construct(
        protected readonly VocabularyLookupService $vocab,
        protected readonly CrosswalkService $crosswalk,
    ) {}

    public function resourceType(): string
    {
        return 'ServiceRequest';
    }

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $r, string $siteKey): array
    {
        if (! in_array($r['status'] ?? '', ['active', 'completed'], true)) {
            return [];
        }
        if (! in_array($r['intent'] ?? '', ['order', 'original-order', 'reflex-order'], true)) {
            return [];
        }
        $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $r['subject']['reference'] ?? ''));
        if ($personId === null) {
            return [];
        }
        $resolved = $this->vocab->resolve($this->extractCodings($r['code'] ?? []));
        $encRef = $r['encounter']['reference'] ?? null;
        $visitId = $encRef ? $this->crosswalk->lookupVisitId($siteKey, str_replace('Encounter/', '', $encRef)) : null;
        $when = $r['authoredOn'] ?? $r['occurrenceDateTime'] ?? $r['occurrencePeriod']['start'] ?? null;

        return [['cdm_table' => 'procedure_occurrence', 'data' => [
            'person_id' => $personId,
            'procedure_concept_id' => $resolved['concept_id'],
            'procedure_date' => $this->parseDate($when),
            'procedure_datetime' => $this->parseDatetime($when),
            'procedure_type_concept_id' => 32817,
            'quantity' => $r['quantityQuantity']['value'] ?? null,
            'visit_occurrence_id' => $visitId,
            'procedure_source_value' => $resolved['source_value'],
            'procedure_source_concept_id' => $resolved['source_concept_id'],
        ]]];
    }
}
