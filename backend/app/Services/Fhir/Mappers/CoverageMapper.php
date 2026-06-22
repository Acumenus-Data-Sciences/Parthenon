<?php

declare(strict_types=1);

namespace App\Services\Fhir\Mappers;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\Support\FhirMapperSupport;
use App\Services\Fhir\VocabularyLookupService;

/**
 * Maps a FHIR R4 Coverage to an OMOP CDM `payer_plan_period` row.
 *
 * Captures the payer (insurer) and plan over a coverage period. Period bounds
 * default to wide sentinels when absent so the row remains insertable. The
 * beneficiary must already be ingested or the coverage is skipped.
 */
class CoverageMapper implements ResourceMapper
{
    use FhirMapperSupport;

    public function __construct(
        protected readonly VocabularyLookupService $vocab,
        protected readonly CrosswalkService $crosswalk,
    ) {}

    public function resourceType(): string
    {
        return 'Coverage';
    }

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $r, string $siteKey): array
    {
        $beneRef = $r['beneficiary']['reference'] ?? $r['subscriber']['reference'] ?? '';
        $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $beneRef));
        if ($personId === null) {
            return [];
        }
        $payor = $r['payor'][0]['display'] ?? ($r['payor'][0]['reference'] ?? null);
        $plan = null;
        foreach ($r['class'] ?? [] as $c) {
            if (($c['type']['coding'][0]['code'] ?? null) === 'plan') {
                $plan = $c['value'] ?? $c['name'] ?? null;
            }
        }

        return [['cdm_table' => 'payer_plan_period', 'data' => [
            'person_id' => $personId,
            'payer_plan_period_start_date' => $this->parseDate($r['period']['start'] ?? null) ?? '1970-01-01',
            'payer_plan_period_end_date' => $this->parseDate($r['period']['end'] ?? null) ?? '2099-12-31',
            'payer_concept_id' => 0,
            'payer_source_value' => $payor ? substr((string) $payor, 0, 50) : null,
            'plan_concept_id' => 0,
            'plan_source_value' => $plan ? substr((string) $plan, 0, 50) : null,
        ]]];
    }
}
