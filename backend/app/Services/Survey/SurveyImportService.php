<?php

namespace App\Services\Survey;

use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyConductRecord;
use InvalidArgumentException;

class SurveyImportService
{
    public function __construct(
        private readonly SurveyResponseService $surveyResponseService,
    ) {}

    /**
     * @return array{processed:int,matched:int,missing:int,created_responses:int}
     */
    public function importCsv(SurveyCampaign $campaign, string $csvContent): array
    {
        $rows = $this->parseCsv($csvContent);

        if ($rows === []) {
            throw new InvalidArgumentException('CSV import did not contain any data rows.');
        }

        $campaign->loadMissing('instrument.items.answerOptions');
        $items = $campaign->instrument->items;

        $processed = 0;
        $matched = 0;
        $missing = 0;
        $createdResponses = 0;

        foreach ($rows as $row) {
            $processed++;
            $personId = isset($row['person_id']) && is_numeric($row['person_id']) ? (int) $row['person_id'] : null;

            if ($personId === null) {
                $missing++;

                continue;
            }

            /** @var SurveyConductRecord|null $conduct */
            $conduct = $campaign->conductRecords()
                ->where('person_id', $personId)
                ->first();

            if ($conduct === null) {
                $missing++;

                continue;
            }

            $responses = [];

            foreach ($items as $item) {
                $value = $this->findValueForItem($row, $item->id, $item->item_number, $item->item_text);

                if ($value === null || $value === '') {
                    continue;
                }

                $responses[] = [
                    'survey_item_id' => $item->id,
                    'value' => $this->coerceImportedValue($value, $item->response_type),
                ];
            }

            if ($responses === []) {
                continue;
            }

            $result = $this->surveyResponseService->storeResponses($conduct, $responses, true);
            $matched++;
            $createdResponses += $result['created'];
        }

        return [
            'processed' => $processed,
            'matched' => $matched,
            'missing' => $missing,
            'created_responses' => $createdResponses,
        ];
    }

    /**
     * @return list<array<string, string|null>>
     */
    private function parseCsv(string $csvContent): array
    {
        $lines = preg_split('/\r\n|\n|\r/', trim($csvContent)) ?: [];

        if ($lines === []) {
            return [];
        }

        $headers = str_getcsv((string) array_shift($lines));
        $headers = array_map(fn ($header) => trim((string) $header), $headers);
        $rows = [];

        foreach ($lines as $line) {
            if (trim($line) === '') {
                continue;
            }

            $values = str_getcsv($line);
            $row = [];

            foreach ($headers as $index => $header) {
                $row[$header] = array_key_exists($index, $values) ? trim((string) $values[$index]) : null;
            }

            $rows[] = $row;
        }

        return $rows;
    }

    private function findValueForItem(array $row, int $itemId, int $itemNumber, string $itemText): mixed
    {
        $candidates = [
            (string) $itemId,
            "item_{$itemId}",
            (string) $itemNumber,
            "item_{$itemNumber}",
            $itemText,
        ];

        foreach ($candidates as $candidate) {
            if (array_key_exists($candidate, $row)) {
                return $row[$candidate];
            }
        }

        return null;
    }

    private function coerceImportedValue(string $value, string $responseType): mixed
    {
        if ($responseType === 'multi_select') {
            return preg_split('/\s*[|;]\s*/', $value) ?: [$value];
        }

        return $value;
    }
}
