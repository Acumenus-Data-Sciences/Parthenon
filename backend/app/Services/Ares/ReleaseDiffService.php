<?php

declare(strict_types=1);

namespace App\Services\Ares;

use App\Models\App\DqdResult;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;

class ReleaseDiffService
{
    /**
     * Compute diff between a release and its predecessor.
     *
     * @return array{has_previous: bool, person_delta: int, record_delta: int, domain_deltas: array<string, int>, dq_score_delta: float, vocab_version_changed: bool, unmapped_code_delta: int, auto_notes: string}
     */
    public function computeDiff(SourceRelease $release): array
    {
        $previous = SourceRelease::where('source_id', $release->source_id)
            ->where('id', '!=', $release->id)
            ->where('created_at', '<', $release->created_at)
            ->orderByDesc('created_at')
            ->first();

        if (! $previous) {
            return [
                'has_previous' => false,
                'person_delta' => $release->person_count,
                'record_delta' => $release->record_count,
                'domain_deltas' => [],
                'dq_score_delta' => 0.0,
                'vocab_version_changed' => false,
                'unmapped_code_delta' => 0,
                'auto_notes' => "Initial release: {$release->person_count} persons, {$release->record_count} records.",
            ];
        }

        $personDelta = $release->person_count - $previous->person_count;
        $recordDelta = $release->record_count - $previous->record_count;

        // DQ score delta
        $currentDq = $this->getPassRate($release->source_id, $release->id);
        $previousDq = $this->getPassRate($release->source_id, $previous->id);
        $dqDelta = round($currentDq - $previousDq, 1);

        // Vocab version change
        $vocabChanged = $release->vocabulary_version !== $previous->vocabulary_version
            && $release->vocabulary_version !== null;

        // Unmapped code delta
        $currentUnmapped = UnmappedSourceCode::where('release_id', $release->id)->count();
        $previousUnmapped = UnmappedSourceCode::where('release_id', $previous->id)->count();
        $unmappedDelta = $currentUnmapped - $previousUnmapped;

        // Domain-level deltas from DQD results
        $domainDeltas = $this->getDomainDeltas($release, $previous);

        $diff = [
            'has_previous' => true,
            'person_delta' => $personDelta,
            'record_delta' => $recordDelta,
            'domain_deltas' => $domainDeltas,
            'dq_score_delta' => $dqDelta,
            'vocab_version_changed' => $vocabChanged,
            'unmapped_code_delta' => $unmappedDelta,
            'auto_notes' => '',
        ];

        $diff['auto_notes'] = $this->generateReleaseNotes($diff, $release);

        return $diff;
    }

    /**
     * Generate human-readable release notes from diff data.
     */
    public function generateReleaseNotes(array $diff, SourceRelease $release): string
    {
        $notes = [];

        if ($diff['person_delta'] > 0) {
            $notes[] = "Added ".number_format($diff['person_delta'])." persons";
        } elseif ($diff['person_delta'] < 0) {
            $notes[] = "Removed ".number_format(abs($diff['person_delta']))." persons";
        }

        if ($diff['record_delta'] !== 0) {
            $pct = $release->record_count > 0
                ? round(abs($diff['record_delta']) / $release->record_count * 100, 1)
                : 0;
            $direction = $diff['record_delta'] > 0 ? 'grew' : 'shrank';
            $notes[] = "Total records {$direction} {$pct}%";
        }

        if ($diff['dq_score_delta'] > 0) {
            $notes[] = "DQ score improved {$diff['dq_score_delta']}%";
        } elseif ($diff['dq_score_delta'] < 0) {
            $notes[] = "DQ score declined ".abs($diff['dq_score_delta'])."%";
        }

        if ($diff['vocab_version_changed']) {
            $notes[] = "Vocabulary version updated to {$release->vocabulary_version}";
        }

        if ($diff['unmapped_code_delta'] > 0) {
            $notes[] = "{$diff['unmapped_code_delta']} new unmapped codes";
        } elseif ($diff['unmapped_code_delta'] < 0) {
            $notes[] = abs($diff['unmapped_code_delta'])." unmapped codes resolved";
        }

        return implode('. ', $notes).'.';
    }

    private function getPassRate(int $sourceId, int $releaseId): float
    {
        $stats = DqdResult::where('source_id', $sourceId)
            ->where('release_id', $releaseId)
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
            ->first();

        $total = (int) ($stats->total ?? 0);
        $passed = (int) ($stats->passed_count ?? 0);

        return $total > 0 ? round(($passed / $total) * 100, 1) : 0.0;
    }

    /**
     * @return array<string, int>
     */
    private function getDomainDeltas(SourceRelease $current, SourceRelease $previous): array
    {
        $currentCounts = DqdResult::where('source_id', $current->source_id)
            ->where('release_id', $current->id)
            ->whereNotNull('cdm_table')
            ->selectRaw('cdm_table, SUM(total_rows) as total')
            ->groupBy('cdm_table')
            ->pluck('total', 'cdm_table')
            ->map(fn ($v) => (int) $v);

        $previousCounts = DqdResult::where('source_id', $previous->source_id)
            ->where('release_id', $previous->id)
            ->whereNotNull('cdm_table')
            ->selectRaw('cdm_table, SUM(total_rows) as total')
            ->groupBy('cdm_table')
            ->pluck('total', 'cdm_table')
            ->map(fn ($v) => (int) $v);

        $deltas = [];
        foreach ($currentCounts as $domain => $count) {
            $prev = $previousCounts->get($domain, 0);
            $deltas[$domain] = $count - $prev;
        }

        return $deltas;
    }
}
