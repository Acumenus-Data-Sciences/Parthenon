<?php

namespace App\Services\Achilles\Heel;

use App\Models\App\Source;
use App\Models\Results\AchillesHeelResult;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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
    public function run(Source $source): array
    {
        // Clear previous results for this source
        AchillesHeelResult::where('source_id', $source->source_id)->delete();

        $completed = 0;
        $failed = 0;
        $results = [];

        foreach ($this->registry->all() as $rule) {
            try {
                $sql = $this->sqlRenderer->render($sql = $rule->sqlTemplate(), $source);

                $rows = DB::select($sql);

                $violations = 0;
                foreach ($rows as $row) {
                    AchillesHeelResult::create([
                        'source_id'       => $source->source_id,
                        'rule_id'         => $rule->ruleId(),
                        'rule_name'       => $rule->ruleName(),
                        'severity'        => $rule->severity(),
                        'record_count'    => $row->record_count ?? 0,
                        'attribute_name'  => $row->attribute_name ?? null,
                        'attribute_value' => $row->attribute_value ?? null,
                    ]);
                    $violations++;
                }

                $completed++;
                $results[] = [
                    'rule_id'    => $rule->ruleId(),
                    'status'     => 'completed',
                    'violations' => $violations,
                ];
            } catch (\Throwable $e) {
                $failed++;
                $results[] = [
                    'rule_id' => $rule->ruleId(),
                    'status'  => 'failed',
                    'violations' => 0,
                    'error'   => $e->getMessage(),
                ];

                Log::warning("Achilles Heel rule {$rule->ruleId()} failed: {$e->getMessage()}");
            }
        }

        return compact('completed', 'failed', 'results');
    }

    /**
     * Return all stored heel results for a source, grouped by severity.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function getResults(Source $source): array
    {
        $rows = AchillesHeelResult::where('source_id', $source->source_id)
            ->orderBy('severity')
            ->orderBy('rule_id')
            ->get();

        $grouped = ['error' => [], 'warning' => [], 'notification' => []];

        foreach ($rows as $row) {
            $grouped[$row->severity][] = $row->toArray();
        }

        return $grouped;
    }
}
