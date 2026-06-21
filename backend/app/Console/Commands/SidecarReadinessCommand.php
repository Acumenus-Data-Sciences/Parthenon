<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Runtime readiness probe for the analysis/AI sidecars that routinely cause
 * skipped tests and silent degradation. Unlike a docker `healthcheck` (which
 * only proves the container is up) this asserts the app can actually reach each
 * sidecar at its configured URL, and returns a non-zero exit when a REQUIRED
 * sidecar is not ready — so a promotion gate / CI step can block on it.
 *
 * Health-path safety: only the two sidecars whose `/health` route is verified to
 * exist (darkstar, python-ai) are held to a 2xx contract. Everything else is
 * classified by reachability (any HTTP response = the process is up), which
 * avoids the "wrong health path" false-negative that scripts/checks/check_health_urls.py
 * exists to prevent.
 */
class SidecarReadinessCommand extends Command
{
    protected $signature = 'sidecars:readiness {--json : Emit machine-readable JSON} {--timeout=5 : Per-probe timeout in seconds}';

    protected $description = 'Probe configured analysis/AI sidecars and report runtime readiness for promotion gates and the operator runbook.';

    public function handle(): int
    {
        $timeout = max(1, (int) $this->option('timeout'));

        $results = [];
        foreach ($this->httpSidecars() as $sidecar) {
            $results[] = $this->probeHttp($sidecar, $timeout);
        }
        $results[] = $this->probeRedis();

        $requiredDown = array_values(array_filter(
            $results,
            static fn (array $r): bool => $r['required'] && $r['status'] !== 'ready',
        ));

        if ($this->option('json')) {
            $this->line((string) json_encode([
                'ready' => $requiredDown === [],
                'sidecars' => $results,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->renderTable($results);
            if ($requiredDown !== []) {
                $names = implode(', ', array_map(static fn (array $r): string => $r['name'], $requiredDown));
                $this->error("Required sidecar(s) not ready: {$names}");
            } else {
                $this->info('All required sidecars ready.');
            }
        }

        return $requiredDown === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return list<array{name: string, url: string, path: string, required: bool, expect: string}>
     */
    private function httpSidecars(): array
    {
        return [
            ['name' => 'darkstar (R/HADES)', 'url' => (string) config('services.darkstar.url'), 'path' => '/health', 'required' => true, 'expect' => '2xx'],
            ['name' => 'python-ai', 'url' => (string) config('services.ai.url'), 'path' => '/health', 'required' => true, 'expect' => '2xx'],
            ['name' => 'hecate', 'url' => (string) config('services.hecate.url'), 'path' => '/health', 'required' => false, 'expect' => 'reachable'],
            ['name' => 'fhir-to-cdm', 'url' => (string) config('services.fhir_to_cdm.url'), 'path' => '/health', 'required' => false, 'expect' => 'reachable'],
            ['name' => 'orthanc (PACS)', 'url' => (string) config('services.dicomweb.base_url'), 'path' => '/system', 'required' => false, 'expect' => 'reachable'],
            ['name' => 'templates', 'url' => (string) config('services.templates.url'), 'path' => '/health', 'required' => false, 'expect' => 'reachable'],
            ['name' => 'scispacy', 'url' => (string) config('services.scispacy.url'), 'path' => '/health', 'required' => false, 'expect' => 'reachable'],
            ['name' => 'anonymizer', 'url' => (string) config('services.anonymizer.url'), 'path' => '/health', 'required' => false, 'expect' => 'reachable'],
        ];
    }

    /**
     * @param  array{name: string, url: string, path: string, required: bool, expect: string}  $sidecar
     * @return array{name: string, status: string, detail: string, required: bool}
     */
    private function probeHttp(array $sidecar, int $timeout): array
    {
        if ($sidecar['url'] === '') {
            return ['name' => $sidecar['name'], 'status' => 'unconfigured', 'detail' => 'no URL configured', 'required' => $sidecar['required']];
        }

        $endpoint = rtrim($sidecar['url'], '/').$sidecar['path'];

        try {
            $response = Http::timeout($timeout)->get($endpoint);
            $code = $response->status();

            if ($sidecar['expect'] === '2xx') {
                return [
                    'name' => $sidecar['name'],
                    'status' => $response->successful() ? 'ready' : 'degraded',
                    'detail' => "HTTP {$code} at {$sidecar['path']}",
                    'required' => $sidecar['required'],
                ];
            }

            // 'reachable': any HTTP response means the process is serving.
            return ['name' => $sidecar['name'], 'status' => 'ready', 'detail' => "reachable (HTTP {$code})", 'required' => $sidecar['required']];
        } catch (Throwable $e) {
            return ['name' => $sidecar['name'], 'status' => 'unreachable', 'detail' => $this->shortError($e), 'required' => $sidecar['required']];
        }
    }

    /**
     * @return array{name: string, status: string, detail: string, required: bool}
     */
    private function probeRedis(): array
    {
        try {
            Redis::connection()->ping();

            return ['name' => 'redis', 'status' => 'ready', 'detail' => 'PING ok', 'required' => true];
        } catch (Throwable $e) {
            return ['name' => 'redis', 'status' => 'unreachable', 'detail' => $this->shortError($e), 'required' => true];
        }
    }

    private function shortError(Throwable $e): string
    {
        $message = $e->getMessage();

        return strlen($message) > 80 ? substr($message, 0, 77).'...' : $message;
    }

    /**
     * @param  list<array{name: string, status: string, detail: string, required: bool}>  $results
     */
    private function renderTable(array $results): void
    {
        $rows = array_map(static fn (array $r): array => [
            $r['name'],
            $r['required'] ? 'required' : 'optional',
            strtoupper($r['status']),
            $r['detail'],
        ], $results);

        $this->table(['Sidecar', 'Tier', 'Status', 'Detail'], $rows);
    }
}
