<?php

declare(strict_types=1);

namespace App\Services\Fhir\Mappers;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\Support\FhirMapperSupport;
use App\Services\Fhir\VocabularyLookupService;

/**
 * Maps a FHIR R4 DocumentReference to an OMOP CDM `note` row.
 *
 * Clinical documents (progress notes, discharge summaries, etc.) land in the
 * OMOP NOTE table. Inline base64 attachments are decoded; URL-only attachments
 * fall back to the URL. The patient must already be ingested (crosswalk returns
 * a person_id) or the document is skipped.
 */
class DocumentReferenceMapper implements ResourceMapper
{
    use FhirMapperSupport;

    public function __construct(
        protected readonly VocabularyLookupService $vocab,
        protected readonly CrosswalkService $crosswalk,
    ) {}

    public function resourceType(): string
    {
        return 'DocumentReference';
    }

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $r, string $siteKey): array
    {
        $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $r['subject']['reference'] ?? ''));
        if ($personId === null) {
            return [];
        }
        $encRef = $r['context']['encounter'][0]['reference'] ?? null;
        $visitId = $encRef ? $this->crosswalk->lookupVisitId($siteKey, str_replace('Encounter/', '', $encRef)) : null;
        $attachment = $r['content'][0]['attachment'] ?? [];
        $noteText = isset($attachment['data']) ? (string) base64_decode((string) $attachment['data'], true) : ($attachment['url'] ?? '');
        $typeCoding = $r['type']['coding'][0] ?? [];

        return [['cdm_table' => 'note', 'data' => [
            'person_id' => $personId,
            'note_date' => $this->parseDate($r['date'] ?? null),
            'note_datetime' => $this->parseDatetime($r['date'] ?? null),
            'note_type_concept_id' => 32817,
            'note_class_concept_id' => 0,
            'note_title' => substr($typeCoding['display'] ?? 'Clinical document', 0, 250),
            'note_text' => substr($noteText, 0, 1_000_000),
            'encoding_concept_id' => 32678,
            'language_concept_id' => 4180186,
            'visit_occurrence_id' => $visitId,
            'note_source_value' => $typeCoding['code'] ?? null,
        ]]];
    }
}
