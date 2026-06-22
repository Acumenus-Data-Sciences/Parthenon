<?php

declare(strict_types=1);

namespace App\Services\Fhir\Mappers;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\Support\FhirMapperSupport;
use App\Services\Fhir\VocabularyLookupService;

/**
 * Maps a FHIR R4 Goal to an OMOP care-extension `care_goal` row.
 *
 * The goal description (text, falling back to the first coding display) is kept
 * verbatim in goal_source_value; lifecycleStatus is preserved as-is. The start
 * date prefers Goal.startDate, falling back to the first target.dueDate.
 *
 * care_plan_id is null for v1 — cross-resource surrogate-PK linking (CarePlan →
 * Goal) is deferred; the column is nullable. The subject must already be
 * ingested or the Goal is skipped.
 */
class GoalMapper implements ResourceMapper
{
    use FhirMapperSupport;

    public function __construct(
        protected readonly VocabularyLookupService $vocab,
        protected readonly CrosswalkService $crosswalk,
    ) {}

    public function resourceType(): string
    {
        return 'Goal';
    }

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $r, string $siteKey): array
    {
        $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $r['subject']['reference'] ?? ''));
        if ($personId === null) {
            return [];
        }

        $desc = $r['description']['text'] ?? ($r['description']['coding'][0]['display'] ?? '');
        $start = $r['startDate'] ?? ($r['target'][0]['dueDate'] ?? null);

        return [['cdm_table' => 'care_goal', 'data' => [
            'person_id' => $personId,
            'care_plan_id' => null,
            'lifecycle_status' => substr($r['lifecycleStatus'] ?? '', 0, 50) ?: null,
            'achievement_status_concept_id' => 0,
            'goal_start_date' => $this->parseDate($start),
            'goal_source_value' => substr((string) $desc, 0, 250) ?: null,
            'goal_source_concept_id' => 0,
        ]]];
    }
}
