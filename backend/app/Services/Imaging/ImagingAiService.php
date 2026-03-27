<?php

namespace App\Services\Imaging;

use App\Models\App\ImagingMeasurement;
use App\Models\App\ImagingStudy;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * AI-powered imaging measurement extraction.
 *
 * Uses the Parthenon AI service (Ollama/MedGemma) to extract quantitative
 * imaging biomarkers from radiology reports and DICOM metadata. When connected
 * to a clinical NLP pipeline, this service can automatically populate
 * imaging_measurements for treatment response assessment.
 */
class ImagingAiService
{
    private string $aiBaseUrl;

    public function __construct()
    {
        $this->aiBaseUrl = rtrim(config('services.ai.base_url', 'http://python-ai:8000'), '/');
    }

    /**
     * Auto-extract measurements from radiology reports and DICOM metadata.
     *
     * Strategy:
     * 1. Get DICOM series metadata (modality, body part, description)
     * 2. Query OMOP NOTE table for radiology reports matching this study's person + date
     * 3. Send to AI service for structured extraction
     * 4. Insert extracted measurements into imaging_measurements
     *
     * @return array{extracted: int, measurement_types: list<string>}
     */
    public function extractMeasurements(ImagingStudy $study): array
    {
        $study->load('series');

        // Build context from DICOM metadata
        $context = $this->buildStudyContext($study);

        // Get radiology report text if available
        $reportText = $this->getRadiologyReport($study);

        if (! $reportText && ! $context['series_descriptions']) {
            return ['extracted' => 0, 'measurement_types' => []];
        }

        // Call AI service for extraction
        $measurements = $this->callAiExtraction($context, $reportText);

        // Persist extracted measurements
        $inserted = 0;
        $types = [];
        foreach ($measurements as $m) {
            ImagingMeasurement::create([
                'study_id' => $study->id,
                'person_id' => $study->person_id,
                'measurement_type' => $m['measurement_type'],
                'measurement_name' => $m['measurement_name'],
                'value_as_number' => $m['value_as_number'],
                'unit' => $m['unit'],
                'body_site' => $m['body_site'] ?? $study->body_part_examined,
                'algorithm_name' => 'MedGemma-ImagingExtractor',
                'confidence' => $m['confidence'] ?? 0.7,
                'measured_at' => $study->study_date,
            ]);
            $inserted++;
            $types[] = $m['measurement_type'];
        }

        return [
            'extracted' => $inserted,
            'measurement_types' => array_values(array_unique($types)),
        ];
    }

    /**
     * Suggest measurement template based on study modality and body part.
     *
     * @return array{template: string, fields: list<array{type: string, name: string, unit: string}>}
     */
    public function suggestTemplate(ImagingStudy $study): array
    {
        $modality = $study->modality;
        $bodyPart = $study->body_part_examined;
        $description = strtolower($study->study_description ?? '');

        // COVID lung studies
        if (str_contains($description, 'covid') || str_contains($description, 'lung covid')) {
            return [
                'template' => 'COVID Lung CT',
                'fields' => [
                    ['type' => 'ct_severity_score', 'name' => 'CT Severity Index', 'unit' => 'score'],
                    ['type' => 'ground_glass_extent', 'name' => 'Ground Glass Opacity', 'unit' => '%'],
                    ['type' => 'consolidation_extent', 'name' => 'Consolidation', 'unit' => '%'],
                    ['type' => 'opacity_score', 'name' => 'Total Opacity Score', 'unit' => '%'],
                ],
            ];
        }

        // PET scans
        if ($modality === 'PT') {
            return [
                'template' => 'PET Response (Lugano)',
                'fields' => [
                    ['type' => 'suvmax', 'name' => 'SUVmax', 'unit' => 'SUV'],
                    ['type' => 'metabolic_tumor_volume', 'name' => 'MTV', 'unit' => 'cm3'],
                    ['type' => 'total_lesion_glycolysis', 'name' => 'TLG', 'unit' => 'g'],
                ],
            ];
        }

        // Brain MR
        if ($modality === 'MR' && in_array($bodyPart, ['HEAD', 'BRAIN'], true)) {
            return [
                'template' => 'Brain Tumor (RANO)',
                'fields' => [
                    ['type' => 'tumor_volume', 'name' => 'Tumor Volume', 'unit' => 'cm3'],
                    ['type' => 'longest_diameter', 'name' => 'Longest Diameter', 'unit' => 'mm'],
                    ['type' => 'perpendicular_diameter', 'name' => 'Perpendicular Diameter', 'unit' => 'mm'],
                ],
            ];
        }

        // Default: solid tumor RECIST
        return [
            'template' => 'Solid Tumor (RECIST)',
            'fields' => [
                ['type' => 'longest_diameter', 'name' => 'Target Lesion 1', 'unit' => 'mm'],
                ['type' => 'tumor_volume', 'name' => 'Tumor Volume', 'unit' => 'cm3'],
                ['type' => 'lesion_count', 'name' => 'Lesion Count', 'unit' => 'count'],
            ],
        ];
    }

