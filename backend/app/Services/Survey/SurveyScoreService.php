<?php

namespace App\Services\Survey;

use App\Models\Survey\SurveyConductRecord;
use App\Models\Survey\SurveyResponse;

class SurveyScoreService
{
    /**
     * @return array{total_score: float|null, subscale_scores: array<string, float>}
     */
    public function compute(SurveyConductRecord $conduct): array
    {
        $conduct->loadMissing('instrument.items.answerOptions', 'responses.item.answerOptions');

        $responses = $conduct->responses
            ->filter(fn (SurveyResponse $response) => $response->item !== null);

        if ($responses->isEmpty()) {
            return [
                'total_score' => null,
                'subscale_scores' => [],
            ];
        }

        $scored = $responses->map(function (SurveyResponse $response): array {
            $item = $response->item;
            $rawValue = $response->value_as_number;
            $score = $rawValue === null ? null : (float) $rawValue;

            if ($score !== null && $item->is_reverse_coded) {
                $maxValue = $item->max_value !== null
                    ? (float) $item->max_value
                    : $item->answerOptions->max(fn ($option) => $option->option_value !== null ? (float) $option->option_value : null);
                $minValue = $item->min_value !== null ? (float) $item->min_value : 0.0;

                if ($maxValue !== null) {
                    $score = $maxValue + $minValue - $score;
                }
            }

            return [
                'subscale' => $item->subscale_name,
                'score' => $score,
            ];
        })->filter(fn (array $entry) => $entry['score'] !== null)->values();

        if ($scored->isEmpty()) {
            return [
                'total_score' => null,
                'subscale_scores' => [],
            ];
        }

        $scores = $scored->pluck('score')->map(fn ($score) => (float) $score)->all();
        $subscaleScores = [];

        foreach ($scored->groupBy('subscale') as $subscale => $entries) {
            if ($subscale === null || $subscale === '') {
                continue;
            }

            $subscaleScores[(string) $subscale] = round(
                array_sum($entries->pluck('score')->all()),
                2
            );
        }

        $scoringMethod = $conduct->instrument?->scoring_method ?? [];
        $type = $scoringMethod['type'] ?? 'sum';

        $totalScore = match ($type) {
            'mean' => round(array_sum($scores) / count($scores), 2),
            default => round(array_sum($scores), 2),
        };

        return [
            'total_score' => $totalScore,
            'subscale_scores' => $subscaleScores,
        ];
    }
}
