<?php

namespace App\Services\Imaging;

use App\Models\App\ImagingSeries;
use App\Models\App\ImagingStudy;
use App\Models\App\PacsConnection;
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
        $this->baseUrl = rtrim(config('services.dicomweb.base_url', 'http://localhost:8042'), '/');
        $this->username = config('services.dicomweb.username');
        $this->password = config('services.dicomweb.password');
    }

    /**
     * Create a DicomwebService configured from a PacsConnection model.
     */
    public static function forConnection(PacsConnection $conn): self
    {
        $instance = new self;
        $instance->baseUrl = rtrim($conn->base_url, '/');

        $creds = $conn->credentials ?? [];
        $instance->username = $creds['username'] ?? null;
        $instance->password = $creds['password'] ?? null;

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

        return ['indexed' => $indexed, 'updated' => $updated, 'errors' => $errors];
    }

    /**
     * Index series for a specific study (QIDO-RS /studies/{uid}/series).
     *
     * @return array{indexed: int, errors: int}
     */
    public function indexSeriesForStudy(ImagingStudy $study): array
    {
        $uid = urlencode($study->study_instance_uid);

        try {
            $response = $this->request('GET', "/dicom-web/studies/{$uid}/series");
            if (! $response->successful()) {
                return ['indexed' => 0, 'errors' => 1];
            }
            $seriesList = $response->json() ?? [];
        } catch (\Throwable $e) {
            Log::warning('DicomwebService: series query failed', ['error' => $e->getMessage()]);

            return ['indexed' => 0, 'errors' => 1];
        }

        $indexed = 0;
        $errors = 0;

        foreach ($seriesList as $series) {
            try {
                $attrs = $this->parseSeriesAttributes($series, $study->id);
                ImagingSeries::updateOrCreate(
                    ['series_instance_uid' => $attrs['series_instance_uid']],
                    $attrs
                );
                $indexed++;
            } catch (\Throwable $e) {
                $errors++;
            }
        }

        // Update series count on study
        $study->update(['num_series' => $study->series()->count()]);

        return ['indexed' => $indexed, 'errors' => $errors];
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

    private function request(string $method, string $path, array $query = [], array $headers = [], ?string $body = null): \Illuminate\Http\Client\Response
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
}
