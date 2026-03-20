<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\PacsConnection;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;

#[Group('Administration', weight: 220)]
class SystemHealthController extends Controller
{
    /** @var array<string, callable(): array<string, mixed>> */
    private array $checkers;

    public function __construct()
    {
        $this->checkers = [
            'backend' => fn () => $this->checkBackend(),
            'redis' => fn () => $this->checkRedis(),
            'ai' => fn () => $this->checkAiService(),
            'r' => fn () => $this->checkRRuntime(),
            'solr' => fn () => $this->checkSolr(),
            'orthanc' => fn () => $this->checkOrthanc(),
            'queue' => fn () => $this->checkQueue(),
            'chromadb' => fn () => $this->checkChromaDb(),
            'study-agent' => fn () => $this->checkStudyAgent(),
            'grafana' => fn () => $this->checkGrafana(),
        ];
    }

    public function index(): JsonResponse
    {
        $services = [];
        foreach ($this->checkers as $checker) {
            $services[] = $checker();
        }

        return response()->json([
            'services' => $services,
            'checked_at' => now()->toIso8601String(),
        ]);
    }

    public function show(string $key): JsonResponse
    {
        if (! isset($this->checkers[$key])) {
            return response()->json(['message' => 'Unknown service.'], 404);
        }

        $status = ($this->checkers[$key])();
        $logs = $this->getLogsForService($key);
        $metrics = $this->getMetricsForService($key);

        return response()->json([
            'service' => $status,
            'logs' => $logs,
            'metrics' => $metrics,
            'checked_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * @return list<array{timestamp: string, level: string, message: string}>
     */
    private function getLogsForService(string $key): array
    {
        return match ($key) {
            'backend' => $this->getLaravelLogs(),
            'redis' => $this->getRedisLogs(),
            'ai' => $this->getServiceHttpLogs('ai'),
            'r' => $this->getServiceHttpLogs('r'),
            'solr' => $this->getSolrLogs(),
            'orthanc' => $this->getServiceHttpLogs('orthanc'),
            'queue' => $this->getQueueLogs(),
            'chromadb' => $this->getServiceHttpLogs('chromadb'),
            'study-agent' => [],
            'grafana' => [],
            default => [],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function getMetricsForService(string $key): array
    {
        return match ($key) {
            'backend' => $this->getBackendMetrics(),
            'redis' => $this->getRedisMetrics(),
            'ai' => $this->getAiMetrics(),
            'r' => $this->getRMetrics(),
            'solr' => $this->getSolrMetrics(),
            'orthanc' => $this->getOrthancMetrics(),
            'queue' => $this->getQueueMetrics(),
            'chromadb' => $this->getChromaDbMetrics(),
            'study-agent' => [],
            'grafana' => $this->getGrafanaMetrics(),
            default => [],
        };
    }

    private function checkBackend(): array
    {
        return [
            'name' => 'Backend API',
            'key' => 'backend',
            'status' => 'healthy',
            'message' => 'Laravel is responding normally.',
        ];
    }

    private function checkRedis(): array
    {
        try {
            Redis::ping();

            return [
                'name' => 'Redis',
                'key' => 'redis',
                'status' => 'healthy',
                'message' => 'Redis is reachable.',
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Redis',
                'key' => 'redis',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkAiService(): array
    {
        $url = rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://python-ai:8000')), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/health");

            if ($response->successful()) {
                return [
                    'name' => 'AI Service (Abby)',
                    'key' => 'ai',
                    'status' => 'healthy',
                    'message' => 'AI service is reachable.',
                ];
            }

            return [
                'name' => 'AI Service (Abby)',
                'key' => 'ai',
                'status' => 'degraded',
                'message' => "AI service returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'AI Service (Abby)',
                'key' => 'ai',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkRRuntime(): array
    {
        $url = rtrim(config('services.r_runtime.url', 'http://darkstar:8787'), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/health");

            if ($response->successful()) {
                return [
                    'name' => 'R Analytics Runtime',
                    'key' => 'r',
                    'status' => 'healthy',
                    'message' => 'R Plumber is reachable.',
                ];
            }

            return [
                'name' => 'R Analytics Runtime',
                'key' => 'r',
                'status' => 'degraded',
                'message' => "R Plumber returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'R Analytics Runtime',
                'key' => 'r',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkSolr(): array
    {
        if (! config('solr.enabled', false)) {
            return [
                'name' => 'Solr Search',
                'key' => 'solr',
                'status' => 'down',
                'message' => 'Solr is disabled (SOLR_ENABLED=false).',
            ];
        }

        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);

        try {
            $response = Http::timeout(3)->get("http://{$host}:{$port}/solr/admin/cores?action=STATUS&wt=json");

            if ($response->successful()) {
                $cores = $response->json('status') ?? [];
                $coreCount = count($cores);
                $totalDocs = 0;
                foreach ($cores as $core) {
                    $totalDocs += $core['index']['numDocs'] ?? 0;
                }

                return [
                    'name' => 'Solr Search',
                    'key' => 'solr',
                    'status' => 'healthy',
                    'message' => "{$coreCount} cores, {$totalDocs} documents indexed.",
                    'details' => ['cores' => $coreCount, 'documents' => $totalDocs],
                ];
            }

            return [
                'name' => 'Solr Search',
                'key' => 'solr',
                'status' => 'degraded',
                'message' => "Solr returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Solr Search',
                'key' => 'solr',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkQueue(): array
    {
        try {
            $pending = DB::table('jobs')->count();
            $failed = DB::table('failed_jobs')->count();

            $status = $failed > 0 ? 'degraded' : 'healthy';

            return [
                'name' => 'Job Queue',
                'key' => 'queue',
                'status' => $status,
                'message' => "Pending: {$pending}, Failed: {$failed}",
                'details' => ['pending' => $pending, 'failed' => $failed],
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Job Queue',
                'key' => 'queue',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkOrthanc(): array
    {
        $conn = PacsConnection::where('is_default', true)->first();

        if (! $conn) {
            return [
                'name' => 'Orthanc PACS',
                'key' => 'orthanc',
                'status' => 'down',
                'message' => 'No default PACS connection configured.',
            ];
        }

        $baseUrl = rtrim(str_replace('/dicom-web', '', $conn->base_url), '/');

        try {
            $response = Http::timeout(5)->get("{$baseUrl}/statistics");

            if ($response->successful()) {
                $stats = $response->json();
                $studies = $stats['CountStudies'] ?? 0;
                $instances = $stats['CountInstances'] ?? 0;
                $diskMb = round(($stats['TotalDiskSizeMB'] ?? 0), 1);

                return [
                    'name' => 'Orthanc PACS',
                    'key' => 'orthanc',
                    'status' => 'healthy',
                    'message' => "{$studies} studies, {$instances} instances, {$diskMb} MB on disk.",
                    'details' => [
                        'connection_name' => $conn->name,
                        'studies' => $studies,
                        'series' => $stats['CountSeries'] ?? 0,
                        'instances' => $instances,
                        'patients' => $stats['CountPatients'] ?? 0,
                        'disk_size_mb' => $diskMb,
                    ],
                ];
            }

            return [
                'name' => 'Orthanc PACS',
                'key' => 'orthanc',
                'status' => 'degraded',
                'message' => "Orthanc returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Orthanc PACS',
                'key' => 'orthanc',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkChromaDb(): array
    {
        $url = rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://python-ai:8000')), '/');

        try {
            $response = Http::timeout(5)->get("{$url}/chroma/health");

            if ($response->successful() && $response->json('status') === 'ok') {
                return [
                    'name' => 'ChromaDB',
                    'key' => 'chromadb',
                    'status' => 'healthy',
                    'message' => 'Vector database operational.',
                    'details' => [
                        'heartbeat' => $response->json('heartbeat'),
                    ],
                ];
            }

            return [
                'name' => 'ChromaDB',
                'key' => 'chromadb',
                'status' => 'degraded',
                'message' => 'ChromaDB responding but unhealthy.',
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'ChromaDB',
                'key' => 'chromadb',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkStudyAgent(): array
    {
        $url = rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://python-ai:8000')), '/');

        try {
            $response = Http::timeout(5)->get("{$url}/study-agent/health");

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'key' => 'study-agent',
                    'name' => 'Study Agent',
                    'status' => 'healthy',
                    'message' => 'OHDSI StudyAgent is running',
                    'details' => $data,
                ];
            }

            return [
                'key' => 'study-agent',
                'name' => 'Study Agent',
                'status' => 'degraded',
                'message' => 'StudyAgent returned HTTP '.$response->status(),
            ];
        } catch (\Throwable $e) {
            return [
                'key' => 'study-agent',
                'name' => 'Study Agent',
                'status' => 'down',
                'message' => 'StudyAgent unavailable: '.$e->getMessage(),
            ];
        }
    }

    private function checkGrafana(): array
    {
        $url = rtrim(config('services.grafana.url', 'http://grafana:3000'), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/api/health");

            if ($response->successful()) {
                $version = $response->json('version', 'unknown');

                return [
                    'name' => 'Grafana',
                    'key' => 'grafana',
                    'status' => 'healthy',
                    'message' => "Grafana {$version} is running.",
                ];
            }

            return [
                'name' => 'Grafana',
                'key' => 'grafana',
                'status' => 'degraded',
                'message' => "Grafana returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Grafana',
                'key' => 'grafana',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getGrafanaMetrics(): array
    {
        $url = rtrim(config('services.grafana.url', 'http://grafana:3000'), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/api/health");

            return $response->successful() ? ($response->json() ?? []) : [];
        } catch (\Throwable) {
            return [];
        }
    }

    // ── Log Retrieval ────────────────────────────────────────────────────

    /**
     * @return list<array{timestamp: string, level: string, message: string}>
     */
    private function getLaravelLogs(): array
    {
        $logFile = storage_path('logs/laravel.log');
        if (! file_exists($logFile)) {
            return [];
        }

        $lines = $this->tailFile($logFile, 200);
        $entries = [];
        $current = null;

        foreach ($lines as $line) {
            if (preg_match('/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\.\d]*[\+\-\d:Z]*)\]\s+\w+\.(\w+):\s*(.*)/', $line, $m)) {
                if ($current) {
                    $entries[] = $current;
                }
                $current = [
                    'timestamp' => $m[1],
                    'level' => strtolower($m[2]),
                    'message' => $m[3],
                ];
            } elseif ($current) {
                $current['message'] .= "\n".$line;
            }
        }
        if ($current) {
            $entries[] = $current;
        }

        // Trim long messages and return most recent 50
        $entries = array_slice($entries, -50);

        return array_map(function (array $entry): array {
            $entry['message'] = mb_substr($entry['message'], 0, 500);

            return $entry;
        }, array_values($entries));
    }

    /**
     * @return list<array{timestamp: string, level: string, message: string}>
     */
    private function getRedisLogs(): array
    {
        try {
            /** @var array<int, array{0: int, 1: string}> $slowlog */
            $slowlog = Redis::connection()->command('slowlog', ['get', '20']);
            $entries = [];
            foreach ($slowlog as $entry) {
                $entries[] = [
                    'timestamp' => date('Y-m-d H:i:s', (int) $entry[1]),
                    'level' => 'warning',
                    'message' => "Slow command ({$entry[2]}μs): ".implode(' ', (array) ($entry[3] ?? [])),
                ];
            }

            return $entries;
        } catch (\Throwable) {
            return [['timestamp' => now()->toDateTimeString(), 'level' => 'error', 'message' => 'Cannot retrieve Redis logs.']];
        }
    }

    /**
     * @return list<array{timestamp: string, level: string, message: string}>
     */
    private function getServiceHttpLogs(string $service): array
    {
        // Pull recent log entries from the Laravel log that mention this service
        $logFile = storage_path('logs/laravel.log');
        if (! file_exists($logFile)) {
            return [];
        }

        $keyword = match ($service) {
            'ai' => 'python-ai|AI Service|abby|ollama|MedGemma',
            'r' => 'darkstar|R Plumber|plumber|HADES',
            'orthanc' => 'orthanc|PACS|DICOMweb|dicom-web',
            'chromadb' => 'chroma|ChromaDB|vector',
            default => $service,
        };

        $lines = $this->tailFile($logFile, 500);
        $entries = [];

        foreach ($lines as $line) {
            if (preg_match('/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\.\d]*[\+\-\d:Z]*)\]\s+\w+\.(\w+):\s*(.*)/', $line, $m)) {
                if (preg_match("/{$keyword}/i", $m[3])) {
                    $entries[] = [
                        'timestamp' => $m[1],
                        'level' => strtolower($m[2]),
                        'message' => mb_substr($m[3], 0, 500),
                    ];
                }
            }
        }

        return array_slice($entries, -30);
    }

    /**
     * @return list<array{timestamp: string, level: string, message: string}>
     */
    private function getSolrLogs(): array
    {
        if (! config('solr.enabled', false)) {
            return [];
        }

        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);

        try {
            $response = Http::timeout(3)->get("http://{$host}:{$port}/solr/admin/info/logging?since=0&wt=json");
            if (! $response->successful()) {
                return [];
            }

            $docs = $response->json('history.docs') ?? [];
            $entries = [];
            foreach (array_slice($docs, -30) as $doc) {
                $entries[] = [
                    'timestamp' => $doc['time'] ?? now()->toDateTimeString(),
                    'level' => strtolower($doc['level'] ?? 'info'),
                    'message' => mb_substr($doc['message'] ?? '', 0, 500),
                ];
            }

            return $entries;
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return list<array{timestamp: string, level: string, message: string}>
     */
    private function getQueueLogs(): array
    {
        try {
            $failedJobs = DB::table('failed_jobs')
                ->orderByDesc('failed_at')
                ->limit(30)
                ->get(['uuid', 'queue', 'payload', 'exception', 'failed_at']);

            return $failedJobs->map(function (object $job): array {
                $payload = json_decode((string) $job->payload, true);
                $jobName = $payload['displayName'] ?? 'Unknown';

                return [
                    'timestamp' => (string) $job->failed_at,
                    'level' => 'error',
                    'message' => "[{$job->queue}] {$jobName}: ".mb_substr((string) $job->exception, 0, 300),
                ];
            })->all();
        } catch (\Throwable) {
            return [];
        }
    }

    // ── Metrics ──────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function getBackendMetrics(): array
    {
        return [
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'environment' => app()->environment(),
            'debug_mode' => config('app.debug'),
            'timezone' => config('app.timezone'),
            'cache_driver' => config('cache.default'),
            'queue_driver' => config('queue.default'),
            'uptime' => $this->getProcessUptime(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function getRedisMetrics(): array
    {
        try {
            /** @var array<string, mixed> $info */
            $info = Redis::connection()->command('info');

            return [
                'version' => $info['redis_version'] ?? 'unknown',
                'uptime_seconds' => (int) ($info['uptime_in_seconds'] ?? 0),
                'connected_clients' => (int) ($info['connected_clients'] ?? 0),
                'used_memory_human' => $info['used_memory_human'] ?? 'unknown',
                'used_memory_peak_human' => $info['used_memory_peak_human'] ?? 'unknown',
                'total_commands_processed' => (int) ($info['total_commands_processed'] ?? 0),
                'keyspace_hits' => (int) ($info['keyspace_hits'] ?? 0),
                'keyspace_misses' => (int) ($info['keyspace_misses'] ?? 0),
            ];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getAiMetrics(): array
    {
        $url = rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://python-ai:8000')), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/health");

            return $response->successful() ? ($response->json() ?? []) : [];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getRMetrics(): array
    {
        $url = rtrim(config('services.r_runtime.url', 'http://darkstar:8787'), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/health");

            return $response->successful() ? ($response->json() ?? []) : [];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getSolrMetrics(): array
    {
        if (! config('solr.enabled', false)) {
            return ['enabled' => false];
        }

        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);

        try {
            $response = Http::timeout(3)->get("http://{$host}:{$port}/solr/admin/cores?action=STATUS&wt=json");
            if (! $response->successful()) {
                return [];
            }

            $cores = $response->json('status') ?? [];
            $coreMetrics = [];
            foreach ($cores as $name => $core) {
                $coreMetrics[$name] = [
                    'num_docs' => $core['index']['numDocs'] ?? 0,
                    'max_doc' => $core['index']['maxDoc'] ?? 0,
                    'deleted_docs' => $core['index']['deletedDocs'] ?? 0,
                    'size' => $core['index']['size'] ?? 'unknown',
                    'uptime_ms' => $core['uptime'] ?? 0,
                ];
            }

            return [
                'enabled' => true,
                'host' => "{$host}:{$port}",
                'cores' => $coreMetrics,
            ];
        } catch (\Throwable) {
            return ['enabled' => true];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getOrthancMetrics(): array
    {
        $conn = PacsConnection::where('is_default', true)->first();

        if (! $conn) {
            return ['configured' => false];
        }

        $baseUrl = rtrim(str_replace('/dicom-web', '', $conn->base_url), '/');

        try {
            $response = Http::timeout(5)->get("{$baseUrl}/system");

            if ($response->successful()) {
                $sys = $response->json();

                return [
                    'configured' => true,
                    'connection_name' => $conn->name,
                    'base_url' => $conn->base_url,
                    'version' => $sys['Version'] ?? 'unknown',
                    'database_version' => $sys['DatabaseVersion'] ?? 'unknown',
                    'dicom_aet' => $sys['DicomAet'] ?? 'unknown',
                    'plugins_enabled' => $sys['PluginsEnabled'] ?? false,
                    'overwrite_instances' => $sys['OverwriteInstances'] ?? false,
                ];
            }

            return ['configured' => true, 'connection_name' => $conn->name];
        } catch (\Throwable) {
            return ['configured' => true, 'connection_name' => $conn->name];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getChromaDbMetrics(): array
    {
        $url = rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://python-ai:8000')), '/');

        try {
            $response = Http::timeout(5)->get("{$url}/chroma/health");

            return $response->successful() ? ($response->json() ?? []) : [];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getQueueMetrics(): array
    {
        try {
            $pending = DB::table('jobs')->count();
            $failed = DB::table('failed_jobs')->count();
            $recentCompleted = DB::table('jobs')
                ->where('created_at', '>=', now()->subHour())
                ->count();

            return [
                'pending' => $pending,
                'failed' => $failed,
                'recent_1h' => $recentCompleted,
                'driver' => config('queue.default'),
            ];
        } catch (\Throwable) {
            return [];
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /**
     * @return list<string>
     */
    private function tailFile(string $path, int $lines): array
    {
        if (! file_exists($path)) {
            return [];
        }

        $file = new \SplFileObject($path, 'r');
        $file->seek(PHP_INT_MAX);
        $totalLines = $file->key();

        $start = max(0, $totalLines - $lines);
        $file->seek($start);

        $result = [];
        while (! $file->eof()) {
            $line = rtrim($file->fgets());
            if ($line !== '') {
                $result[] = $line;
            }
        }

        return $result;
    }

    private function getProcessUptime(): string
    {
        $startTime = defined('LARAVEL_START') ? LARAVEL_START : $_SERVER['REQUEST_TIME_FLOAT'] ?? 0;
        if ($startTime === 0) {
            return 'unknown';
        }

        return 'Request served in '.round((microtime(true) - $startTime) * 1000).'ms';
    }
}
