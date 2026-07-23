<?php

namespace App\Services\Solr;

use Carbon\CarbonInterface;

final class VocabularyIndexAudit
{
    /**
     * Fields that must remain identical between PostgreSQL and Solr.
     *
     * @var list<string>
     */
    public const AUDITED_FIELDS = [
        'concept_id',
        'concept_name',
        'concept_code',
        'domain_id',
        'vocabulary_id',
        'concept_class_id',
        'standard_concept',
        'invalid_reason',
        'valid_start_date',
        'valid_end_date',
    ];

    public function countsMatch(int $postgresCount, int $solrCount): bool
    {
        return $postgresCount === $solrCount;
    }

    /**
     * Normalize a PostgreSQL concept row to the document contract emitted by
     * SolrIndexVocabulary.
     *
     * @return array<string, string>
     */
    public function expectedDocument(object|array $concept): array
    {
        $document = [];
        foreach (self::AUDITED_FIELDS as $field) {
            $value = is_array($concept) ? ($concept[$field] ?? null) : ($concept->{$field} ?? null);
            $document[$field] = $this->normalizeValue($field, $value);
        }

        return $document;
    }

    /**
     * @param  array<int, array<string, string>>  $expectedDocuments
     * @param  array<int, array<string, mixed>>  $actualDocuments
     * @return array{
     *     missing_ids: list<int>,
     *     unexpected_ids: list<int>,
     *     stale_fields: array<int, list<string>>
     * }
     */
    public function compareBatch(array $expectedDocuments, array $actualDocuments): array
    {
        $expectedById = [];
        foreach ($expectedDocuments as $document) {
            $expectedById[(int) $document['concept_id']] = $document;
        }

        $actualById = [];
        $unexpectedIds = [];
        foreach ($actualDocuments as $document) {
            if (! array_key_exists('concept_id', $document)) {
                continue;
            }

            $conceptId = (int) $document['concept_id'];
            if (! array_key_exists($conceptId, $expectedById)) {
                $unexpectedIds[] = $conceptId;

                continue;
            }

            $actualById[$conceptId] = $document;
        }

        $missingIds = array_values(array_diff(array_keys($expectedById), array_keys($actualById)));
        $staleFields = [];

        foreach ($actualById as $conceptId => $actual) {
            $expected = $expectedById[$conceptId];
            foreach (self::AUDITED_FIELDS as $field) {
                if (! array_key_exists($field, $actual)
                    || $this->normalizeValue($field, $actual[$field]) !== $expected[$field]) {
                    $staleFields[$conceptId][] = $field;
                }
            }
        }

        sort($missingIds);
        sort($unexpectedIds);
        ksort($staleFields);

        return [
            'missing_ids' => $missingIds,
            'unexpected_ids' => $unexpectedIds,
            'stale_fields' => $staleFields,
        ];
    }

    private function normalizeValue(string $field, mixed $value): string
    {
        if ($field === 'concept_id') {
            return (string) ((int) $value);
        }

        if (in_array($field, ['standard_concept', 'invalid_reason'], true) && $value === null) {
            return '';
        }

        if (in_array($field, ['valid_start_date', 'valid_end_date'], true)) {
            if ($value instanceof CarbonInterface) {
                return $value->format('Y-m-d\T00:00:00\Z');
            }

            $date = (string) ($value ?? '');
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) {
                return $date.'T00:00:00Z';
            }

            return $date;
        }

        return (string) ($value ?? '');
    }
}
