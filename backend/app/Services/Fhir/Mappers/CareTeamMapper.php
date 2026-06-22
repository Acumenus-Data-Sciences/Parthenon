<?php

declare(strict_types=1);

namespace App\Services\Fhir\Mappers;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\Support\FhirMapperSupport;
use App\Services\Fhir\VocabularyLookupService;

/**
 * Maps a FHIR R4 CareTeam to one OMOP care-extension `care_team` row plus one
 * `care_team_member` row per participant.
 *
 * Surrogate-PK linkage (Option B — single-pass, no processor changes):
 * care_team_member.care_team_id must reference the parent care_team's PK, which
 * is auto-generated at INSERT time and therefore unknown when map() returns.
 * Rather than coordinate a two-phase insert in the NDJSON processor, the mapper
 * resolves a deterministic care_team_id up front via
 * CrosswalkService::resolveCareTeamId() — exactly mirroring how resolveProviderId
 * / resolveCareSiteId get-or-create a stable surrogate id from a crosswalk table.
 * The mapper then emits the care_team row WITH that explicit id and links every
 * member row to it, so the linkage is never null and the whole resource maps in
 * a single pass with a plain batched insert.
 *
 * Each participant's member reference routes by type: Practitioner →
 * resolveProviderId (provider_id), Organization → resolveCareSiteId
 * (care_site_id). role[0].coding[0].display is preserved verbatim in
 * role_source_value; role_concept_id is deferred (0). The subject must already
 * be ingested or the CareTeam is skipped.
 */
class CareTeamMapper implements ResourceMapper
{
    use FhirMapperSupport;

    public function __construct(
        protected readonly VocabularyLookupService $vocab,
        protected readonly CrosswalkService $crosswalk,
    ) {}

    public function resourceType(): string
    {
        return 'CareTeam';
    }

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $r, string $siteKey): array
    {
        $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $r['subject']['reference'] ?? ''));
        if ($personId === null) {
            return [];
        }

        $fhirCareTeamId = (string) ($r['id'] ?? '');
        $careTeamId = $this->crosswalk->resolveCareTeamId($siteKey, $fhirCareTeamId);

        $rows = [];

        // care_team identity row (explicit surrogate PK from the crosswalk).
        $rows[] = ['cdm_table' => 'care_team', 'data' => [
            'care_team_id' => $careTeamId,
            'person_id' => $personId,
            'care_team_start_date' => $this->parseDate($r['period']['start'] ?? null),
            'care_team_end_date' => $this->parseDate($r['period']['end'] ?? null),
            'status' => substr($r['status'] ?? '', 0, 50) ?: null,
            'care_team_source_value' => substr($fhirCareTeamId, 0, 100) ?: null,
        ]];

        // One member row per participant, each linked to the care_team above.
        foreach ($r['participant'] ?? [] as $participant) {
            $memberRef = $participant['member']['reference'] ?? '';
            $providerId = null;
            $careSiteId = null;

            if (str_starts_with($memberRef, 'Practitioner/')) {
                $providerId = $this->crosswalk->resolveProviderId($siteKey, str_replace('Practitioner/', '', $memberRef));
            } elseif (str_starts_with($memberRef, 'Organization/')) {
                $careSiteId = $this->crosswalk->resolveCareSiteId($siteKey, str_replace('Organization/', '', $memberRef));
            }

            $roleCoding = $participant['role'][0]['coding'][0] ?? [];
            $roleSourceValue = $roleCoding['display'] ?? ($roleCoding['code'] ?? null);

            $rows[] = ['cdm_table' => 'care_team_member', 'data' => [
                'care_team_id' => $careTeamId,
                'provider_id' => $providerId,
                'care_site_id' => $careSiteId,
                'role_concept_id' => 0,
                'role_source_value' => $roleSourceValue !== null ? substr((string) $roleSourceValue, 0, 250) : null,
            ]];
        }

        return $rows;
    }
}
