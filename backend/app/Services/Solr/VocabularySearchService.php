<?php

namespace App\Services\Solr;

class VocabularySearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    public function isAvailable(): bool
    {
        return $this->solr->isAvailable();
    }

    /**
     * Search concepts via Solr with faceted filtering.
     *
     * @param  array<string, mixed>  $filters
     * @return array{items: array<int, array<string, mixed>>, total: int, facets: array<string, array<string, int>>, highlights: array<int, array<string, string[]>>}|null
     */
    public function search(string $query, array $filters = [], int $limit = 25, int $offset = 0): ?array
    {
        $core = config('solr.cores.vocabulary', 'vocabulary');

        $params = [
            'q' => $query,
            'defType' => 'edismax',
            'qf' => 'concept_name^3 concept_code^2 concept_synonyms^1',
            'pf' => 'concept_name^5',
            'start' => $offset,
            'rows' => $limit,
            'fl' => 'concept_id,concept_name,domain_id,vocabulary_id,concept_class_id,standard_concept,concept_code',
            'hl' => 'true',
            'hl.fl' => 'concept_name,concept_synonyms',
            'hl.simple.pre' => '<mark>',
            'hl.simple.post' => '</mark>',
            'facet' => 'true',
            'facet.field' => ['domain_id', 'vocabulary_id', 'concept_class_id', 'standard_concept'],
            'facet.mincount' => 1,
            'facet.limit' => 50,
        ];

        // Apply filter queries
        $fq = [];

        if (! empty($filters['domain'])) {
            $fq[] = 'domain_id:'.self::escapeValue($filters['domain']);
        }

        if (! empty($filters['vocabulary'])) {
            $fq[] = 'vocabulary_id:'.self::escapeValue($filters['vocabulary']);
        }

        if (! empty($filters['concept_class'])) {
            $fq[] = 'concept_class_id:'.self::escapeValue($filters['concept_class']);
        }

        if (! empty($filters['standard'])) {
            $val = $filters['standard'];
            if (in_array($val, ['true', '1', true], true)) {
                $val = 'S';
            }
            $fq[] = 'standard_concept:'.$val;
        }

        if (! empty($filters['exclude_invalid'])) {
            $fq[] = '-invalid_reason:[* TO *]';
        }

        if (! empty($fq)) {
            $params['fq'] = $fq;
        }

        $result = $this->solr->select($core, $params);

        if ($result === null) {
            return null;
        }

        $docs = $result['response']['docs'] ?? [];
        $total = $result['response']['numFound'] ?? 0;

        // Parse facets
        $facets = $this->parseFacets($result['facet_counts']['facet_fields'] ?? []);

        // Parse highlights
        $highlights = $this->parseHighlights($result['highlighting'] ?? []);

        return [
            'items' => $docs,
            'total' => $total,
            'facets' => $facets,
            'highlights' => $highlights,
        ];
    }

    /**
     * Typeahead suggestions.
     *
     * @return array<int, array{concept_id: int, concept_name: string}>|null
     */
    public function suggest(string $prefix, int $limit = 10): ?array
    {
        $core = config('solr.cores.vocabulary', 'vocabulary');

        $result = $this->solr->suggest($core, [
            'suggest.q' => $prefix,
            'suggest.count' => $limit,
        ]);

        if ($result === null) {
            return null;
        }

        $suggestions = $result['suggest']['conceptSuggester'][$prefix]['suggestions'] ?? [];

        return array_map(fn (array $s) => [
            'concept_name' => $s['term'] ?? '',
            'weight' => $s['weight'] ?? 0,
        ], $suggestions);
    }

    /**
     * Direct lookup by concept_id.
     *
     * @return array<string, mixed>|null
     */
    public function getById(int $conceptId): ?array
    {
        $core = config('solr.cores.vocabulary', 'vocabulary');

        $result = $this->solr->select($core, [
            'q' => "concept_id:{$conceptId}",
            'rows' => 1,
        ]);

        if ($result === null) {
            return null;
        }

        return $result['response']['docs'][0] ?? null;
    }

    /**
     * Parse Solr facet_fields into a clean associative structure.
     *
     * @param  array<string, array<int, string|int>>  $facetFields
     * @return array<string, array<string, int>>
     */
    private function parseFacets(array $facetFields): array
    {
        $facets = [];

        foreach ($facetFields as $field => $values) {
            $facets[$field] = [];
            for ($i = 0, $len = count($values); $i < $len; $i += 2) {
                $name = (string) $values[$i];
                $count = (int) ($values[$i + 1] ?? 0);
                if ($count > 0) {
                    $facets[$field][$name] = $count;
                }
            }
        }

        return $facets;
    }

    /**
     * Parse Solr highlights into a usable structure.
     *
     * @param  array<string, array<string, string[]>>  $highlighting
     * @return array<string, array<string, string[]>>
     */
    private function parseHighlights(array $highlighting): array
    {
        return $highlighting;
    }

    private static function escapeValue(string $value): string
    {
        // Quote the value to handle spaces and special chars
        return '"'.addcslashes($value, '"\\').'"';
    }
}
