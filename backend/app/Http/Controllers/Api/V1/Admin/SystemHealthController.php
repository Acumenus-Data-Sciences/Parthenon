<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\PacsConnection;
use App\Models\App\SystemSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;

/**
 * @group Administration
 */
class SystemHealthController extends Controller
{
    /** @var array<string, callable(): array<string, mixed>> */
    private array $checkers;

    /** Service tier constants for logical grouping in the UI. */
    private const TIER_CORE = 'Core Platform';

    private const TIER_DATA = 'Data & Search';

    private const TIER_COMPUTE = 'AI & Analytics';

    private const TIER_CLINICAL = 'Clinical Services';

    private const TIER_OPS = 'Monitoring & Communications';

    private const TIER_ACROPOLIS = 'Acropolis Infrastructure';

    /** @var array<string, string> */
    private array $tiers;

    public function __construct()
    {
        // Ordered by dependency: platform → data → compute → domain → ancillary
        $this->checkers = [
            // Core Platform
            'backend' => fn () => $this->checkBackend(),
            'redis' => fn () => $this->checkRedis(),
            'queue' => fn () => $this->checkQueue(),
            // Data & Search
            'solr' => fn () => $this->checkSolr(),
            'hecate' => fn () => $this->checkHecate(),
            'chromadb' => fn () => $this->checkChromaDb(),
            // AI & Analytics
            'ai' => fn () => $this->checkAiService(),
            'darkstar' => fn () => $this->checkRRuntime(),
            'study-agent' => fn () => $this->checkStudyAgent(),
            'poseidon' => fn () => $this->checkPoseidon(),
            // Clinical Services
            'orthanc' => fn () => $this->checkOrthanc(),
            'blackrabbit' => fn () => $this->checkBlackRabbit(),
            // Monitoring & Communications
            'grafana' => fn () => $this->checkGrafana(),
            'livekit' => fn () => $this->checkLiveKit(),
            // Acropolis Infrastructure
            'authentik' => fn () => $this->checkAuthentik(),
            'wazuh' => fn () => $this->checkWazuh(),
            'n8n' => fn () => $this->checkN8n(),
            'superset' => fn () => $this->checkSuperset(),
            'datahub' => fn () => $this->checkDataHub(),
            'portainer' => fn () => $this->checkPortainer(),
            'pgadmin' => fn () => $this->checkPgAdmin(),
        ];

        $this->tiers = [
            'backend' => self::TIER_CORE,
            'redis' => self::TIER_CORE,
            'queue' => self::TIER_CORE,
            'solr' => self::TIER_DATA,
            'hecate' => self::TIER_DATA,
            'chromadb' => self::TIER_DATA,
            'ai' => self::TIER_COMPUTE,
            'darkstar' => self::TIER_COMPUTE,
            'study-agent' => self::TIER_COMPUTE,
            'poseidon' => self::TIER_COMPUTE,
            'orthanc' => self::TIER_CLINICAL,
            'blackrabbit' => self::TIER_CLINICAL,
            'grafana' => self::TIER_ACROPOLIS,
            'livekit' => self::TIER_OPS,
            'authentik' => self::TIER_ACROPOLIS,
            'wazuh' => self::TIER_ACROPOLIS,
            'n8n' => self::TIER_ACROPOLIS,
            'superset' => self::TIER_ACROPOLIS,
            'datahub' => self::TIER_ACROPOLIS,
            'portainer' => self::TIER_ACROPOLIS,
            'pgadmin' => self::TIER_ACROPOLIS,
        ];
    }

