<?php

declare(strict_types=1);

namespace App\Services\Fhir\Mappers\Support;

use Illuminate\Support\Carbon;

/**
 * Shared FHIR → OMOP mapping helpers reused across per-resource mapper classes.
 *
 * Extracted from FhirBulkMapper to allow upcoming per-resource mapper classes to
 * reuse subject/encounter resolution, coding extraction, and date parsing without
 * duplication. Behavior is identical to the original private FhirBulkMapper methods.
 *
 * The using class MUST expose `$this->vocab` (VocabularyLookupService) and
 * `$this->crosswalk` (CrosswalkService). It must also provide an `extractRef()`
 * method (resolveSubjectPersonId / resolveEncounterVisitId call `$this->extractRef`).
 */
trait FhirMapperSupport
{
    protected function resolveSubjectPersonId(array $r, string $siteKey, string $field = 'subject'): int
    {
        $ref = $this->extractRef($r[$field] ?? []);

        return $ref ? $this->crosswalk->resolvePersonId($siteKey, $ref) : 0;
    }

    protected function resolveEncounterVisitId(array $r, string $siteKey, string $field = 'encounter'): ?int
    {
        $ref = $this->extractRef($r[$field] ?? []);
        if (! $ref) {
            return null;
        }

        return $this->crosswalk->lookupVisitId($siteKey, $ref);
    }

    protected function extractCodings(array $codeableConcept): array
    {
        return $codeableConcept['coding'] ?? [];
    }

    protected function parseDate(?string $value): ?string
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    protected function parseDatetime(?string $value): ?string
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value)->toDateTimeString();
        } catch (\Throwable) {
            return null;
        }
    }
}