    /**
     * Build study context from DICOM metadata.
     *
     * @return array{modality: string|null, body_part: string|null, description: string|null, study_date: string|null, series_descriptions: string}
     */
    private function buildStudyContext(ImagingStudy $study): array
    {
        $seriesDescs = $study->series
            ->pluck('series_description')
            ->filter()
            ->unique()
            ->implode('; ');

        return [
            'modality' => $study->modality,
            'body_part' => $study->body_part_examined,
            'description' => $study->study_description,
            'study_date' => $study->study_date?->format('Y-m-d'),
            'series_descriptions' => $seriesDescs,
        ];
    }

    /**
     * Get radiology report text from OMOP NOTE table.
     */
    private function getRadiologyReport(ImagingStudy $study): ?string
    {
        if (! $study->person_id || ! $study->study_date) {
            return null;
        }

        try {
            $note = \DB::connection('omop')
                ->table('note')
                ->where('person_id', $study->person_id)
                ->where('note_type_concept_id', 44814637) // Radiology report
                ->whereDate('note_date', $study->study_date->format('Y-m-d'))
                ->value('note_text');

            return $note;
        } catch (\Throwable $e) {
            Log::warning('Failed to fetch radiology report', [
                'person_id' => $study->person_id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Call the AI service to extract structured measurements.
     *
     * @return list<array{measurement_type: string, measurement_name: string, value_as_number: float, unit: string, body_site: string|null, confidence: float|null}>
     */
    private function callAiExtraction(array $context, ?string $reportText): array
    {
        $prompt = $this->buildExtractionPrompt($context, $reportText);

        try {
            $response = Http::timeout(60)->post("{$this->aiBaseUrl}/api/imaging/extract-measurements", [
                'prompt' => $prompt,
                'context' => $context,
                'report_text' => $reportText,
            ]);

            if ($response->successful()) {
                $data = $response->json('measurements', []);

                return array_filter($data, function ($m) {
                    return isset($m['measurement_type'], $m['measurement_name'], $m['value_as_number'], $m['unit']);
                });
            }
        } catch (\Throwable $e) {
            Log::warning('AI measurement extraction failed', [
                'error' => $e->getMessage(),
            ]);
        }

        // Fallback: extract from description if it contains quantitative hints
        return $this->fallbackExtraction($context, $reportText);
    }

    /**
     * Build extraction prompt for the AI model.
     */
    private function buildExtractionPrompt(array $context, ?string $reportText): string
    {
        $parts = ['Extract quantitative imaging measurements from the following:'];
        $parts[] = "Modality: {$context['modality']}";
        $parts[] = "Body Part: {$context['body_part']}";
        $parts[] = "Study Description: {$context['description']}";

        if ($context['series_descriptions']) {
            $parts[] = "Series: {$context['series_descriptions']}";
        }

        if ($reportText) {
            $parts[] = "Radiology Report:\n{$reportText}";
        }

        $parts[] = "\nReturn JSON array of measurements with: measurement_type, measurement_name, value_as_number, unit, body_site, confidence";

        return implode("\n", $parts);
    }

    /**
     * Fallback extraction: parse COVID severity hints from study descriptions.
     *
     * @return list<array{measurement_type: string, measurement_name: string, value_as_number: float, unit: string, body_site: string|null, confidence: float|null}>
     */
    private function fallbackExtraction(array $context, ?string $reportText): array
    {
        // No fallback extraction without report text
        if (! $reportText) {
            return [];
        }

        $measurements = [];
        $text = strtolower($reportText);

        // Look for percentage patterns (e.g., "30% ground glass opacity")
        if (preg_match_all('/(\d+(?:\.\d+)?)\s*%\s*(ground.?glass|consolidation|opacity|involvement)/i', $reportText, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $value = (float) $match[1];
                $type = str_contains(strtolower($match[2]), 'ground') ? 'ground_glass_extent' : (str_contains(strtolower($match[2]), 'consolidation') ? 'consolidation_extent' : 'opacity_score');
                $measurements[] = [
                    'measurement_type' => $type,
                    'measurement_name' => ucfirst(strtolower($match[2])),
                    'value_as_number' => $value,
                    'unit' => '%',
                    'body_site' => 'CHEST',
                    'confidence' => 0.5,
                ];
            }
        }

        // Look for SUV patterns
        if (preg_match('/suv\s*(?:max)?\s*[:=]?\s*(\d+(?:\.\d+)?)/i', $reportText, $match)) {
            $measurements[] = [
                'measurement_type' => 'suvmax',
                'measurement_name' => 'SUVmax',
                'value_as_number' => (float) $match[1],
                'unit' => 'SUV',
                'body_site' => $context['body_part'],
                'confidence' => 0.6,
            ];
        }

        // Look for size/diameter patterns (e.g., "2.3 cm mass", "15 mm nodule")
        if (preg_match_all('/(\d+(?:\.\d+)?)\s*(cm|mm)\s*(mass|nodule|lesion|tumor|met)/i', $reportText, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $i => $match) {
                $value = (float) $match[1];
                if (strtolower($match[2]) === 'cm') {
                    $value *= 10; // convert to mm
                }
                $measurements[] = [
                    'measurement_type' => 'longest_diameter',
                    'measurement_name' => ucfirst(strtolower($match[3])).' '.($i + 1),
                    'value_as_number' => $value,
                    'unit' => 'mm',
                    'body_site' => $context['body_part'],
                    'confidence' => 0.5,
                ];
            }
        }

        return $measurements;
    }
}
