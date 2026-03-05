<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use Illuminate\Support\Facades\DB;

/**
 * Manages FHIR-to-OMOP ID crosswalks for patients, encounters, and providers.
 *
 * OMOP CDM requires integer IDs (person_id, visit_occurrence_id, provider_id).
 * FHIR uses string-based resource IDs. This service maintains the mapping.
 */
class CrosswalkService
{
    /** @var array<string, int> in-memory cache: "site|fhirId" => personId */
    private array $patientCache = [];

    /** @var array<string, int> in-memory cache: "site|fhirId" => visitOccurrenceId */
    private array $encounterCache = [];

    /** @var array<string, int> in-memory cache: "site|fhirId" => providerId */
    private array $providerCache = [];

    /**
     * Get or create a person_id for a FHIR Patient.
     */
    public function resolvePersonId(string $siteKey, string $fhirPatientId): int
    {
        $cacheKey = "{$siteKey}|{$fhirPatientId}";

        if (isset($this->patientCache[$cacheKey])) {
            return $this->patientCache[$cacheKey];
        }

        $row = DB::table('fhir_patient_crosswalk')
            ->where('site_key', $siteKey)
            ->where('fhir_patient_id', $fhirPatientId)
            ->first();

        if ($row) {
            $this->patientCache[$cacheKey] = (int) $row->person_id;

            return (int) $row->person_id;
        }

        $personId = DB::table('fhir_patient_crosswalk')->insertGetId([
            'site_key'         => $siteKey,
            'fhir_patient_id'  => $fhirPatientId,
            'created_at'       => now(),
            'updated_at'       => now(),
        ], 'person_id');

        $this->patientCache[$cacheKey] = (int) $personId;

        return (int) $personId;
    }

    /**
     * Get or create a visit_occurrence_id for a FHIR Encounter.
     */
    public function resolveVisitId(string $siteKey, string $fhirEncounterId, int $personId): int
    {
        $cacheKey = "{$siteKey}|{$fhirEncounterId}";

        if (isset($this->encounterCache[$cacheKey])) {
            return $this->encounterCache[$cacheKey];
        }

        $row = DB::table('fhir_encounter_crosswalk')
            ->where('site_key', $siteKey)
            ->where('fhir_encounter_id', $fhirEncounterId)
            ->first();

        if ($row) {
            $this->encounterCache[$cacheKey] = (int) $row->visit_occurrence_id;

            return (int) $row->visit_occurrence_id;
        }

        $visitId = DB::table('fhir_encounter_crosswalk')->insertGetId([
            'site_key'            => $siteKey,
            'fhir_encounter_id'   => $fhirEncounterId,
            'person_id'           => $personId,
            'created_at'          => now(),
            'updated_at'          => now(),
        ], 'visit_occurrence_id');

        $this->encounterCache[$cacheKey] = (int) $visitId;

        return (int) $visitId;
    }

    /**
     * Get or create a provider_id for a FHIR Practitioner.
     */
    public function resolveProviderId(string $siteKey, string $fhirPractitionerId): int
    {
        $cacheKey = "{$siteKey}|{$fhirPractitionerId}";

        if (isset($this->providerCache[$cacheKey])) {
            return $this->providerCache[$cacheKey];
        }

        $row = DB::table('fhir_provider_crosswalk')
            ->where('site_key', $siteKey)
            ->where('fhir_practitioner_id', $fhirPractitionerId)
            ->first();

        if ($row) {
            $this->providerCache[$cacheKey] = (int) $row->provider_id;

            return (int) $row->provider_id;
        }

        $providerId = DB::table('fhir_provider_crosswalk')->insertGetId([
            'site_key'               => $siteKey,
            'fhir_practitioner_id'   => $fhirPractitionerId,
            'created_at'             => now(),
            'updated_at'             => now(),
        ], 'provider_id');

        $this->providerCache[$cacheKey] = (int) $providerId;

        return (int) $providerId;
    }

    /**
     * Lookup person_id without creating — returns null if not found.
     */
    public function lookupPersonId(string $siteKey, string $fhirPatientId): ?int
    {
        $cacheKey = "{$siteKey}|{$fhirPatientId}";

        if (isset($this->patientCache[$cacheKey])) {
            return $this->patientCache[$cacheKey];
        }

        $row = DB::table('fhir_patient_crosswalk')
            ->where('site_key', $siteKey)
            ->where('fhir_patient_id', $fhirPatientId)
            ->first();

        if ($row) {
            $this->patientCache[$cacheKey] = (int) $row->person_id;

            return (int) $row->person_id;
        }

        return null;
    }

    /**
     * Lookup visit_occurrence_id without creating — returns null if not found.
     */
    public function lookupVisitId(string $siteKey, string $fhirEncounterId): ?int
    {
        $cacheKey = "{$siteKey}|{$fhirEncounterId}";

        if (isset($this->encounterCache[$cacheKey])) {
            return $this->encounterCache[$cacheKey];
        }

        $row = DB::table('fhir_encounter_crosswalk')
            ->where('site_key', $siteKey)
            ->where('fhir_encounter_id', $fhirEncounterId)
            ->first();

        if ($row) {
            $this->encounterCache[$cacheKey] = (int) $row->visit_occurrence_id;

            return (int) $row->visit_occurrence_id;
        }

        return null;
    }

    /**
     * Clear all caches.
     */
    public function clearCache(): void
    {
        $this->patientCache = [];
        $this->encounterCache = [];
        $this->providerCache = [];
    }
}
