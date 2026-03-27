<?php

namespace App\Services\Imaging;

use App\Concerns\SourceAware;
use App\Models\App\ImagingMeasurement;
use App\Models\App\ImagingStudy;
use Illuminate\Support\Collection;

/**
 * Builds longitudinal patient imaging timelines with treatment context.
 *
 * Joins imaging studies (app DB) with drug_exposure and person demographics
 * (OMOP CDM) to produce a combined timeline for outcomes research.
 */
class ImagingTimelineService
{
    use SourceAware;

    /**
     * Build a patient timeline: imaging studies + drug exposures + measurements.
     *
     * @return array{
     *   person: array,
     *   studies: array,
     *   drug_exposures: array,
     *   measurements: array,
     *   summary: array
     * }
     */
    public function getPatientTimeline(int $personId): array
    {
        $person = $this->getPersonDemographics($personId);
        $studies = $this->getStudiesForPerson($personId);
        $measurements = $this->getMeasurementsForPerson($personId);

        // Determine date range from studies for drug exposure query
        $studyDates = $studies->pluck('study_date')->filter();
        $drugExposures = [];

        if ($studyDates->isNotEmpty()) {
            $minDate = $studyDates->min();
            $maxDate = $studyDates->max();

            // Expand window: 6 months before first study, 3 months after last
            $windowStart = $minDate->copy()->subMonths(6)->format('Y-m-d');
            $windowEnd = $maxDate->copy()->addMonths(3)->format('Y-m-d');

            $drugExposures = $this->getDrugExposures($personId, $windowStart, $windowEnd);
        }

        $summary = $this->buildSummary($studies, $measurements, $drugExposures);

        return [
            'person' => $person,
            'studies' => $studies->map(fn (ImagingStudy $s) => [
                'id' => $s->id,
                'study_instance_uid' => $s->study_instance_uid,
                'study_date' => $s->study_date?->format('Y-m-d'),
                'modality' => $s->modality,
                'body_part_examined' => $s->body_part_examined,
                'study_description' => $s->study_description,
                'num_series' => $s->num_series,
                'num_images' => $s->num_images,
                'status' => $s->status,
                'measurement_count' => $s->measurements_count ?? 0,
            ])->values()->all(),
            'drug_exposures' => $drugExposures,
            'measurements' => $measurements->map(fn (ImagingMeasurement $m) => [
                'id' => $m->id,
                'study_id' => $m->study_id,
                'measurement_type' => $m->measurement_type,
                'measurement_name' => $m->measurement_name,
                'value_as_number' => $m->value_as_number,
                'unit' => $m->unit,
                'body_site' => $m->body_site,
                'laterality' => $m->laterality,
                'measured_at' => $m->measured_at?->format('Y-m-d'),
                'is_target_lesion' => $m->is_target_lesion,
                'target_lesion_number' => $m->target_lesion_number,
                'algorithm_name' => $m->algorithm_name,
                'confidence' => $m->confidence,
            ])->values()->all(),
            'summary' => $summary,
        ];
    }

    /**
     * Get all imaging studies for a patient, ordered by date.
     *
     * @return Collection<int, ImagingStudy>
     */
    public function getStudiesForPerson(int $personId): Collection
    {
        return ImagingStudy::where('person_id', $personId)
            ->withCount('measurements')
            ->orderBy('study_date')
            ->get();
    }

    /**
     * Get person demographics from OMOP CDM.
     *
     * @return array{person_id: int, year_of_birth: int|null, gender: string|null, race: string|null}
     */
    public function getPersonDemographics(int $personId): array
    {
        $row = $this->cdm()
            ->table('person as p')
            ->leftJoin('concept as gc', 'gc.concept_id', '=', 'p.gender_concept_id')
            ->leftJoin('concept as rc', 'rc.concept_id', '=', 'p.race_concept_id')
            ->where('p.person_id', $personId)
            ->select([
                'p.person_id',
                'p.year_of_birth',
                'gc.concept_name as gender',
                'rc.concept_name as race',
            ])
            ->first();

        if (! $row) {
            return [
                'person_id' => $personId,
                'year_of_birth' => null,
                'gender' => null,
                'race' => null,
            ];
        }

        return [
            'person_id' => $row->person_id,
            'year_of_birth' => $row->year_of_birth,
            'gender' => $row->gender,
            'race' => $row->race,
        ];
    }

