<?php

declare(strict_types=1);

namespace App\Services\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TemplateRunService
{
    public function __construct(private readonly TemplateRegistryClient $registry) {}

    /**
     * @param  array<string,mixed>  $parameters
     */
    public function submit(string $templateId, string $version, array $parameters, User $user): TemplateRun
    {
        $manifest = $this->registry->getTemplate($templateId);
        $manifestBody = $this->extractManifestBody($manifest);
        $singleton = (bool) ($manifestBody['singleton'] ?? false);
        $emitsCdm = (bool) (data_get($manifestBody, 'meta.emits_cdm') ?? false);
        $requiresCdm = (bool) (data_get($manifestBody, 'requires.cdm_initialized') ?? false);

        return DB::transaction(function () use ($templateId, $version, $parameters, $user, $singleton, $emitsCdm, $requiresCdm): TemplateRun {
            if ($singleton) {
                $this->assertNoActiveRun($templateId, $version);
            }

            $correlationId = (string) Str::uuid();
            $run = TemplateRun::create([
                'template_id' => $templateId,
                'template_version' => $version,
                'parameters' => $parameters,
                'status' => TemplateRun::STATUS_PENDING,
                'submitted_by' => $user->id,
                'submitted_at' => now(),
                'correlation_id' => $correlationId,
            ]);

            if ($emitsCdm || $requiresCdm) {
                IngestionJob::create([
                    'kind' => 'template',
                    'template_run_id' => $run->id,
                    'status' => 'pending',
                    'created_by' => $user->id,
                ]);
            }

            $response = $this->registry->submitRun($templateId, $version, $parameters, $correlationId);

            $prefectRunId = (string) ($response['prefect_run_id'] ?? '');
            if ($prefectRunId === '') {
                throw new TemplateRegistryException('Template registry returned empty prefect_run_id', 502);
            }

            $run->update([
                'prefect_run_id' => $prefectRunId,
                'status' => TemplateRun::STATUS_QUEUED,
            ]);

            PollTemplateRunJob::dispatch($run->id)->delay(now()->addSeconds(2));

            return $run->refresh();
        });
    }

    private function assertNoActiveRun(string $templateId, string $version): void
    {
        TemplateRun::query()
            ->forTemplate($templateId, $version)
            ->nonTerminal()
            ->lockForUpdate()
            ->each(function (TemplateRun $existing): void {
                throw new \RuntimeException(sprintf(
                    'Singleton template already running (run_id=%d, status=%s)',
                    $existing->id,
                    $existing->status,
                ));
            });
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    private function extractManifestBody(array $payload): array
    {
        if (isset($payload['manifest']) && is_array($payload['manifest'])) {
            return $payload['manifest'];
        }

        return $payload;
    }
}
