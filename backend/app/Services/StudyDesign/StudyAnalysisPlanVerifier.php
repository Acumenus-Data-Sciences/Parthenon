<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\StudyDesignAsset;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class StudyAnalysisPlanVerifier
{
    public function verify(StudyDesignAsset $asset): StudyDesignAsset
    {
        $asset = $this->refreshRuntimePayload($asset);
        $result = $this->verificationResult($asset);

        $asset->update([
            'verification_status' => $result['status'],
            'verification_json' => $result,
            'verified_at' => now(),
        ]);

        return $asset->fresh() ?? $asset;
    }

    /**
     * @return array<string, mixed>
     */
    public function verificationResult(StudyDesignAsset $asset): array
    {
        $checks = [];
        $payload = $asset->draft_payload_json ?? [];

        if ($asset->asset_type !== 'analysis_plan') {
            return $this->result($asset, [
                $this->check('asset_type', 'fail', 'Blocked: this verifier only handles analysis plan assets.'),
            ]);
        }

        if (! is_string($payload['analysis_type'] ?? null) || ($payload['analysis_type'] ?? '') === '') {
            $checks[] = $this->check('analysis_type', 'fail', 'Blocked: analysis plan requires a native analysis type.');
        }

        if (! is_array($payload['design_json'] ?? null) || ($payload['design_json'] ?? []) === []) {
            $checks[] = $this->check('design_json', 'fail', 'Blocked: analysis plan requires a native design JSON payload.');
        }

        foreach ((array) ($payload['blockers'] ?? []) as $blocker) {
            $meta = is_array($blocker['meta'] ?? null) ? $blocker['meta'] : [];
            if (is_array($blocker['action'] ?? null)) {
                $meta['action'] = $blocker['action'];
            }

            $checks[] = $this->check((string) ($blocker['code'] ?? 'plan_blocker'), 'fail', (string) ($blocker['message'] ?? 'Blocked analysis plan prerequisite.'), $meta);
        }

        foreach ((array) ($payload['warnings'] ?? []) as $warning) {
            $meta = is_array($warning['meta'] ?? null) ? $warning['meta'] : [];
            if (is_array($warning['action'] ?? null)) {
                $meta['action'] = $warning['action'];
            }

            $checks[] = $this->check((string) ($warning['code'] ?? 'plan_warning'), 'warn', (string) ($warning['message'] ?? 'Review analysis plan prerequisite.'), $meta);
        }

        if (($payload['hades_capability']['installed'] ?? false) === true) {
            $checks[] = $this->check('hades_package', 'pass', 'Required Darkstar HADES package is installed.', [
                'package' => $payload['hades_package'] ?? null,
                'version' => $payload['hades_capability']['version'] ?? null,
            ]);
        } else {
            $checks[] = $this->check('hades_package', 'fail', 'Blocked: required Darkstar HADES package is not reported as installed.', [
                'package' => $payload['hades_package'] ?? null,
            ]);
        }

        if (($payload['feasibility']['status'] ?? null) === 'ready') {
            $checks[] = $this->check('feasibility', 'pass', 'Latest feasibility evidence is ready for analysis planning.');
        } elseif (($payload['feasibility']['status'] ?? null) === 'limited') {
            $checks[] = $this->check('feasibility', 'warn', 'Latest feasibility evidence is limited; review source-specific blockers before execution.');
        } else {
            $checks[] = $this->check('feasibility', 'fail', 'Blocked: run source feasibility and resolve blockers before materializing an analysis plan.');
        }

        return $this->result($asset, $checks);
    }

    /**
     * @param  list<array<string, mixed>>  $checks
     * @return array<string, mixed>
     */
    private function result(StudyDesignAsset $asset, array $checks): array
    {
        $statuses = collect($checks)->pluck('status');
        $status = match (true) {
            $statuses->contains('fail') => StudyDesignVerificationStatus::BLOCKED->value,
            $statuses->contains('warn') => StudyDesignVerificationStatus::PARTIAL->value,
            default => StudyDesignVerificationStatus::VERIFIED->value,
        };
        $canMaterialize = $status === StudyDesignVerificationStatus::VERIFIED->value;

        return [
            'status' => $status,
            'verified_at' => now()->toIso8601String(),
            'asset_type' => $asset->asset_type,
            'eligibility' => [
                'can_accept' => $canMaterialize,
                'can_materialize' => $canMaterialize,
                'reason' => $canMaterialize
                    ? 'Analysis plan can be accepted and materialized into a native HADES-compatible analysis.'
                    : 'Resolve blocking checks or review warnings before materializing this analysis plan.',
            ],
            'checks' => $checks,
            'blocking_reasons' => collect($checks)->where('status', 'fail')->pluck('message')->values()->all(),
            'warnings' => collect($checks)->where('status', 'warn')->pluck('message')->values()->all(),
            'source_summary' => [
                'source' => $asset->provenance_json['source'] ?? 'study_designer_analysis_plan',
            ],
            'canonical_summary' => null,
            'accepted_downstream_actions' => $canMaterialize ? ['materialize_native_analysis'] : ['defer', 'reject'],
            'acceptance_policy' => 'Only verified analysis plans may be accepted and materialized.',
        ];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function check(string $name, string $status, string $message, array $meta = []): array
    {
        return $meta === []
            ? ['name' => $name, 'status' => $status, 'message' => $message]
            : ['name' => $name, 'status' => $status, 'message' => $message, 'meta' => $meta];
    }

    private function refreshRuntimePayload(StudyDesignAsset $asset): StudyDesignAsset
    {
        if ($asset->asset_type !== 'analysis_plan') {
            return $asset;
        }

        $payload = $asset->draft_payload_json ?? [];
        $packageValue = data_get($payload, 'hades_package');
        $package = is_scalar($packageValue) ? trim((string) $packageValue) : '';
        if ($package !== '') {
            $payload['hades_capability'] = $this->packageCapability($package);
            $payload['hades_remediation'] = ($payload['hades_capability']['installed'] ?? false) === true
                ? null
                : $this->hadesRemediation($package);
        }

        $feasibility = $this->latestFeasibility($asset);
        $payload['feasibility'] = [
            'status' => $feasibility['status'] ?? null,
            'ready_source_count' => $feasibility['ready_source_count'] ?? 0,
            'source_count' => $feasibility['source_count'] ?? 0,
            'ran_at' => $feasibility['ran_at'] ?? null,
        ];

        $blockers = collect($payload['blockers'] ?? [])
            ->filter(fn (mixed $blocker): bool => ! is_array($blocker) || ! in_array($blocker['code'] ?? null, [
                'missing_feasibility',
                'blocked_feasibility',
                'missing_hades_package',
            ], true))
            ->values()
            ->all();
        $warnings = collect($payload['warnings'] ?? [])
            ->filter(fn (mixed $warning): bool => ! is_array($warning) || ($warning['code'] ?? null) !== 'limited_feasibility')
            ->values()
            ->all();

        if ($package !== '' && ($payload['hades_capability']['installed'] ?? false) !== true) {
            $blockers[] = $this->issue('missing_hades_package', "Darkstar does not report {$package} as installed.", ['package' => $package], [
                'type' => 'install_hades_package',
                'target_stage' => 'darkstar',
                'package' => $package,
                'label' => 'Install HADES package',
            ]);
        }

        if (($payload['feasibility']['status'] ?? null) === null) {
            $blockers[] = $this->issue('missing_feasibility', 'Run source feasibility before materializing this analysis plan.', [], [
                'type' => 'run_source_feasibility',
                'target_stage' => 'feasibility',
                'label' => 'Run source feasibility',
            ]);
        } elseif (($payload['feasibility']['status'] ?? null) === 'blocked') {
            $blockers[] = $this->issue('blocked_feasibility', 'Resolve source feasibility blockers before materializing this analysis plan.', [], [
                'type' => 'resolve_feasibility_blockers',
                'target_stage' => 'feasibility',
                'label' => 'Resolve feasibility blockers',
            ]);
        } elseif (($payload['feasibility']['status'] ?? null) === 'limited') {
            $warnings[] = $this->issue('limited_feasibility', 'Feasibility is limited; review source warnings before execution.', [], [
                'type' => 'review_feasibility_scope',
                'target_stage' => 'feasibility',
                'label' => 'Review feasibility scope',
            ]);
        }

        $payload['blockers'] = $blockers;
        $payload['warnings'] = $warnings;

        $asset->update(['draft_payload_json' => $payload]);

        return $asset->fresh() ?? $asset;
    }

    /**
     * @return array<string, mixed>
     */
    private function latestFeasibility(StudyDesignAsset $asset): array
    {
        $versionId = $asset->version_id;
        if ($versionId === null) {
            return [];
        }

        $feasibility = $asset->session
            ->assets()
            ->where('version_id', $versionId)
            ->where('asset_type', 'feasibility_result')
            ->orderByDesc('created_at')
            ->first();

        return is_array($feasibility?->draft_payload_json) ? $feasibility->draft_payload_json : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function packageCapability(string $package): array
    {
        $url = rtrim(config('services.darkstar.url', 'http://darkstar:8787'), '/');

        try {
            $payload = Http::timeout(8)->get("{$url}/hades/packages")->json();
            $packages = is_array($payload) ? ($payload['packages'] ?? []) : [];
            $row = collect($packages)
                ->first(fn (mixed $candidate): bool => is_array($candidate) && ($candidate['package'] ?? null) === $package);

            if (is_array($row)) {
                return [
                    'package' => $package,
                    'installed' => (bool) ($row['installed'] ?? false),
                    'version' => $row['version'] ?? null,
                    'surface' => $row['surface'] ?? null,
                    'priority' => $row['priority'] ?? null,
                    'status' => (bool) ($row['installed'] ?? false) ? 'installed' : 'not_installed',
                ];
            }
        } catch (\Throwable $exception) {
            Log::warning('Study analysis plan verifier could not retrieve Darkstar HADES capabilities', [
                'message' => $exception->getMessage(),
                'package' => $package,
            ]);
        }

        return ['package' => $package, 'installed' => false, 'status' => 'missing_from_inventory'];
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @return array<string, mixed>
     */
    private function hadesRemediation(string $package): array
    {
        return [
            'package' => $package,
            'message' => "Install or enable {$package} in Darkstar, refresh the HADES package inventory, then verify this plan again.",
            'action' => [
                'type' => 'install_hades_package',
                'target_stage' => 'darkstar',
                'package' => $package,
                'label' => 'Install HADES package',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function issue(string $code, string $message, array $meta = [], ?array $action = null): array
    {
        $issue = ['code' => $code, 'message' => $message, 'meta' => $meta];
        if ($action !== null) {
            $issue['action'] = $action;
        }

        return $issue;
    }
}
