<?php

namespace App\Services\StudyAgent;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

class FinnGenExternalAdapterService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{mode:string,command:?string,base_url:?string}
     */
    public function configuration(string $service): array
    {
        $prefix = $this->prefix($service);

        return [
            'mode' => $this->resolveMode($service),
            'command' => $prefix ? env($prefix.'_COMMAND') : null,
            'base_url' => $prefix ? (env($prefix.'_BASE_URL') ?: env($prefix.'_URL')) : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    public function execute(string $service, array $payload): ?array
    {
        $config = $this->configuration($service);

        if ($config['mode'] === 'external_command' && filled($config['command'])) {
            return $this->executeCommand($config['command'], $payload);
        }

        if ($config['mode'] === 'external_service' && filled($config['base_url'])) {
            return $this->executeService($config['base_url'], $payload);
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function executeCommand(string $command, array $payload): array
    {
        $process = Process::fromShellCommandline($command);
        $process->setTimeout(120);
        $process->setInput(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException(trim($process->getErrorOutput()) ?: 'External FINNGEN command failed.');
        }

        $output = trim($process->getOutput());
        if ($output === '') {
            return [];
        }

        $decoded = json_decode($output, true);
        if (! is_array($decoded)) {
            throw new \RuntimeException('External FINNGEN command returned invalid JSON.');
        }

        return $decoded;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function executeService(string $baseUrl, array $payload): array
    {
        $response = Http::timeout(120)
            ->acceptJson()
            ->asJson()
            ->post(rtrim($baseUrl, '/'), $payload);

        if ($response->failed()) {
            throw new \RuntimeException('External FINNGEN service returned HTTP '.$response->status().'.');
        }

        $decoded = $response->json();
        if (! is_array($decoded)) {
            throw new \RuntimeException('External FINNGEN service returned invalid JSON.');
        }

        return is_array($decoded['data'] ?? null) ? $decoded['data'] : $decoded;
    }

    private function resolveMode(string $service): string
    {
        $config = $this->prefix($service);

        if (! $config) {
            return 'parthenon_native';
        }

        if (filled(env($config.'_COMMAND'))) {
            return 'external_command';
        }

        if (filled(env($config.'_BASE_URL')) || filled(env($config.'_URL'))) {
            return 'external_service';
        }

        return 'parthenon_native';
    }

    private function prefix(string $service): ?string
    {
        return match ($service) {
            'cohort_operations' => 'FINNGEN_COHORT_OPERATIONS',
            'co2_analysis' => 'FINNGEN_CO2_ANALYSIS',
            'hades_extras' => 'FINNGEN_HADES_EXTRAS',
            'romopapi' => 'FINNGEN_ROMOPAPI',
            default => null,
        };
    }
}
