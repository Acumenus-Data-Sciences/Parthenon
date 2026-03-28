<?php

namespace App\Services\Imaging;

use App\Models\App\ImagingSeries;
use App\Models\App\ImagingStudy;
use App\Models\App\PacsConnection;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * DICOMweb Service — communicates with Orthanc (or any DICOMweb-compliant PACS)
 * via the QIDO-RS (Query) and WADO-RS (Retrieve) APIs.
 *
 * Standards:
 * - QIDO-RS: IHE RAD.66 / DICOMweb Part 3.18 §6.7.1 (WADO/STOW/QIDO)
 * - WADO-RS: Part 3.18 §6.5
 * - STOW-RS: Part 3.18 §6.6
 *
 * Orthanc DICOMweb plugin endpoint format:
 *   {base}/dicom-web/studies
 *   {base}/dicom-web/studies/{studyUID}/series
 */
class DicomwebService
{
    private string $baseUrl;

    private ?string $username;

    private ?string $password;

    public function __construct()
    {
        $this->baseUrl = $this->normalizeBaseUrl(config('services.dicomweb.base_url', 'http://localhost:8042'));
        $this->username = config('services.dicomweb.username');
        $this->password = config('services.dicomweb.password');
    }

    /**
     * Create a DicomwebService configured from a PacsConnection model.
     */
    public static function forConnection(PacsConnection $conn): self
    {
        $instance = new self;
        $instance->baseUrl = $instance->normalizeBaseUrl($conn->base_url);

        $creds = $conn->credentials ?? [];
        $instance->username = $creds['username'] ?? null;
        $instance->password = $creds['password'] ?? null;

        if (($conn->type ?? null) === 'orthanc') {
            $instance->username = env('ORTHANC_USER', $instance->username);
            $instance->password = env('ORTHANC_PASSWORD', $instance->password);
        }

        return $instance;
    }