    /**
     * Get drug exposures from OMOP CDM within a date range.
     *
     * Groups by drug concept to avoid returning millions of individual prescription rows.
     * Returns one row per distinct drug with its earliest start and latest end.
     *
     * @return list<array{drug_concept_id: int, drug_name: string, drug_class: string|null, start_date: string, end_date: string|null, total_days: int|null}>
     */
    public function getDrugExposures(int $personId, string $windowStart, string $windowEnd): array
    {
        $rows = $this->cdm()
            ->table('drug_exposure as de')
            ->join('concept as dc', 'dc.concept_id', '=', 'de.drug_concept_id')
            ->leftJoin('concept_ancestor as ca', function ($join) {
                $join->on('ca.descendant_concept_id', '=', 'de.drug_concept_id');
            })
            ->leftJoin('concept as cc', function ($join) {
                $join->on('cc.concept_id', '=', 'ca.ancestor_concept_id')
                    ->where('cc.vocabulary_id', '=', 'ATC')
                    ->whereRaw('char_length(cc.concept_code) = 3'); // ATC level 2 = pharmacological class
            })
            ->where('de.person_id', $personId)
            ->where('de.drug_exposure_start_date', '>=', $windowStart)
            ->where('de.drug_exposure_start_date', '<=', $windowEnd)
            ->groupBy('de.drug_concept_id', 'dc.concept_name')
            ->selectRaw('
                de.drug_concept_id,
                dc.concept_name as drug_name,
                MIN(cc.concept_name) as drug_class,
                MIN(de.drug_exposure_start_date) as start_date,
                MAX(COALESCE(de.drug_exposure_end_date, de.drug_exposure_start_date)) as end_date,
                SUM(COALESCE(de.days_supply, 1)) as total_days
            ')
            ->orderBy('start_date')
            ->limit(50)
            ->get();

        return $rows->map(fn ($r) => [
            'drug_concept_id' => $r->drug_concept_id,
            'drug_name' => $r->drug_name,
            'drug_class' => $r->drug_class,
            'start_date' => $r->start_date,
            'end_date' => $r->end_date,
            'total_days' => (int) $r->total_days,
        ])->all();
    }

    /**
     * Get all measurements for a person, ordered by date.
     *
     * @return Collection<int, ImagingMeasurement>
     */
    public function getMeasurementsForPerson(int $personId): Collection
    {
        return ImagingMeasurement::where('person_id', $personId)
            ->orderBy('measured_at')
            ->orderBy('measurement_type')
            ->get();
    }

    /**
     * Get measurement trends: time series of a specific measurement type for a patient.
     *
     * @return list<array{date: string, value: float, unit: string, study_id: int, measurement_name: string}>
     */
    public function getMeasurementTrends(int $personId, string $measurementType, ?string $bodySite = null): array
    {
        $query = ImagingMeasurement::where('person_id', $personId)
            ->where('measurement_type', $measurementType)
            ->orderBy('measured_at');

        if ($bodySite) {
            $query->where('body_site', $bodySite);
        }

        return $query->get()->map(fn (ImagingMeasurement $m) => [
            'date' => $m->measured_at?->format('Y-m-d'),
            'value' => $m->value_as_number,
            'unit' => $m->unit,
            'study_id' => $m->study_id,
            'measurement_name' => $m->measurement_name,
            'body_site' => $m->body_site,
            'is_target_lesion' => $m->is_target_lesion,
        ])->all();
    }

    /**
     * Link imaging studies to an OMOP person_id.
     *
     * @param  list<int>  $studyIds
     */
    public function linkStudiesToPerson(array $studyIds, int $personId): int
    {
        return ImagingStudy::whereIn('id', $studyIds)
            ->update(['person_id' => $personId]);
    }

    /**
     * Auto-link studies by matching DICOM patient ID to OMOP person source values.
     * Returns count of newly linked studies.
     */
    public function autoLinkStudies(): int
    {
        // Match by patient_id_dicom → person_source_value in OMOP
        $unlinked = ImagingStudy::whereNull('person_id')
            ->whereNotNull('patient_id_dicom')
            ->pluck('patient_id_dicom', 'id');

        if ($unlinked->isEmpty()) {
            return 0;
        }

        $sourceValues = $unlinked->values()->unique()->all();

        $matches = $this->cdm()
            ->table('person')
            ->whereIn('person_source_value', $sourceValues)
            ->pluck('person_id', 'person_source_value');

        $linked = 0;
        foreach ($unlinked as $studyId => $dicomPatientId) {
            $personId = $matches->get($dicomPatientId);
            if ($personId) {
                ImagingStudy::where('id', $studyId)->update(['person_id' => $personId]);
                $linked++;
            }
        }

        return $linked;
    }

    /**
     * Link unlinked imaging studies to CDM patients matching a specific condition.
     *
     * Each unique DICOM patient gets assigned to a distinct CDM patient with the
     * given condition. This allows research-grade linking of de-identified imaging
     * datasets (e.g., Harvard COVID-19) to real CDM patients for demonstration.
     *
     * @param  string  $conditionPattern  SQL ILIKE pattern for condition name
     * @param  int  $limit  Max studies to link
     * @return array{linked: int, patients_used: int, errors: int}
     */
    public function linkStudiesToConditionPatients(string $conditionPattern, int $limit = 1000): array
    {
        // Get unlinked studies grouped by DICOM patient ID
        $unlinked = ImagingStudy::whereNull('person_id')
            ->select('id', 'patient_id_dicom', 'patient_name_dicom', 'study_date')
            ->orderBy('patient_id_dicom')
            ->orderBy('study_date')
            ->limit($limit * 5) // headroom for multi-study patients
            ->get();

        if ($unlinked->isEmpty()) {
            return ['linked' => 0, 'patients_used' => 0, 'errors' => 0];
        }

        // Group by DICOM patient ID (each unique patient gets one CDM person)
        $grouped = $unlinked->groupBy(fn ($s) => $s->patient_id_dicom ?? $s->patient_name_dicom ?? "unknown-{$s->id}");

        // Get CDM patients with the specified condition (randomized for variety)
        // Use subquery to avoid PostgreSQL "SELECT DISTINCT + ORDER BY RANDOM()" conflict
        $subquery = $this->cdm()
            ->table('condition_occurrence as co')
            ->join('concept as c', 'c.concept_id', '=', 'co.condition_concept_id')
            ->join('person as p', 'p.person_id', '=', 'co.person_id')
            ->where('c.concept_name', 'ilike', $conditionPattern)
            ->select('p.person_id')
            ->distinct();

        $candidates = $this->cdm()
            ->query()
            ->fromSub($subquery, 'candidates')
            ->orderByRaw('RANDOM()')
            ->limit($grouped->count())
            ->pluck('person_id')
            ->values();

        if ($candidates->isEmpty()) {
            return ['linked' => 0, 'patients_used' => 0, 'errors' => 0];
        }

        $linked = 0;
        $patientsUsed = 0;
        $errors = 0;
        $candidateIndex = 0;

        foreach ($grouped as $dicomPatientKey => $studies) {
            if ($candidateIndex >= $candidates->count()) {
                break; // Ran out of candidate patients
            }

            $personId = $candidates[$candidateIndex];
            $candidateIndex++;
            $patientsUsed++;

            foreach ($studies as $study) {
                try {
                    ImagingStudy::where('id', $study->id)->update(['person_id' => $personId]);
                    $linked++;
                } catch (\Throwable) {
                    $errors++;
                }
            }
        }

        return ['linked' => $linked, 'patients_used' => $patientsUsed, 'errors' => $errors];
    }

    /**
     * Build summary statistics for a patient's imaging timeline.
     *
     * @param  Collection<int, ImagingStudy>  $studies
     * @param  Collection<int, ImagingMeasurement>  $measurements
     * @param  list<array>  $drugExposures
     * @return array{total_studies: int, modalities: list<string>, date_range: array, total_measurements: int, measurement_types: list<string>, total_drugs: int, imaging_span_days: int|null}
     */
    private function buildSummary(Collection $studies, Collection $measurements, array $drugExposures): array
    {
        $dates = $studies->pluck('study_date')->filter();

        return [
            'total_studies' => $studies->count(),
            'modalities' => $studies->pluck('modality')->filter()->unique()->values()->all(),
            'date_range' => [
                'first' => $dates->min()?->format('Y-m-d'),
                'last' => $dates->max()?->format('Y-m-d'),
            ],
            'total_measurements' => $measurements->count(),
            'measurement_types' => $measurements->pluck('measurement_type')->unique()->values()->all(),
            'total_drugs' => count($drugExposures),
            'imaging_span_days' => $dates->count() >= 2
                ? $dates->min()->diffInDays($dates->max())
                : null,
        ];
    }
}
