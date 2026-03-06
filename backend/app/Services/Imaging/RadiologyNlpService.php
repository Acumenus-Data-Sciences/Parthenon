<?php

namespace App\Services\Imaging;

use App\Models\App\ImagingFeature;
use App\Models\App\ImagingStudy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Radiology Report NLP Service
 *
 * Parses unstructured radiology reports (stored as OMOP NOTE records)
 * via the Parthenon AI service (Abby/Ollama) and extracts structured findings
 * mapped to RadLex/SNOMED concepts, written as Image_feature records.
 *
 * Pipeline:
 * 1. Fetch NOTE records for person from omop.note (note_type_concept_id = radiology)
 * 2. Send report text to AI service for structured extraction
 * 3. Parse returned JSON findings
 * 4. Map findings to RadLex/SNOMED concepts via vocab lookup
 * 5. Write to imaging_features table + (optionally) omop.image_feature
 *
 * AI prompt returns structured JSON:
 * {
 *   "findings": [
 *     {"finding": "pulmonary nodule", "body_site": "right upper lobe",
 *      "severity": "4B", "measurement": "1.2 cm", "impression": "suspicious"},
 *     {"finding": "pleural effusion", "body_site": "left pleural space",
 *      "laterality": "left", "severity": "small"}
 *   ]
 * }
 */
class RadiologyNlpService
{
    private string $aiBaseUrl;

    public function __construct()
    {
        $this->aiBaseUrl = rtrim(config('services.ai.base_url', 'http://python-ai:8000'), '/');
    }

    /**
     * Extract structured imaging findings from all radiology notes for a person.
     *
     * @param  int  $personId  OMOP person_id
     * @param  ImagingStudy  $study  The study to associate findings with
     * @param  string  $connectionName  CDM DB connection
     * @param  string  $schema  OMOP schema
     * @return array{extracted: int, mapped: int, errors: int}
     */
    public function extractFromNotes(int $personId, ImagingStudy $study, string $connectionName = 'cdm', string $schema = 'omop'): array
    {
        $conn = DB::connection($connectionName);

        // Fetch radiology notes (note_type_concept_id = 44814637 = Radiology Report, or any LOINC 18748-4)
        try {
            $notes = $conn->select(
                "SELECT note_id, note_text, note_date
                 FROM {$schema}.note
                 WHERE person_id = ?
                 AND (note_type_concept_id IN (44814637, 44814638)
                      OR note_title ILIKE '%radiol%'
                      OR note_title ILIKE '%imaging%')
                 ORDER BY note_date DESC
                 LIMIT 10",
                [$personId]
            );
        } catch (\Throwable $e) {
            Log::warning('RadiologyNlpService: note fetch failed', ['error' => $e->getMessage()]);

            return ['extracted' => 0, 'mapped' => 0, 'errors' => 1];
        }

        if (empty($notes)) {
            return ['extracted' => 0, 'mapped' => 0, 'errors' => 0];
        }

        $extracted = 0;
        $mapped = 0;
        $errors = 0;

        foreach ($notes as $note) {
            $text = $note->note_text ?? '';
            if (strlen(trim($text)) < 20) {
                continue;
            }

            try {
                $findings = $this->callAiExtraction($text);
                foreach ($findings as $finding) {
                    $feature = $this->createFeature($study, $finding, $conn, $schema);
                    if ($feature) {
                        $extracted++;
                        if ($feature->value_concept_id) {
                            $mapped++;
                        }
                    }
                }
            } catch (\Throwable $e) {
                $errors++;
                Log::warning('RadiologyNlpService: extraction failed for note', [
                    'note_id' => $note->note_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return ['extracted' => $extracted, 'mapped' => $mapped, 'errors' => $errors];
    }

    /**
     * Call AI service for structured finding extraction.
     *
     * @return array<array<string, mixed>>
     */
    private function callAiExtraction(string $reportText): array
    {
        $prompt = <<<PROMPT
You are a radiology report parser. Extract all clinical findings from this radiology report.

Return ONLY valid JSON in this format:
{
  "findings": [
    {
      "finding": "finding name",
      "body_site": "anatomical location",
      "measurement_value": null or number,
      "measurement_unit": null or "cm/mm/mL",
      "severity_category": null or string,
      "impression": "benign/suspicious/malignant/indeterminate"
    }
  ]
}

Report:
{$reportText}
PROMPT;

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(30)
                ->post("{$this->aiBaseUrl}/generate", [
                    'prompt' => $prompt,
                    'max_tokens' => 1000,
                    'temperature' => 0.1,
                ]);

            if (! $response->successful()) {
                return [];
            }

            $body = $response->json();
            $text = $body['response'] ?? $body['text'] ?? '';

            // Extract JSON block from response
            if (preg_match('/\{[\s\S]*\}/m', $text, $matches)) {
                $parsed = json_decode($matches[0], true);

                return $parsed['findings'] ?? [];
            }
        } catch (\Throwable $e) {
            Log::warning('RadiologyNlpService: AI call failed', ['error' => $e->getMessage()]);
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $finding
     */
    private function createFeature(ImagingStudy $study, array $finding, \Illuminate\Database\Connection $conn, string $schema): ?ImagingFeature
    {
        $featureName = $finding['finding'] ?? null;
        if (! $featureName) {
            return null;
        }

        // Try to map finding to SNOMED concept
        $conceptId = null;
        try {
            $concept = $conn->selectOne(
                "SELECT concept_id FROM {$schema}.concept
                 WHERE concept_name ILIKE ? AND domain_id IN ('Observation','Measurement','Condition')
                 AND standard_concept = 'S' AND invalid_reason IS NULL
                 LIMIT 1",
                ['%'.$featureName.'%']
            );
            $conceptId = $concept ? (int) $concept->concept_id : null;
        } catch (\Throwable) {
            // vocab lookup failed
        }

        $valueNum = isset($finding['measurement_value']) && is_numeric($finding['measurement_value'])
            ? (float) $finding['measurement_value'] : null;

        return ImagingFeature::create([
            'study_id' => $study->id,
            'source_id' => $study->source_id,
            'person_id' => $study->person_id,
            'feature_type' => 'nlp_finding',
            'algorithm_name' => 'Abby/Ollama-NLP',
            'feature_name' => $featureName,
            'feature_source_value' => mb_substr($finding['impression'] ?? $featureName, 0, 300),
            'value_as_number' => $valueNum,
            'value_as_string' => $finding['severity_category'] ?? $finding['impression'] ?? null,
            'value_concept_id' => $conceptId,
            'unit_source_value' => $finding['measurement_unit'] ?? null,
            'body_site' => mb_substr($finding['body_site'] ?? '', 0, 100) ?: null,
            'confidence' => 0.75, // default for NLP extraction
        ]);
    }
}
