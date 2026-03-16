<?php

namespace App\Services\StudyAgent;

use App\Models\App\FinnGenRun;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class FinnGenRunService
{
    /**
     * @param  array<string, mixed>  $requestPayload
     * @param  array<string, mixed>  $result
     */
    public function record(
        string $serviceName,
        Source $source,
        ?User $user,
        array $requestPayload,
        array $result,
    ): FinnGenRun {
        $artifacts = is_array($result['artifacts'] ?? null) ? $result['artifacts'] : [];

        return FinnGenRun::create([
            'service_name' => $serviceName,
            'status' => (string) ($result['status'] ?? 'ok'),
            'source_id' => $source->id,
            'submitted_by' => $user?->id,
            'source_snapshot' => [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'source_key' => $source->source_key,
                'source_dialect' => $source->source_dialect,
            ],
            'request_payload' => $requestPayload,
            'result_payload' => $result,
            'runtime_payload' => is_array($result['runtime'] ?? null) ? $result['runtime'] : [],
            'artifact_index' => $artifacts,
            'submitted_at' => Carbon::now(),
            'completed_at' => Carbon::now(),
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function recent(?string $serviceName = null, ?int $sourceId = null, int $limit = 12): Collection
    {
        $query = FinnGenRun::query()
            ->with(['source:id,source_name,source_key,source_dialect', 'submittedBy:id,name'])
            ->latest('id');

        if ($serviceName) {
            $query->where('service_name', $serviceName);
        }

        if ($sourceId) {
            $query->where('source_id', $sourceId);
        }

        return $query
            ->limit($limit)
            ->get()
            ->map(function (FinnGenRun $run): array {
                return [
                    'id' => $run->id,
                    'service_name' => $run->service_name,
                    'status' => $run->status,
                    'source' => $run->source_snapshot ?? [],
                    'submitted_by' => $run->submittedBy?->name,
                    'submitted_at' => $run->submitted_at?->toIso8601String(),
                    'completed_at' => $run->completed_at?->toIso8601String(),
                    'runtime' => $run->runtime_payload ?? [],
                    'artifacts' => $run->artifact_index ?? [],
                    'summary' => $this->summaryFor($run),
                ];
            });
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(int $runId): array
    {
        return $this->detailForModel($this->findModel($runId));
    }

    public function findModel(int $runId): FinnGenRun
    {
        $run = FinnGenRun::query()
            ->with(['source:id,source_name,source_key,source_dialect', 'submittedBy:id,name'])
            ->find($runId);

        if (! $run instanceof FinnGenRun) {
            throw (new ModelNotFoundException)->setModel(FinnGenRun::class, [$runId]);
        }

        return $run;
    }

    /**
     * @return array<string, mixed>
     */
    public function detailForModel(FinnGenRun $run): array
    {
        return [
            'id' => $run->id,
            'service_name' => $run->service_name,
            'status' => $run->status,
            'source' => $run->source_snapshot ?? [],
            'submitted_by' => $run->submittedBy?->name,
            'submitted_at' => $run->submitted_at?->toIso8601String(),
            'completed_at' => $run->completed_at?->toIso8601String(),
            'runtime' => $run->runtime_payload ?? [],
            'artifacts' => $run->artifact_index ?? [],
            'summary' => $this->summaryFor($run),
            'request_payload' => $run->request_payload ?? [],
            'result_payload' => $run->result_payload ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function exportBundle(int $runId): array
    {
        $run = $this->findModel($runId);

        return [
            'run' => $this->detailForModel($run),
            'exported_at' => Carbon::now()->toIso8601String(),
            'bundle_version' => 1,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function summaryFor(FinnGenRun $run): array
    {
        $result = $run->result_payload ?? [];

        return match ($run->service_name) {
            'finngen_cohort_operations' => [
                'criteria_count' => data_get($result, 'compile_summary.criteria_count'),
                'cohort_count' => data_get($result, 'compile_summary.cohort_count'),
            ],
            'finngen_co2_analysis' => [
                'module_key' => data_get($result, 'analysis_summary.module_key'),
                'outcome_name' => data_get($result, 'analysis_summary.outcome_name'),
            ],
            'finngen_hades_extras' => [
                'package_name' => data_get($result, 'render_summary.package_name'),
                'render_target' => data_get($result, 'render_summary.render_target'),
            ],
            'finngen_romopapi' => [
                'schema_scope' => data_get($result, 'metadata_summary.schema_scope'),
                'table_count_estimate' => data_get($result, 'metadata_summary.table_count_estimate'),
            ],
            default => [],
        };
    }
}
