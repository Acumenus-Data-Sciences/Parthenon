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
        // Live upstream returns {apiVersion, kind, metadata, spec}; the legacy
        // controller-test mock returns {id, manifest: {...}}. Look in both.
        $singleton = (bool) (data_get($manifest, 'metadata.singleton')
            ?? data_get($manifest, 'manifest.singleton')
            ?? data_get($manifest, 'singleton')
            ?? false);
        $emitsCdm = (bool) (data_get($manifest, 'spec.meta.emits_cdm')
            ?? data_get($manifest, 'manifest.meta.emits_cdm')
            ?? data_get($manifest, 'meta.emits_cdm')
            ?? false);
        $requiresCdm = (bool) (data_get($manifest, 'spec.requires.cdm_initialized')
            ?? data_get($manifest, 'manifest.requires.cdm_initialized')
            ?? data_get($manifest, 'requires.cdm_initialized')
            ?? false);

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

            // Live upstream RunSubmitResponse uses `run_id`; older mocks/tests
            // use `prefect_run_id`. Accept either so the run is correctly linked.
            $prefectRunId = (string) ($response['prefect_run_id'] ?? $response['run_id'] ?? '');
            if ($prefectRunId === '') {
                throw new TemplateRegistryException('Template registry returned empty run_id/prefect_run_id', 502);
            }

            $run->update([
                'prefect_run_id' => $prefectRunId,
                'status' => TemplateRun::STATUS_QUEUED,
            ]);

            PollTemplateRunJob::dispatch($run->id, 0)->delay(now()->addSeconds(2));

            return $run->refresh();
        });
    }

    public function pollAndUpdate(TemplateRun $run): void
    {
        if ($run->isTerminal() || $run->prefect_run_id === null) {
            return;
        }

        $payload = $this->registry->getRun((string) $run->prefect_run_id);
        $newStatus = (string) ($payload['status'] ?? $run->status);
        $update = [
            'status' => $newStatus,
            'progress' => isset($payload['progress']) ? (float) $payload['progress'] : $run->progress,
            'current_node' => $payload['current_node'] ?? $run->current_node,
        ];

        if (isset($payload['started_at']) && $run->started_at === null) {
            $update['started_at'] = $payload['started_at'];
        }
        if (isset($payload['finished_at'])) {
            $update['finished_at'] = $payload['finished_at'];
        }
        if (isset($payload['post_conditions']) && is_array($payload['post_conditions'])) {
            $update['post_conditions'] = $payload['post_conditions'];
        }
        // Upstream emits `error_message`; older mocks/tests use `error`.
        $upstreamError = $payload['error_message'] ?? $payload['error'] ?? null;
        if ($upstreamError !== null) {
            $update['error_message'] = (string) $upstreamError;
        }

        DB::transaction(function () use ($run, $update, $newStatus): void {
            $run->update($update);
            if (in_array($newStatus, TemplateRun::TERMINAL_STATUSES, true)) {
                IngestionJob::query()
                    ->where('template_run_id', $run->id)
                    ->each(fn (IngestionJob $job) => $job->update(['status' => $newStatus]));
            }
        });
    }

    public function cancel(TemplateRun $run): void
    {
        if ($run->isTerminal()) {
            return;
        }

        // Phase 1: ask upstream to cancel. We tolerate a missing run (409/404)
        // because the run may have completed between the SPA fetching status
        // and the user clicking cancel — that's a benign race.
        if ($run->prefect_run_id !== null) {
            try {
                $this->registry->cancelRun((string) $run->prefect_run_id);
            } catch (TemplateRegistryException $e) {
                // Don't bubble — proceed to phase 2 and let upstream's
                // current status drive the local update.
            }
        }

        // Phase 2: reflect upstream's actual current status if available.
        // If upstream now reports `completed` or `failed`, do not blindly
        // overwrite to `cancelled` — the run finished before our cancel
        // arrived. If upstream is gone (no prefect_run_id, or unreachable),
        // fall back to optimistic-cancel.
        $finalStatus = TemplateRun::STATUS_CANCELLED;
        if ($run->prefect_run_id !== null) {
            try {
                $payload = $this->registry->getRun((string) $run->prefect_run_id);
                $upstreamStatus = (string) ($payload['status'] ?? '');
                if (in_array($upstreamStatus, TemplateRun::TERMINAL_STATUSES, true)) {
                    $finalStatus = $upstreamStatus;
                }
            } catch (TemplateRegistryException $e) {
                // Upstream unreachable — keep optimistic cancellation.
            }
        }

        $run->update([
            'status' => $finalStatus,
            'finished_at' => now(),
        ]);
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