    /**
     * Query studies from QIDO-RS endpoint and upsert into imaging_studies.
     *
     * @param  int  $sourceId  Parthenon source ID
     * @param  int  $limit  Max studies to import per call
     * @param  array<string, string>  $filters  QIDO-RS query params (e.g. ['Modality' => 'CT'])
     * @return array{indexed: int, updated: int, errors: int}
     */
    public function indexStudies(int $sourceId, int $limit = 100, array $filters = []): array
    {
        $params = array_merge($filters, ['limit' => $limit]);

        try {
            $response = $this->request('GET', '/dicom-web/studies', $params);
            if (! $response->successful()) {
                Log::warning('DicomwebService: QIDO-RS studies query failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return ['indexed' => 0, 'updated' => 0, 'errors' => 1];
            }

            $studies = $response->json() ?? [];
        } catch (\Throwable $e) {
            Log::warning('DicomwebService: HTTP request failed', ['error' => $e->getMessage()]);

            return ['indexed' => 0, 'updated' => 0, 'errors' => 1];
        }

        $indexed = 0;
        $updated = 0;
        $errors = 0;

        ['indexed' => $indexed, 'updated' => $updated, 'errors' => $errors] =
            $this->upsertStudies($studies, $sourceId);

        return ['indexed' => $indexed, 'updated' => $updated, 'errors' => $errors];
    }

    /**
     * Walk the full QIDO study catalog in batches using limit+offset and upsert
     * each page into Parthenon's imaging index. This is non-destructive:
     * existing rows are updated in place and no rows are deleted.
     *
     * @param  array<string, string>  $filters
     * @return array{indexed: int, updated: int, errors: int, scanned: int, batches: int}
     */
    public function syncStudies(int $sourceId, int $batchSize = 100, array $filters = [], ?int $maxStudies = null): array
    {
        $indexed = 0;
        $updated = 0;
        $errors = 0;
        $scanned = 0;
        $batches = 0;
        $offset = 0;

        do {
            $limit = $maxStudies === null
                ? $batchSize
                : min($batchSize, max(0, $maxStudies - $scanned));

            if ($limit <= 0) {
                break;
            }

            $studies = null;
            $lastError = null;

            for ($attempt = 1; $attempt <= 3; $attempt++) {
                try {
                    $response = $this->request('GET', '/dicom-web/studies', array_merge($filters, [
                        'limit' => $limit,
                        'offset' => $offset,
                    ]));

                    if ($response->successful()) {
                        $studies = $response->json() ?? [];
                        break;
                    }

                    $lastError = sprintf('HTTP %d', $response->status());
                    Log::warning('DicomwebService: paginated QIDO-RS studies query failed', [
                        'status' => $response->status(),
                        'body' => $response->body(),
                        'offset' => $offset,
                        'limit' => $limit,
                        'attempt' => $attempt,
                    ]);
                } catch (\Throwable $e) {
                    $lastError = $e->getMessage();
                    Log::warning('DicomwebService: paginated studies sync failed', [
                        'error' => $e->getMessage(),
                        'offset' => $offset,
                        'limit' => $limit,
                        'attempt' => $attempt,
                    ]);
                }

                usleep(250000 * $attempt);
            }

            if ($studies === null) {
                Log::warning('DicomwebService: exhausted paginated studies retries', [
                    'offset' => $offset,
                    'limit' => $limit,
                    'error' => $lastError,
                ]);
                $errors++;

                return compact('indexed', 'updated', 'errors', 'scanned', 'batches');
            }

            $count = count($studies);
            if ($count === 0) {
                break;
            }

            $batchCounts = $this->upsertStudies($studies, $sourceId);
            $indexed += $batchCounts['indexed'];
            $updated += $batchCounts['updated'];
            $errors += $batchCounts['errors'];
            $scanned += $count;
            $batches++;
            $offset += $count;

            if ($count < $limit) {
                break;
            }
        } while (true);

        return compact('indexed', 'updated', 'errors', 'scanned', 'batches');
    }

    /**
     * Index series for a specific study (QIDO-RS /studies/{uid}/series).
     *
     * @return array{indexed: int, errors: int}
     */
    public function indexSeriesForStudy(ImagingStudy $study): array
    {
        return $this->syncSeriesAndInstancesForStudy($study);
    }

    /**
     * Sync all series metadata and SOP instances for a study using WADO-RS
     * study metadata. This is non-destructive and uses upserts only.
     *
     * @return array{series_indexed: int, series_updated: int, instances_indexed: int, instances_updated: int, errors: int}
     */
    public function syncSeriesAndInstancesForStudy(ImagingStudy $study): array
    {
        $metadata = $this->getStudyMetadata($study->study_instance_uid);
        if (! is_array($metadata) || count($metadata) === 0) {
            return [
                'series_indexed' => 0,
                'series_updated' => 0,
                'instances_indexed' => 0,
                'instances_updated' => 0,
                'errors' => 1,
            ];
        }

        $seriesRows = [];
        $instanceRows = [];
        $seriesCounts = [];

        foreach ($metadata as $instance) {
            $seriesUid = $this->extractValue($instance, '0020000E');
            $sopUid = $this->extractValue($instance, '00080018');

            if (! $seriesUid || ! $sopUid) {
                continue;
            }

            $seriesCounts[$seriesUid] = ($seriesCounts[$seriesUid] ?? 0) + 1;

            if (! isset($seriesRows[$seriesUid])) {
                $seriesRows[$seriesUid] = [
                    'study_id' => $study->id,
                    'series_instance_uid' => $seriesUid,
                    'series_description' => $this->extractValue($instance, '0008103E'),
                    'modality' => $this->extractValue($instance, '00080060'),
                    'body_part_examined' => $this->extractValue($instance, '00180015'),
                    'series_number' => $this->extractInt($instance, '00200011'),
                    'num_images' => 0,
                    'slice_thickness_mm' => $this->extractFloat($instance, '00180050'),
                    'manufacturer' => $this->extractValue($instance, '00080070'),
                    'manufacturer_model' => $this->extractValue($instance, '00081090'),
                    'pixel_spacing' => $this->extractMultiValue($instance, '00280030'),
                    'rows_x_cols' => $this->formatRowsCols($instance),
                    'kvp' => $this->extractValue($instance, '00180060'),
                    'updated_at' => now(),
                    'created_at' => now(),
                ];
            }

            $instanceRows[$sopUid] = [
                'study_id' => $study->id,
                'series_instance_uid' => $seriesUid,
                'sop_instance_uid' => $sopUid,
                'sop_class_uid' => $this->extractValue($instance, '00080016'),
                'instance_number' => $this->extractInt($instance, '00200013'),
                'slice_location' => $this->extractFloat($instance, '00201041'),
                'updated_at' => now(),
                'created_at' => now(),
            ];
        }

        foreach ($seriesCounts as $seriesUid => $count) {
            if (isset($seriesRows[$seriesUid])) {
                $seriesRows[$seriesUid]['num_images'] = $count;
            }
        }

        $seriesUids = array_keys($seriesRows);
        $instanceUids = array_keys($instanceRows);

        $existingSeries = ImagingSeries::whereIn('series_instance_uid', $seriesUids)->pluck('id', 'series_instance_uid');
        $existingInstances = DB::table('imaging_instances')->whereIn('sop_instance_uid', $instanceUids)->pluck('id', 'sop_instance_uid');

        DB::table('imaging_series')->upsert(
            array_values($seriesRows),
            ['series_instance_uid'],
            [
                'study_id', 'series_description', 'modality', 'body_part_examined',
                'series_number', 'num_images', 'slice_thickness_mm', 'manufacturer',
                'manufacturer_model', 'pixel_spacing', 'rows_x_cols', 'kvp', 'updated_at',
            ]
        );

        $seriesIdMap = ImagingSeries::whereIn('series_instance_uid', $seriesUids)->pluck('id', 'series_instance_uid');

        $instanceUpserts = [];
        foreach ($instanceRows as $sopUid => $row) {
            $seriesId = $seriesIdMap[$row['series_instance_uid']] ?? null;
            if (! $seriesId) {
                continue;
            }
            unset($row['series_instance_uid']);
            $row['series_id'] = $seriesId;
            $instanceUpserts[] = $row;
        }

        foreach (array_chunk($instanceUpserts, 5000) as $chunk) {
            DB::table('imaging_instances')->upsert(
                $chunk,
                ['sop_instance_uid'],
                ['study_id', 'series_id', 'sop_class_uid', 'instance_number', 'slice_location', 'updated_at']
            );
        }

        $study->update([
            'num_series' => count($seriesRows),
            'num_images' => count($instanceRows),
        ]);

        return [
            'series_indexed' => count($seriesUids) - $existingSeries->count(),
            'series_updated' => $existingSeries->count(),
            'instances_indexed' => count($instanceUids) - $existingInstances->count(),
            'instances_updated' => $existingInstances->count(),
            'errors' => 0,
        ];
    }

    /**
     * Sync series + instances for every study under a source.
     *
     * @return array{studies: int, series_indexed: int, series_updated: int, instances_indexed: int, instances_updated: int, errors: int}
     */
    public function syncSeriesAndInstancesForSource(int $sourceId, int $chunkSize = 25): array
    {
        $totals = [
            'studies' => 0,
            'series_indexed' => 0,
            'series_updated' => 0,
            'instances_indexed' => 0,
            'instances_updated' => 0,
            'errors' => 0,
        ];

        ImagingStudy::where('source_id', $sourceId)
            ->orderBy('id')
            ->chunkById($chunkSize, function ($studies) use (&$totals) {
                foreach ($studies as $study) {
                    $result = $this->syncSeriesAndInstancesForStudy($study);
                    $totals['studies']++;
                    $totals['series_indexed'] += $result['series_indexed'];
                    $totals['series_updated'] += $result['series_updated'];
                    $totals['instances_indexed'] += $result['instances_indexed'];
                    $totals['instances_updated'] += $result['instances_updated'];
                    $totals['errors'] += $result['errors'];
                }
            });

        return $totals;
    }

    /**
     * Get study-level metadata from WADO-RS (retrieve metadata endpoint).
     *
     * Returns raw DICOMweb JSON+DICOM metadata array.
     *
     * @return array<string, mixed>|null
     */
    public function getStudyMetadata(string $studyInstanceUid): ?array
    {
        $uid = urlencode($studyInstanceUid);
        try {
            $response = $this->request('GET', "/dicom-web/studies/{$uid}/metadata", [], [
                'Accept' => 'application/dicom+json',
            ]);

            return $response->successful() ? $response->json() : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Build WADO-RS URI for retrieving a series (for OHIF viewer).
     */
    public function getWadorsUri(string $studyUid, string $seriesUid): string
    {
        return "{$this->baseUrl}/dicom-web/studies/{$studyUid}/series/{$seriesUid}";
    }

    /**
     * Push a DICOM file to Orthanc via its REST API (POST /instances).
     *
     * Uses Orthanc's native endpoint which is simpler and more reliable
     * than STOW-RS multipart for single-file uploads.
     *
     * @param  string  $filePath  Absolute path to DICOM file
     * @return bool True if stored successfully
     */
    public function stowInstance(string $filePath): bool
    {
        if (! file_exists($filePath)) {
            Log::warning('DicomwebService: STOW file not found', ['path' => $filePath]);

            return false;
        }

        try {
            $dicomData = file_get_contents($filePath);

            $response = $this->request('POST', '/instances', [], [
                'Content-Type' => 'application/dicom',
                'Accept' => 'application/json',
            ], $dicomData);

            if (! $response->successful()) {
                Log::warning('DicomwebService: STOW failed', [
                    'status' => $response->status(),
                    'file' => basename($filePath),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('DicomwebService: STOW error', [
                'error' => $e->getMessage(),
                'file' => basename($filePath),
            ]);

            return false;
        }
    }

    /**
     * Push multiple DICOM files to Orthanc via STOW-RS.
     *
     * @param  string[]  $filePaths  Absolute paths to DICOM files
     * @return array{stored: int, errors: int}
     */
    public function stowInstances(array $filePaths): array
    {
        $stored = 0;
        $errors = 0;

        foreach ($filePaths as $path) {
            if ($this->stowInstance($path)) {
                $stored++;
            } else {
                $errors++;
            }
        }

        return ['stored' => $stored, 'errors' => $errors];
    }

    /**
     * Parse QIDO-RS JSON+DICOM study attributes.
     * DICOM attribute keys are hex tags (0020000D = StudyInstanceUID).
     *
     * @param  array<string, mixed>  $study
     * @return array<string, mixed>
     */
    private function parseStudyAttributes(array $study): array
    {
        $get = fn (string $tag) => $study[$tag]['Value'][0] ?? null;

        $studyUid = $get('0020000D'); // StudyInstanceUID
        $modalities = $study['00080061']['Value'] ?? [$study['00080060']['Value'][0] ?? null];
        $modality = is_array($modalities) ? implode('/', $modalities) : $modalities;

        return [
            'study_instance_uid' => (string) $studyUid,
            'accession_number' => $get('00080050'),
            'modality' => $modality,
            'body_part_examined' => $get('00180015'),
            'study_description' => $get('00081030'),
            'referring_physician' => $this->formatPN($study['00080090']['Value'][0] ?? null),
            'study_date' => $this->parseDate($get('00080020')),
            'num_series' => (int) ($get('00201206') ?? 0),
            'num_images' => (int) ($get('00201208') ?? 0),
            'patient_id_dicom' => $get('00100020'),  // PatientID
            'patient_name_dicom' => $this->formatPN($study['00100010']['Value'][0] ?? null),  // PatientName
            'orthanc_study_id' => null,
            'wadors_uri' => null,
            'status' => 'indexed',
        ];
    }

    /**
     * @param  array<string, mixed>  $series
     * @return array<string, mixed>
     */
    private function parseSeriesAttributes(array $series, int $studyId): array
    {
        $get = fn (string $tag) => $series[$tag]['Value'][0] ?? null;

        return [
            'study_id' => $studyId,
            'series_instance_uid' => (string) $get('0020000E'),
            'series_description' => $get('0008103E'),
            'modality' => $get('00080060'),
            'body_part_examined' => $get('00180015'),
            'series_number' => $get('00200011') !== null ? (int) $get('00200011') : null,
            'num_images' => (int) ($get('00201209') ?? 0),
            'slice_thickness_mm' => $get('00180050') !== null ? (float) $get('00180050') : null,
            'manufacturer' => $get('00080070'),
            'manufacturer_model' => $get('00081090'),
        ];
    }

    /**
     * @param  array<string, mixed>  $dataset
     */
    private function extractValue(array $dataset, string $tag): ?string
    {
        $value = $dataset[$tag]['Value'][0] ?? null;
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            return $value['Alphabetic'] ?? null;
        }

        return (string) $value;
    }

    /**
     * @param  array<string, mixed>  $dataset
     */
    private function extractInt(array $dataset, string $tag): ?int
    {
        $value = $dataset[$tag]['Value'][0] ?? null;

        return $value === null ? null : (int) $value;
    }

    /**
     * @param  array<string, mixed>  $dataset
     */
    private function extractFloat(array $dataset, string $tag): ?float
    {
        $value = $dataset[$tag]['Value'][0] ?? null;

        return $value === null ? null : (float) $value;
    }

    /**
     * @param  array<string, mixed>  $dataset
     */
    private function extractMultiValue(array $dataset, string $tag): ?string
    {
        $values = $dataset[$tag]['Value'] ?? null;
        if (! is_array($values) || count($values) === 0) {
            return null;
        }

        return implode('\\', array_map(fn ($v) => (string) $v, $values));
    }

    /**
     * @param  array<string, mixed>  $dataset
     */
    private function formatRowsCols(array $dataset): ?string
    {
        $rows = $this->extractInt($dataset, '00280010');
        $cols = $this->extractInt($dataset, '00280011');

        return $rows && $cols ? "{$rows}x{$cols}" : null;
    }

    /**
     * Parse YYYYMMDD DICOM date to date string.
     */
    private function parseDate(?string $dicomDate): ?string
    {
        if (! $dicomDate || strlen($dicomDate) !== 8) {
            return null;
        }

        return substr($dicomDate, 0, 4).'-'.substr($dicomDate, 4, 2).'-'.substr($dicomDate, 6, 2);
    }

    /**
     * Format DICOM PersonName (PN) VR to readable string.
     *
     * @param  array<string,string>|null  $pn
     */
    private function formatPN(?array $pn): ?string
    {
        if (! $pn || ! isset($pn['Alphabetic'])) {
            return null;
        }

        return str_replace('^', ' ', $pn['Alphabetic']);
    }

    private function request(string $method, string $path, array $query = [], array $headers = [], ?string $body = null): Response
    {
        $defaultHeaders = ['Accept' => 'application/dicom+json'];
        $req = Http::withHeaders(array_merge($defaultHeaders, $headers));

        if ($this->username && $this->password) {
            $req = $req->withBasicAuth($this->username, $this->password);
        }

        $req = $req->timeout(60);

        if ($body !== null && strtoupper($method) === 'POST') {
            return $req->withBody($body, $headers['Content-Type'] ?? 'application/dicom')
                ->post($this->baseUrl.$path, $query);
        }

        return $req->{strtolower($method)}(
            $this->baseUrl.$path,
            $query
        );
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        return (string) preg_replace('#/dicom-web/?$#i', '', rtrim($baseUrl, '/'));
    }

    /**
     * @param  array<int, array<string, mixed>>  $studies
     * @return array{indexed: int, updated: int, errors: int}
     */
    private function upsertStudies(array $studies, int $sourceId): array
    {
        $indexed = 0;
        $updated = 0;
        $errors = 0;

        foreach ($studies as $study) {
            try {
                $attrs = $this->parseStudyAttributes($study);
                $attrs['source_id'] = $sourceId;

                $existing = ImagingStudy::where('study_instance_uid', $attrs['study_instance_uid'])->first();
                if ($existing) {
                    $existing->update($attrs);
                    $updated++;
                } else {
                    ImagingStudy::create($attrs);
                    $indexed++;
                }
            } catch (\Throwable $e) {
                $errors++;
                Log::warning('DicomwebService: study upsert failed', ['error' => $e->getMessage()]);
            }
        }

        return compact('indexed', 'updated', 'errors');
    }
}
