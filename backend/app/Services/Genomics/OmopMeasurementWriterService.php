<?php

namespace App\Services\Genomics;

use App\Models\App\GenomicUpload;
use App\Models\App\GenomicVariant;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Maps parsed genomic variants to OMOP MEASUREMENT records.
 *
 * OMOP Genomic Vocabulary conventions followed:
 * - measurement_concept_id: LOINC/custom genomic concepts (0 = unmapped)
 * - measurement_source_value: "GENE:HGVS_c" or "CHR:POS:REF>ALT"
 * - measurement_type_concept_id: 32856 (Lab) — standard for genomic measurements
 * - value_as_concept_id: ClinVar pathogenicity concept
 * - unit_concept_id: 0 (genomic observations are unitless)
 *
 * ClinVar significance → OMOP concept mapping (OMOP CDM v5.4 standard):
 * - Pathogenic → 36307720
 * - Likely pathogenic → 36307719
 * - Uncertain significance → 36307718
 * - Likely benign → 36307717
 * - Benign → 36307716
 */
class OmopMeasurementWriterService
{
    /**
     * Well-known concept IDs for genomic measurement type.
     * 32856 = "Lab" measurement type (standard for lab/genomic observations)
     */
    private const MEASUREMENT_TYPE_CONCEPT_LAB = 32856;

    /**
     * ClinVar significance → OMOP concept_id mapping.
     * Source: OMOP CDM vocab; these concepts are in the "Measurement" domain.
     */
    private const CLINVAR_CONCEPT_MAP = [
        'Pathogenic' => 36307720,
        'Likely pathogenic' => 36307719,
        'Uncertain significance' => 36307718,
        'Likely benign' => 36307717,
        'Benign' => 36307716,
    ];

    /**
     * Write all unmapped variants from an upload to OMOP MEASUREMENT.
     *
     * @param  string  $connectionName  The CDM DB connection (e.g. 'cdm', 'eunomia')
     * @param  string  $schema  OMOP schema name (e.g. 'omop', 'eunomia')
     * @return array{written: int, skipped: int, errors: int}
     */
    public function writeUploadToOmop(
        GenomicUpload $upload,
        string $connectionName = 'cdm',
        string $schema = 'omop'
    ): array {
        $written = 0;
        $skipped = 0;
        $errors = 0;

        $conn = DB::connection($connectionName);

        $upload->variants()
            ->where('mapping_status', '!=', 'imported')
            ->whereNotNull('person_id')
            ->chunk(200, function ($variants) use ($conn, $schema, &$written, &$skipped, &$errors) {
                foreach ($variants as $variant) {
                    try {
                        $measurementId = $this->writeVariant($variant, $conn, $schema);
                        $variant->update([
                            'omop_measurement_id' => $measurementId,
                            'mapping_status' => 'mapped',
                        ]);
                        $written++;
                    } catch (\Throwable $e) {
                        $errors++;
                        Log::warning('OmopMeasurementWriterService: write error', [
                            'variant_id' => $variant->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            });

        // Count variants with null person_id (cannot write without OMOP person)
        $skipped = $upload->variants()->whereNull('person_id')->count();

        // Update upload stats
        $upload->update([
            'mapped_variants' => $written,
            'status' => $errors === 0 ? 'imported' : 'review',
            'imported_at' => now(),
        ]);

        return ['written' => $written, 'skipped' => $skipped, 'errors' => $errors];
    }

    /**
     * Write a single variant as an OMOP MEASUREMENT record.
     *
     * @return int The new measurement_id
     */
    private function writeVariant(GenomicVariant $variant, Connection $conn, string $schema): int
    {
        // Resolve the next measurement_id (sequence or max+1 for CDM without sequences)
        $maxId = $conn->selectOne("SELECT COALESCE(MAX(measurement_id), 0) AS max_id FROM {$schema}.measurement");
        $newId = ($maxId->max_id ?? 0) + 1;

        $conceptId = $this->resolveMeasurementConceptId($variant, $conn, $schema);
        $valueConceptId = $this->resolveClinvarConcept($variant->clinvar_significance);

        $conn->table("{$schema}.measurement")->insert([
            'measurement_id' => $newId,
            'person_id' => $variant->person_id,
            'measurement_concept_id' => $conceptId,
            'measurement_date' => now()->toDateString(),
            'measurement_datetime' => now()->toDateTimeString(),
            'measurement_type_concept_id' => self::MEASUREMENT_TYPE_CONCEPT_LAB,
            'value_as_number' => $variant->allele_frequency,
            'value_as_concept_id' => $valueConceptId,
            'unit_concept_id' => 0,
            'range_low' => null,
            'range_high' => null,
            'provider_id' => null,
            'visit_occurrence_id' => null,
            'visit_detail_id' => null,
            'measurement_source_value' => mb_substr($variant->measurement_source_value ?? '', 0, 50),
            'measurement_source_concept_id' => 0,
            'unit_source_value' => null,
            'value_source_value' => mb_substr("{$variant->reference_allele}>{$variant->alternate_allele}", 0, 50),
        ]);

        return $newId;
    }

    /**
     * Attempt to resolve a standard OMOP concept_id for this variant.
     * Priority: explicit measurement_concept_id set during parsing > gene LOINC lookup > 0.
     */
    private function resolveMeasurementConceptId(GenomicVariant $variant, Connection $conn, string $schema): int
    {
        if ($variant->measurement_concept_id > 0) {
            return $variant->measurement_concept_id;
        }

        // Try HGVS lookup in vocab: measurement_source_value as search term
        if ($variant->gene_symbol && $variant->hgvs_c) {
            try {
                $concept = $conn->selectOne(
                    "SELECT concept_id FROM {$schema}.concept
                     WHERE concept_code = ? AND domain_id = 'Measurement'
                     AND standard_concept = 'S' AND invalid_reason IS NULL
                     LIMIT 1",
                    [$variant->hgvs_c]
                );
                if ($concept) {
                    return (int) $concept->concept_id;
                }

                // Fallback: gene-level concept search
                $geneConcept = $conn->selectOne(
                    "SELECT concept_id FROM {$schema}.concept
                     WHERE concept_name ILIKE ? AND domain_id = 'Measurement'
                     AND standard_concept = 'S' AND invalid_reason IS NULL
                     LIMIT 1",
                    ["%{$variant->gene_symbol}%gene variant%"]
                );
                if ($geneConcept) {
                    return (int) $geneConcept->concept_id;
                }
            } catch (\Throwable) {
                // vocab lookup failed; fallback to 0
            }
        }

        return 0;
    }

    private function resolveClinvarConcept(?string $sig): ?int
    {
        if ($sig === null) {
            return null;
        }
        foreach (self::CLINVAR_CONCEPT_MAP as $key => $conceptId) {
            if (stripos($sig, $key) !== false) {
                return $conceptId;
            }
        }

        return null;
    }
}
