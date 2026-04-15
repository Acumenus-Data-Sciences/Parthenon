<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\StudyDesignAsset;

class StudyAnalysisPlanVerifier
{
    public function verify(StudyDesignAsset $asset): StudyDesignAsset
    {
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
            $checks[] = $this->check((string) ($blocker['code'] ?? 'plan_blocker'), 'fail', (string) ($blocker['message'] ?? 'Blocked analysis plan prerequisite.'));
        }

        foreach ((array) ($payload['warnings'] ?? []) as $warning) {
            $checks[] = $this->check((string) ($warning['code'] ?? 'plan_warning'), 'warn', (string) ($warning['message'] ?? 'Review analysis plan prerequisite.'));
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
}
