<?php

namespace App\Services\Imaging;

use App\Models\App\PacsConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PacsConnectionService
{
    /**
     * Test connectivity to a PACS server.
     *
     * @return array<string, mixed>
     */
    public function testConnection(PacsConnection $conn): array
    {
        try {
            $start = microtime(true);

            $response = $this->resolveClient($conn)
                ->get(rtrim($conn->base_url, '/').'/studies?limit=1');

            $latencyMs = round((microtime(true) - $start) * 1000);

            $status = $response->successful() ? 'ok' : 'error';

            $conn->update([
                'last_health_check_at' => now(),
                'last_health_status' => $status,
            ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'PACS connection successful.',
                    'latency_ms' => $latencyMs,
                    'status_code' => $response->status(),
                ];
            }

            return [
                'success' => false,
                'message' => "PACS returned HTTP {$response->status()}.",
                'latency_ms' => $latencyMs,
                'status_code' => $response->status(),
            ];
        } catch (\Throwable $e) {
            $conn->update([
                'last_health_check_at' => now(),
                'last_health_status' => 'error',
            ]);

            Log::warning('PACS connection test failed', [
                'connection_id' => $conn->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Refresh statistics/metadata for a PACS connection.
     *
     * @return array<string, mixed>
     */
    public function refreshStats(PacsConnection $conn): array
    {
        try {
            if ($conn->type === 'orthanc') {
                return $this->refreshOrthancStats($conn);
            }

            return $this->refreshDicomwebStats($conn);
        } catch (\Throwable $e) {
            Log::warning('PACS stats refresh failed', [
                'connection_id' => $conn->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Browse studies via QIDO-RS.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function browseStudies(PacsConnection $conn, array $filters): array
    {
        try {
            $queryParams = [];

            if (! empty($filters['PatientName'])) {
                $queryParams['PatientName'] = $filters['PatientName'];
            }
            if (! empty($filters['PatientID'])) {
                $queryParams['PatientID'] = $filters['PatientID'];
            }
            if (! empty($filters['Modality'])) {
                $queryParams['ModalitiesInStudy'] = $filters['Modality'];
            }
            if (! empty($filters['StudyDate'])) {
                $queryParams['StudyDate'] = $filters['StudyDate'];
            }

            $queryParams['includefield'] = implode(',', [
                '00100010', '00100020', '00080020', '00080061',
                '00081030', '00201206', '00201208',
            ]);

            $requestedLimit = ! empty($filters['limit']) ? (int) $filters['limit'] : 25;
            // Fetch one extra to detect if more pages exist
            $queryParams['limit'] = $requestedLimit + 1;

            if (! empty($filters['offset'])) {
                $queryParams['offset'] = (int) $filters['offset'];
            }

            $response = $this->resolveClient($conn)
                ->get(rtrim($conn->base_url, '/').'/studies', $queryParams);

            if (! $response->successful()) {
                return [
                    'success' => false,
                    'message' => "QIDO-RS returned HTTP {$response->status()}.",
                    'studies' => [],
                ];
            }

            /** @var array<int, array<string, mixed>> $dicomJson */
            $dicomJson = $response->json() ?? [];

            $hasMore = count($dicomJson) > $requestedLimit;
            $dicomJson = array_slice($dicomJson, 0, $requestedLimit);

            $studies = array_map([$this, 'normalizeDicomStudy'], $dicomJson);

            // Use cached total from metadata_cache for display
            $cache = $conn->metadata_cache;
            $totalStudies = $cache['count_studies'] ?? null;

            return [
                'success' => true,
                'studies' => $studies,
                'count' => count($studies),
                'has_more' => $hasMore,
                'total_studies' => $totalStudies,
            ];
        } catch (\Throwable $e) {
            Log::warning('PACS study browse failed', [
                'connection_id' => $conn->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => $e->getMessage(),
                'studies' => [],
            ];
        }
    }

    /**
     * Build an HTTP client with appropriate auth for the connection.
     */
    public function resolveClient(PacsConnection $conn): PendingRequest
    {
        $client = Http::timeout(15)
            ->accept('application/dicom+json');

        $credentials = $conn->credentials ?? [];

        return match ($conn->auth_type) {
            'basic' => $client->withBasicAuth(
                $credentials['username'] ?? '',
                $credentials['password'] ?? '',
            ),
            'bearer' => $client->withToken($credentials['token'] ?? ''),
            default => $client,
        };
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Refresh stats for an Orthanc server via its /statistics endpoint.
     *
     * @return array<string, mixed>
     */
    private function refreshOrthancStats(PacsConnection $conn): array
    {
        $orthancBase = $this->orthancRestBase($conn);
        $client = $this->resolveOrthancRestClient($conn);

        $response = $client->get($orthancBase.'/statistics');

        if (! $response->successful()) {
            return [
                'success' => false,
                'message' => "Orthanc /statistics returned HTTP {$response->status()}.",
            ];
        }

        /** @var array<string, mixed> $stats */
        $stats = $response->json();

        $cache = [
            'count_patients' => $stats['CountPatients'] ?? null,
            'count_studies' => $stats['CountStudies'] ?? null,
            'count_series' => $stats['CountSeries'] ?? null,
            'count_instances' => $stats['CountInstances'] ?? null,
            'total_disk_size_mb' => $stats['TotalDiskSizeMB'] ?? null,
            'modalities' => $this->fetchModalityBreakdown($conn),
        ];

        $conn->update([
            'metadata_cache' => $cache,
            'metadata_cached_at' => now(),
        ]);

        return [
            'success' => true,
            'stats' => $cache,
        ];
    }

    /**
     * Fetch modality breakdown by paginating the /series endpoint.
     *
     * @return array<string, int>
     */
    private function fetchModalityBreakdown(PacsConnection $conn): array
    {
        $orthancBase = $this->orthancRestBase($conn);
        $client = $this->resolveOrthancRestClient($conn);
        $counts = [];
        $since = 0;
        $batch = 500;
        $maxSeries = 50000;

        while ($since < $maxSeries) {
            try {
                $response = $client->get($orthancBase.'/series', [
                    'since' => $since,
                    'limit' => $batch,
                    'expand' => true,
                ]);

                if (! $response->successful()) {
                    break;
                }

                /** @var list<array<string, mixed>> $series */
                $series = $response->json() ?? [];

                if (empty($series)) {
                    break;
                }

                foreach ($series as $s) {
                    $modality = $s['MainDicomTags']['Modality'] ?? 'Unknown';
                    $counts[$modality] = ($counts[$modality] ?? 0) + 1;
                }

                if (count($series) < $batch) {
                    break;
                }

                $since += $batch;
            } catch (\Throwable) {
                break;
            }
        }

        arsort($counts);

        return $counts;
    }

    /**
     * Get the Orthanc REST API base URL (strip /dicom-web suffix).
     */
    private function orthancRestBase(PacsConnection $conn): string
    {
        return (string) preg_replace('#/dicom-web/?$#i', '', rtrim($conn->base_url, '/'));
    }

    /**
     * Build an HTTP client with auth for Orthanc REST API calls (no DICOM Accept header).
     */
    private function resolveOrthancRestClient(PacsConnection $conn): PendingRequest
    {
        $client = Http::timeout(30);
        $credentials = $conn->credentials ?? [];

        return match ($conn->auth_type) {
            'basic' => $client->withBasicAuth(
                $credentials['username'] ?? '',
                $credentials['password'] ?? '',
            ),
            'bearer' => $client->withToken($credentials['token'] ?? ''),
            default => $client,
        };
    }

    /**
     * Refresh stats for a generic DICOMweb server via QIDO-RS count.
     *
     * @return array<string, mixed>
     */
    private function refreshDicomwebStats(PacsConnection $conn): array
    {
        $response = $this->resolveClient($conn)
            ->get(rtrim($conn->base_url, '/').'/studies', ['limit' => 0]);

        $countStudies = null;

        if ($response->successful()) {
            // Some servers return count in header
            $countStudies = $response->header('X-Total-Count');
            if ($countStudies === null) {
                // Fallback: count returned items
                $body = $response->json();
                $countStudies = is_array($body) ? count($body) : null;
            } else {
                $countStudies = (int) $countStudies;
            }
        }

        $cache = [
            'count_studies' => $countStudies,
        ];

        $conn->update([
            'metadata_cache' => $cache,
            'metadata_cached_at' => now(),
        ]);

        return [
            'success' => true,
            'stats' => $cache,
        ];
    }

    /**
     * Normalize a single DICOM JSON study object to a flat array.
     *
     * @param  array<string, mixed>  $study
     * @return array<string, mixed>
     */
    private function normalizeDicomStudy(array $study): array
    {
        return [
            'study_instance_uid' => $this->extractValue($study, '0020000D'),
            'patient_name' => $this->extractPersonName($study, '00100010'),
            'patient_id' => $this->extractValue($study, '00100020'),
            'study_date' => $this->extractValue($study, '00080020'),
            'modalities' => $this->extractValue($study, '00080061'),
            'study_description' => $this->extractValue($study, '00081030'),
            'num_series' => $this->extractValue($study, '00201206'),
            'num_instances' => $this->extractValue($study, '00201208'),
        ];
    }

    /**
     * Extract a simple value from DICOM JSON tag.
     *
     * @param  array<string, mixed>  $study
     */
    private function extractValue(array $study, string $tag): mixed
    {
        $element = $study[$tag] ?? null;
        if (! is_array($element)) {
            return null;
        }

        $values = $element['Value'] ?? null;
        if (! is_array($values) || empty($values)) {
            return null;
        }

        return $values[0];
    }

    /**
     * Extract a PersonName value from DICOM JSON (handles nested Alphabetic format).
     *
     * @param  array<string, mixed>  $study
     */
    private function extractPersonName(array $study, string $tag): ?string
    {
        $value = $this->extractValue($study, $tag);

        if (is_array($value) && isset($value['Alphabetic'])) {
            return $value['Alphabetic'];
        }

        if (is_string($value)) {
            return $value;
        }

        return null;
    }
}
