<?php

namespace App\Services\Achilles\Heel;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesHeelResult;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AchillesHeelService
{
    public function __construct(
        private AchillesHeelRuleRegistry $registry,
        private SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Run all Achilles Heel rules against the given source and persist results.
     *
     * @return array{completed: int, failed: int, results: list<array{rule_id: int, status: string, violations: int, error?: string}>}
     */
    public function run(Source $source, ?string $runId = null): array
    {
        $runId ??= (string) Str::uuid();

        $completed = 0;
        $failed = 0;
        $results = [];

        foreach ($this->registry->all() as $rule) {
            try {
                $params = [
                    'resultsSchema' => $source->getTableQualifier(DaimonType::Results) ?? 'results',
                    'cdmSchema' => $source->getTableQualifier(DaimonType::CDM) ?? 'omop',
                    'vocabSchema' => $source->getTableQualifier(DaimonType::Vocabulary) ?? 'omop',
                ];
                $sql = $this->sqlRenderer->render($rule->sqlTemplate(), $params);

                $rows = DB::select($sql);

                $violations = 0;
                foreach ($rows as $row) {
                    AchillesHeelResult::create([
                        'source_id' => $source->id,
                        'run_id' => $runId,
                        'rule_id' => $rule->ruleId(),
                        'rule_name' => $rule->ruleName(),
                        'severity' => $rule->severity(),
                        'record_count' => $row->record_count ?? 0,
                        'attribute_name' => $row->attribute_name ?? null,
                        'attribute_value' => $row->attribute_value ?? null,
                    ]);
                    $violations++;
                }

                $completed++;
                $results[] = [
                    'rule_id' => $rule->ruleId(),
                    'status' => 'completed',
                    'violations' => $violations,
                ];
            } catch (\Throwable $e) {
                $failed++;
                $results[] = [
                    'rule_id' => $rule->ruleId(),
                    'status' => 'failed',
                    'violations' => 0,
                    'error' => $e->getMessage(),
                ];

                Log::warning("Achilles Heel rule {$rule->ruleId()} failed: {$e->getMessage()}");
            }
        }

        return compact('completed', 'failed', 'results');
    }

    /**
     * Return stored heel results for a source, grouped by severity.
     * If runId provided, returns results for that specific run.
     * Otherwise returns results from the latest run.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function getResults(Source $source, ?string $runId = null): array
    {
        $query = AchillesHeelResult::where('source_id', $source->id);

        if ($runId) {
            $query->where('run_id', $runId);
        } else {
            // Get latest run_id
            $latestRunId = AchillesHeelResult::where('source_id', $source->id)
                ->orderByDesc('created_at')
                ->value('run_id');

            if (! $latestRunId) {
                return ['error' => [], 'warning' => [], 'notification' => []];
            }

            $query->where('run_id', $latestRunId);
        }

        $rows = $query->orderBy('severity')
            ->orderBy('rule_id')
            ->get();

        $grouped = ['error' => [], 'warning' => [], 'notification' => []];

        foreach ($rows as $row) {
            $grouped[$row->severity][] = $row->toArray();
        }

        return $grouped;
    }
}