    public function index(): JsonResponse
    {
        $services = [];
        foreach ($this->checkers as $key => $checker) {
            $result = $checker();
            $result['tier'] = $this->tiers[$key] ?? self::TIER_OPS;
            $services[] = $result;
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
            'darkstar' => $this->getServiceHttpLogs('darkstar'),
            'solr' => $this->getSolrLogs(),
            'orthanc' => $this->getServiceHttpLogs('orthanc'),
            'queue' => $this->getQueueLogs(),
            'chromadb' => $this->getServiceHttpLogs('chromadb'),
            'study-agent' => [],
            'grafana' => [],
            'blackrabbit' => $this->getServiceHttpLogs('blackrabbit'),
            'livekit' => [],
            'poseidon' => $this->getServiceHttpLogs('poseidon'),
            'authentik', 'wazuh', 'n8n', 'superset', 'datahub', 'portainer', 'pgadmin' => [],
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
            'darkstar' => $this->getDarkstarMetrics(),
            'solr' => $this->getSolrMetrics(),
            'orthanc' => $this->getOrthancMetrics(),
            'queue' => $this->getQueueMetrics(),
            'chromadb' => $this->getChromaDbMetrics(),
            'study-agent' => [],
            'grafana' => $this->getGrafanaMetrics(),
            'blackrabbit' => $this->getBlackRabbitMetrics(),
            'livekit' => $this->getLiveKitMetrics(),
            'poseidon' => $this->getPoseidonMetrics(),
            'authentik', 'wazuh', 'n8n', 'superset', 'datahub', 'portainer', 'pgadmin' => [],
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

    private function checkHecate(): array
    {
        $url = rtrim(config('services.hecate.url', 'http://hecate:8080'), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/api/search", ['q' => 'test']);

            if ($response->successful()) {
                return [
                    'name' => 'Hecate (Semantic Vocab)',
                    'key' => 'hecate',
                    'status' => 'healthy',
                    'message' => 'Hecate vocabulary service is reachable.',
                ];
            }

            return [
                'name' => 'Hecate (Semantic Vocab)',
                'key' => 'hecate',
                'status' => 'degraded',
                'message' => "Hecate returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Hecate (Semantic Vocab)',
                'key' => 'hecate',
                'status' => 'down',
                'message' => 'Hecate service is not running. Semantic search unavailable.',
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
                $data = $response->json();
                $rVersion = $data['r_version'] ?? 'unknown';
                $hadesCount = count($data['packages']['ohdsi'] ?? []);

                return [
                    'name' => 'Darkstar',
                    'key' => 'darkstar',
                    'status' => 'healthy',
                    'message' => "R {$rVersion}, {$hadesCount} HADES packages loaded.",
                ];
            }

            return [
                'name' => 'Darkstar',
                'key' => 'darkstar',
                'status' => 'degraded',
                'message' => "Darkstar returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Darkstar',
                'key' => 'darkstar',
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
        $queues = ['default', 'ingestion', 'achilles', 'analysis', 'r-analysis', 'gis', 'genomics'];

        try {
            // Get actual pending jobs from Redis via Queue facade
            $pending = 0;
            foreach ($queues as $queue) {
                $pending += Queue::size($queue);
            }

            // Count recent failed jobs (last 24 hours) — not all-time accumulation
            $recentFailed = DB::table('failed_jobs')
                ->where('failed_at', '>=', now()->subDay())
                ->count();

            $totalFailed = DB::table('failed_jobs')->count();

            $status = $recentFailed > 0 ? 'degraded' : 'healthy';
            $failedLabel = $recentFailed > 0
                ? "{$recentFailed} in last 24h ({$totalFailed} total)"
                : ($totalFailed > 0 ? "0 recent ({$totalFailed} historic)" : '0');

            return [
                'name' => 'Job Queue',
                'key' => 'queue',
                'status' => $status,
                'message' => "Pending: {$pending}, Failed: {$failedLabel}",
                'details' => [
                    'pending' => $pending,
                    'failed' => $recentFailed,
                    'failed_total' => $totalFailed,
                ],
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

        try {
            $response = $this->orthancRequest($conn, '/statistics');

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

    private function checkAuthentik(): array
    {
        try {
            $response = Http::timeout(3)->get('http://host.docker.internal:9000/-/health/live/');

            return [
                'name' => 'Authentik (SSO)',
                'key' => 'authentik',
                'status' => $response->successful() ? 'healthy' : 'degraded',
                'message' => $response->successful() ? 'Identity provider is running.' : "Authentik returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return ['name' => 'Authentik (SSO)', 'key' => 'authentik', 'status' => 'down', 'message' => $e->getMessage()];
        }
    }

    private function checkWazuh(): array
    {
        try {
            $response = Http::withoutVerifying()->timeout(3)->get('https://host.docker.internal:5601/');

            return [
                'name' => 'Wazuh (SIEM)',
                'key' => 'wazuh',
                'status' => $response->status() < 500 ? 'healthy' : 'degraded',
                'message' => $response->status() < 500 ? 'Security monitoring dashboard is running.' : "Wazuh returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return ['name' => 'Wazuh (SIEM)', 'key' => 'wazuh', 'status' => 'down', 'message' => $e->getMessage()];
        }
    }

    private function checkN8n(): array
    {
        try {
            $response = Http::timeout(3)->get('http://host.docker.internal:5678/healthz');

            return [
                'name' => 'n8n (Workflows)',
                'key' => 'n8n',
                'status' => $response->successful() ? 'healthy' : 'degraded',
                'message' => $response->successful() ? 'Workflow automation is running.' : "n8n returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return ['name' => 'n8n (Workflows)', 'key' => 'n8n', 'status' => 'down', 'message' => $e->getMessage()];
        }
    }

    private function checkSuperset(): array
    {
        try {
            $response = Http::timeout(3)->get('http://host.docker.internal:8089/health');

            return [
                'name' => 'Superset (BI)',
                'key' => 'superset',
                'status' => $response->successful() ? 'healthy' : 'degraded',
                'message' => $response->successful() ? 'Analytics workspace is running.' : "Superset returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return ['name' => 'Superset (BI)', 'key' => 'superset', 'status' => 'down', 'message' => $e->getMessage()];
        }
    }

    private function checkDataHub(): array
    {
        try {
            $response = Http::timeout(3)->get('http://host.docker.internal:9002/health');

            return [
                'name' => 'DataHub (Catalog)',
                'key' => 'datahub',
                'status' => $response->successful() ? 'healthy' : 'degraded',
                'message' => $response->successful() ? 'Data catalog is running.' : "DataHub returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return ['name' => 'DataHub (Catalog)', 'key' => 'datahub', 'status' => 'down', 'message' => $e->getMessage()];
        }
    }

    private function checkPortainer(): array
    {
        try {
            $response = Http::withoutVerifying()->withoutRedirecting()->timeout(3)->get('https://host.docker.internal:9443/api/system/status');
            $reachable = $response->status() < 500;

            return [
                'name' => 'Portainer',
                'key' => 'portainer',
                'status' => $reachable ? 'healthy' : 'degraded',
                'message' => $reachable ? 'Container management is running.' : "Portainer returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return ['name' => 'Portainer', 'key' => 'portainer', 'status' => 'down', 'message' => $e->getMessage()];
        }
    }

    private function checkPgAdmin(): array
    {
        try {
            $response = Http::timeout(3)->get('http://host.docker.internal:5050/misc/ping');

            return [
                'name' => 'pgAdmin',
                'key' => 'pgadmin',
                'status' => $response->successful() ? 'healthy' : 'degraded',
                'message' => $response->successful() ? 'Database admin console is running.' : "pgAdmin returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return ['name' => 'pgAdmin', 'key' => 'pgadmin', 'status' => 'down', 'message' => $e->getMessage()];
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
            'darkstar' => 'darkstar|Darkstar|R Plumber|plumber|HADES',
            'orthanc' => 'orthanc|PACS|DICOMweb|dicom-web',
            'chromadb' => 'chroma|ChromaDB|vector',
            'blackrabbit' => 'blackrabbit|BlackRabbit|whiterabbit|WhiteRabbit|profiler|scan',
            'poseidon' => 'poseidon|Poseidon|dagster|Dagster|dbt',
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
    private function getDarkstarMetrics(): array
    {
        $url = rtrim(config('services.r_runtime.url', 'http://darkstar:8787'), '/');

        try {
            $response = Http::timeout(5)->get("{$url}/health");

            if (! $response->successful()) {
                return [];
            }

            $data = $response->json() ?? [];

            $metrics = [
                'service_version' => $data['version'] ?? 'unknown',
                'r_version' => $data['r_version'] ?? 'unknown',
                'uptime_seconds' => $data['uptime_seconds'] ?? null,
                'memory_used_mb' => $data['checks']['memory_used_mb'] ?? null,
                'jvm_healthy' => $data['checks']['jvm'] ?? false,
                'jdbc_driver' => $data['checks']['jdbc_driver'] ?? false,
            ];

            // Structure package versions into named groups
            if (isset($data['packages']['ohdsi'])) {
                $metrics['ohdsi_packages'] = $data['packages']['ohdsi'];
            }
            if (isset($data['packages']['posit'])) {
                $metrics['posit_packages'] = $data['packages']['posit'];
            }

            return $metrics;
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

        try {
            $response = $this->orthancRequest($conn, '/system');

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
        $queues = ['default', 'ingestion', 'achilles', 'analysis', 'r-analysis', 'gis', 'genomics'];

        try {
            $perQueue = [];
            $totalPending = 0;
            foreach ($queues as $queue) {
                $size = Queue::size($queue);
                $perQueue[$queue] = $size;
                $totalPending += $size;
            }

            $recentFailed = DB::table('failed_jobs')
                ->where('failed_at', '>=', now()->subDay())
                ->count();
            $totalFailed = DB::table('failed_jobs')->count();

            return [
                'pending' => $totalPending,
                'pending_per_queue' => $perQueue,
                'failed_recent_24h' => $recentFailed,
                'failed_total' => $totalFailed,
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

    private function orthancBaseUrl(PacsConnection $conn): string
    {
        return rtrim(str_replace('/dicom-web', '', $conn->base_url), '/');
    }

    /**
     * @return list<string>
     */
    private function orthancBaseUrls(PacsConnection $conn): array
    {
        $primary = $this->orthancBaseUrl($conn);
        $parts = parse_url($primary);

        if ($parts === false || ! isset($parts['host'])) {
            return [$primary];
        }

        $host = strtolower($parts['host']);
        $scheme = $parts['scheme'] ?? 'http';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = isset($parts['path']) ? rtrim($parts['path'], '/') : '';

        $candidates = [$primary];
        if (in_array($host, ['orthanc', 'parthenon-orthanc'], true)) {
            $candidates[] = "{$scheme}://127.0.0.1{$port}{$path}";
            $candidates[] = "{$scheme}://localhost{$port}{$path}";
        }

        return array_values(array_unique($candidates));
    }

    private function orthancRequest(PacsConnection $conn, string $endpoint): Response
    {
        $lastException = null;

        foreach ($this->orthancBaseUrls($conn) as $baseUrl) {
            try {
                return $this->orthancClient($conn)->get("{$baseUrl}{$endpoint}");
            } catch (ConnectionException $e) {
                $lastException = $e;
            }
        }

        if ($lastException instanceof ConnectionException) {
            throw $lastException;
        }

        throw new \RuntimeException('Orthanc request failed without a response.');
    }

    private function orthancClient(PacsConnection $conn): PendingRequest
    {
        $client = Http::timeout(5);
        $credentials = $conn->credentials ?? [];
        $username = $credentials['username'] ?? '';
        $password = $credentials['password'] ?? '';

        if (($conn->type ?? null) === 'orthanc') {
            $username = env('ORTHANC_USER', $username);
            $password = env('ORTHANC_PASSWORD', $password);
        }

        return match ($conn->auth_type) {
            'basic' => $client->withBasicAuth(
                $username,
                $password,
            ),
            'bearer' => $client->withToken($credentials['token'] ?? ''),
            default => $client,
        };
    }

    private function checkLiveKit(): array
    {
        $url = $this->resolveLiveKitUrl();

        if ($url === '') {
            return [
                'name' => 'LiveKit (Calls)',
                'key' => 'livekit',
                'status' => 'down',
                'message' => 'LiveKit is not configured.',
            ];
        }

        $httpUrl = preg_replace('#^wss?://#', 'https://', $url);

        try {
            $response = Http::timeout(3)->get($httpUrl);

            return [
                'name' => 'LiveKit (Calls)',
                'key' => 'livekit',
                'status' => 'healthy',
                'message' => 'LiveKit server is reachable.',
                'details' => [
                    'provider' => $this->resolveLiveKitProvider(),
                    'url' => $url,
                ],
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'LiveKit (Calls)',
                'key' => 'livekit',
                'status' => 'down',
                'message' => 'Cannot reach LiveKit: '.$e->getMessage(),
                'details' => [
                    'provider' => $this->resolveLiveKitProvider(),
                    'url' => $url,
                ],
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getLiveKitMetrics(): array
    {
        return [
            'provider' => $this->resolveLiveKitProvider(),
            'url' => $this->resolveLiveKitUrl(),
            'configured' => $this->resolveLiveKitUrl() !== '',
        ];
    }

    private function resolveLiveKitUrl(): string
    {
        $dbUrl = SystemSetting::getValue('livekit_url');

        return (string) ($dbUrl ?? config('services.livekit.url', ''));
    }

    private function resolveLiveKitProvider(): string
    {
        $provider = SystemSetting::getValue('livekit_provider');

        return (string) ($provider ?? 'cloud');
    }

    private function checkBlackRabbit(): array
    {
        $url = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

        try {
            $response = Http::timeout(5)->get("{$url}/health");

            if ($response->successful()) {
                $data = $response->json();
                $available = $data['dialects_available'] ?? 0;
                $total = $data['dialects_total'] ?? 12;

                return [
                    'name' => 'BlackRabbit',
                    'key' => 'blackrabbit',
                    'status' => 'healthy',
                    'message' => "Python {$data['python_version']}, {$available}/{$total} dialects available.",
                ];
            }

            return [
                'name' => 'BlackRabbit',
                'key' => 'blackrabbit',
                'status' => 'degraded',
                'message' => "BlackRabbit returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'BlackRabbit',
                'key' => 'blackrabbit',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkPoseidon(): array
    {
        $port = config('services.poseidon.port', env('POSEIDON_PORT', '3100'));
        $url = rtrim(config('services.poseidon.url', "http://poseidon-webserver:{$port}"), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/server_info");

            if ($response->successful()) {
                $data = $response->json();
                $version = $data['dagster_webserver_version'] ?? 'unknown';

                return [
                    'name' => 'Poseidon (Dagster)',
                    'key' => 'poseidon',
                    'status' => 'healthy',
                    'message' => "Dagster {$version} — dbt + Dagster orchestration.",
                    'details' => [
                        'dagster_version' => $version,
                        'graphql_version' => $data['dagster_graphql_version'] ?? 'unknown',
                    ],
                ];
            }

            return [
                'name' => 'Poseidon (Dagster)',
                'key' => 'poseidon',
                'status' => 'degraded',
                'message' => "Poseidon returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name' => 'Poseidon (Dagster)',
                'key' => 'poseidon',
                'status' => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getPoseidonMetrics(): array
    {
        $port = config('services.poseidon.port', env('POSEIDON_PORT', '3100'));
        $url = rtrim(config('services.poseidon.url', "http://poseidon-webserver:{$port}"), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/server_info");

            return $response->successful() ? ($response->json() ?? []) : [];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getBlackRabbitMetrics(): array
    {
        $url = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

        try {
            $healthResp = Http::timeout(5)->get("{$url}/health");
            $dialectsResp = Http::timeout(5)->get("{$url}/dialects");

            $metrics = $healthResp->successful() ? ($healthResp->json() ?? []) : [];

            if ($dialectsResp->successful()) {
                $dialects = $dialectsResp->json() ?? [];
                $metrics['dialects'] = [];
                foreach ($dialects as $d) {
                    $metrics['dialects'][$d['name']] = $d['installed'] ? ($d['version'] ?? 'installed') : 'not installed';
                }
            }

            return $metrics;
        } catch (\Throwable) {
            return [];
        }
    }
}
