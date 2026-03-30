<?php

namespace App\Services\Survey;

use App\Models\Survey\SurveyConductRecord;
use App\Models\Survey\SurveyItem;
use Illuminate\Support\Facades\DB;

class SurveyResponseService
{
    /**
     * @param  array<int, array<string, mixed>>  $responses
     * @return array{created:int,total_score:float|null,subscale_scores:array<string, float>}
     */
    public function storeResponses(SurveyConductRecord $conduct, array $responses, bool $replaceExisting = true): array
    {
        $conduct->loadMissing('instrument.items.answerOptions', 'responses');

        $items = $conduct->instrument->items->keyBy('id');
        $created = 0;

        DB::transaction(function () use ($conduct, $responses, $replaceExisting, $items, &$created): void {
            if ($replaceExisting) {
                $conduct->responses()->delete();
            }

            foreach ($responses as $responsePayload) {
                $itemId = (int) ($responsePayload['survey_item_id'] ?? 0);
                /** @var SurveyItem|null $item */
                $item = $items->get($itemId);

                if ($item === null) {
                    continue;
                }

                $values = $this->normalizeValues($responsePayload['value'] ?? null);

                foreach ($values as $value) {
                    $normalized = $this->mapValueForItem($item, $value);

                    if (
                        $normalized['value_as_number'] === null &&
                        $normalized['value_as_string'] === null &&
                        $normalized['value_as_concept_id'] === null
                    ) {
                        continue;
                    }

                    $conduct->responses()->create([
                        'survey_item_id' => $item->id,
                        'value_as_number' => $normalized['value_as_number'],
                        'value_as_string' => $normalized['value_as_string'],
                        'value_as_concept_id' => $normalized['value_as_concept_id'],
                        'response_datetime' => now(),
                    ]);

                    $created++;
                }
            }

            $conduct->update([
                'completion_status' => $created > 0 ? 'complete' : $conduct->completion_status,
                'survey_end_datetime' => $created > 0 ? now() : $conduct->survey_end_datetime,
                'survey_start_datetime' => $conduct->survey_start_datetime ?? now(),
            ]);
        });

        $conduct->refresh()->load('responses.item.answerOptions', 'instrument.items.answerOptions');
        $scores = app(SurveyScoreService::class)->compute($conduct);
        $conduct->update($scores);

        return [
            'created' => $created,
            'total_score' => $scores['total_score'],
            'subscale_scores' => $scores['subscale_scores'],
        ];
    }

    /**
     * @return list<mixed>
     */
    private function normalizeValues(mixed $value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_array($value)) {
            return array_values(array_filter($value, fn ($entry) => $entry !== null && $entry !== ''));
        }

        if (is_string($value)) {
            $trimmed = trim($value);

            if ($trimmed === '') {
                return [];
            }

            return [$trimmed];
        }

        return [$value];
    }

    /**
     * @return array{value_as_number:float|null,value_as_string:string|null,value_as_concept_id:int|null}
     */
    private function mapValueForItem(SurveyItem $item, mixed $value): array
    {
        $rawString = is_scalar($value) ? trim((string) $value) : null;
        $matchingOption = $rawString === null
            ? null
            : $item->answerOptions->first(function ($option) use ($rawString) {
                return strcasecmp($option->option_text, $rawString) === 0
                    || ($option->option_value !== null && (string) $option->option_value === $rawString);
            });

        return match ($item->response_type) {
            'numeric', 'likert', 'nrs', 'vas' => [
                'value_as_number' => is_numeric($value)
                    ? (float) $value
                    : ($matchingOption?->option_value !== null ? (float) $matchingOption->option_value : null),
                'value_as_string' => $matchingOption?->option_text,
                'value_as_concept_id' => $matchingOption?->omop_concept_id,
            ],
            'yes_no' => [
                'value_as_number' => $matchingOption?->option_value !== null
                    ? (float) $matchingOption->option_value
                    : ($rawString !== null ? (in_array(mb_strtolower($rawString), ['yes', 'true', '1'], true) ? 1.0 : 0.0) : null),
                'value_as_string' => $matchingOption?->option_text ?? $rawString,
                'value_as_concept_id' => $matchingOption?->omop_concept_id,
            ],
            'multi_select' => [
                'value_as_number' => $matchingOption?->option_value !== null ? (float) $matchingOption->option_value : null,
                'value_as_string' => $matchingOption?->option_text ?? $rawString,
                'value_as_concept_id' => $matchingOption?->omop_concept_id,
            ],
            default => [
                'value_as_number' => is_numeric($value) ? (float) $value : null,
                'value_as_string' => $matchingOption?->option_text ?? $rawString,
                'value_as_concept_id' => $matchingOption?->omop_concept_id,
            ],
        };
    }
}
