<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity\Scorers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class TemporalScorer implements DimensionScorerInterface
{
    /** @var array<string, mixed>|null */
    private ?array $lastTemporalDetails = null;

    public function key(): string
    {
        return 'temporal';
    }

    /**
     * Score temporal trajectory similarity via DTW (calls Python AI service).
     *
     * Requires person_id and source_id in both patient arrays.
     * Returns -1.0 if the AI service is unavailable or data is insufficient.
     *
     * @param  array<string, mixed>  $patientA  Feature vector data (must include person_id, source_id)
     * @param  array<string, mixed>  $patientB  Feature vector data (must include person_id)
     */
    public function score(array $patientA, array $patientB): float
    {
        $personAId = $patientA['person_id'] ?? null;
        $personBId = $patientB['person_id'] ?? null;
        $sourceId = $patientA['source_id'] ?? $patientB['source_id'] ?? null;

        if ($personAId === null || $personBId === null || $sourceId === null) {
            $this->lastTemporalDetails = null;

            return -1.0;
        }

        try {
            $response = Http::timeout(30)->post('http://python-ai:8000/patient-similarity/temporal-similarity', [
                'source_id' => (int) $sourceId,
                'person_a_id' => (int) $personAId,
                'person_b_id' => (int) $personBId,
            ]);

            if (! $response->successful()) {
                Log::warning('TemporalScorer: AI service returned non-200', [
                    'status' => $response->status(),
                    'person_a' => $personAId,
                    'person_b' => $personBId,
                ]);
                $this->lastTemporalDetails = null;

                return -1.0;
            }

            /** @var array<string, mixed> $data */
            $data = $response->json();
            $this->lastTemporalDetails = $data;

            return (float) ($data['overall_similarity'] ?? 0.0);
        } catch (\Throwable $e) {
            Log::warning('TemporalScorer: AI service unavailable', [
                'error' => $e->getMessage(),
                'person_a' => $personAId,
                'person_b' => $personBId,
            ]);
            $this->lastTemporalDetails = null;

            return -1.0;
        }
    }

    /**
     * Get the detailed per-measurement temporal comparison from the last score() call.
     *
     * @return array<string, mixed>|null
     */
    public function getLastTemporalDetails(): ?array
    {
        return $this->lastTemporalDetails;
    }
}
