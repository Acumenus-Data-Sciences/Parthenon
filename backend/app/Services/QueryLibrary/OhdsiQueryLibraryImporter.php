<?php

namespace App\Services\QueryLibrary;

use App\Models\App\QueryLibraryEntry;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;

class OhdsiQueryLibraryImporter
{
    /**
     * @return array{imported:int, skipped:int, paths:list<string>}
     */
    public function importFromPath(string $path, bool $fresh = false): array
    {
        $queriesPath = $this->resolveQueriesPath($path);
        $files = Collection::make(iterator_to_array(new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($queriesPath)
        )))
            ->filter(fn (SplFileInfo $file) => $file->isFile() && $file->getExtension() === 'md')
            ->sortBy(fn (SplFileInfo $file) => Str::after($file->getPathname(), $queriesPath.DIRECTORY_SEPARATOR))
            ->values();

        if ($fresh) {
            QueryLibraryEntry::query()
                ->whereIn('source', ['ohdsi_querylibrary', 'ohdsi_inspired'])
                ->delete();
        }

        $imported = 0;
        $skipped = 0;
        $paths = [];

        foreach ($files as $file) {
            $entry = $this->parseMarkdownFile($file->getPathname(), $queriesPath);
            if ($entry === null) {
                $skipped++;

                continue;
            }

            QueryLibraryEntry::updateOrCreate(
                ['slug' => $entry['slug']],
                $entry,
            );

            $imported++;
            $paths[] = Str::after($file->getPathname(), $queriesPath.DIRECTORY_SEPARATOR);
        }

        return [
            'imported' => $imported,
            'skipped' => $skipped,
            'paths' => $paths,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function parseMarkdownFile(string $filePath, ?string $queriesPath = null): ?array
    {
        $content = file_get_contents($filePath);
        if ($content === false) {
            throw new RuntimeException("Unable to read markdown file '{$filePath}'.");
        }
        $metadata = $this->parseMetadata($content);
        $sql = $this->extractFirstSqlBlock($content);

        if ($sql === '') {
            return null;
        }

        $queriesRoot = $queriesPath ? rtrim($queriesPath, DIRECTORY_SEPARATOR) : dirname($filePath, 2);
        $relative = ltrim(Str::after($filePath, $queriesRoot), DIRECTORY_SEPARATOR);
        $domain = str_replace('_', ' ', dirname($relative));
        $description = $this->extractSectionBody($content, 'Description');
        $inputRows = $this->parseInputRows($content);

        [$sqlTemplate, $parameters] = $this->normalizeSqlAndParameters($sql, $inputRows);

        $title = trim((string) ($metadata['Name'] ?? $this->extractHeading($content) ?? pathinfo($filePath, PATHINFO_FILENAME)));
        $summary = Str::limit(trim(Str::before($description, "\n\n")), 240);
        $slugBase = pathinfo($relative, PATHINFO_FILENAME).'-'.$title;

        return [
            'slug' => Str::slug($slugBase),
            'name' => $title,
            'domain' => Str::slug($domain, '_'),
            'category' => $this->inferCategory($title, $sqlTemplate),
            'summary' => $summary !== '' ? $summary : $title,
            'description' => $description !== '' ? $description : $summary,
            'sql_template' => $sqlTemplate,
            'parameters_json' => $parameters,
            'tags_json' => $this->buildTags($metadata, $domain, $title, $sqlTemplate),
            'example_questions_json' => [],
            'template_language' => 'ohdsi_sql',
            'is_aggregate' => $this->isAggregateQuery($sqlTemplate),
            'safety' => 'safe',
            'source' => 'ohdsi_querylibrary',
        ];
    }

    private function resolveQueriesPath(string $path): string
    {
        $path = rtrim($path, DIRECTORY_SEPARATOR);
        $candidates = [
            $path,
            $path.DIRECTORY_SEPARATOR.'inst/shinyApps/QueryLibrary/queries',
        ];

        foreach ($candidates as $candidate) {
            if (is_dir($candidate) && is_dir($candidate.DIRECTORY_SEPARATOR.'condition')) {
                return $candidate;
            }
        }

        throw new RuntimeException("Could not find OHDSI QueryLibrary queries directory under '{$path}'.");
    }

    /**
     * @return array<string, string>
     */
    private function parseMetadata(string $content): array
    {
        if (! preg_match('/<!---(.*?)-->/s', $content, $matches)) {
            return [];
        }

        $metadata = [];
        foreach (preg_split('/\R/', trim($matches[1])) ?: [] as $line) {
            [$key, $value] = array_pad(explode(':', $line, 2), 2, '');
            $key = trim($key);
            if ($key === '') {
                continue;
            }

            $metadata[$key] = trim($value);
        }

        return $metadata;
    }

    private function extractFirstSqlBlock(string $content): string
    {
        if (! preg_match('/```sql\s*(.*?)```/is', $content, $matches)) {
            return '';
        }

        return trim($matches[1]);
    }

    private function extractHeading(string $content): ?string
    {
        if (! preg_match('/^#\s+(.+)$/m', $content, $matches)) {
            return null;
        }

        return trim($matches[1]);
    }

    private function extractSectionBody(string $content, string $section): string
    {
        $pattern = '/^##\s+'.preg_quote($section, '/').'\s*$\R(.*?)(?=^##\s|\z)/ms';
        if (! preg_match($pattern, $content, $matches)) {
            return '';
        }

        return trim($matches[1]);
    }

    /**
     * @return list<array{label:string, example:string, description:string}>
     */
    private function parseInputRows(string $content): array
    {
        $section = $this->extractSectionBody($content, 'Input');
        if ($section === '') {
            return [];
        }

        $rows = [];
        foreach (preg_split('/\R/', $section) ?: [] as $line) {
            if (! str_starts_with(trim($line), '|')) {
                continue;
            }

            $cells = array_values(array_filter(array_map('trim', explode('|', trim($line, '|'))), static fn ($cell) => $cell !== ''));
            if (count($cells) < 4) {
                continue;
            }

            if (Str::lower($cells[0]) === 'parameter' || preg_match('/^-+$/', str_replace(' ', '', $cells[0]))) {
                continue;
            }

            $rows[] = [
                'label' => $cells[0],
                'example' => $cells[1],
                'description' => $cells[3],
            ];
        }

        return $rows;
    }

    /**
     * @param  list<array{label:string, example:string, description:string}>  $inputRows
     * @return array{0:string, 1:list<array<string, string>>}
     */
    private function normalizeSqlAndParameters(string $sql, array $inputRows): array
    {
        $parameters = [];

        if (str_contains($sql, '@cdm.')) {
            $sql = str_replace('@cdm.', '{@cdmSchema}.', $sql);
            $parameters[] = [
                'key' => 'cdmSchema',
                'label' => 'CDM schema',
                'type' => 'string',
                'default' => 'omop',
                'description' => 'Qualified OMOP CDM schema name.',
            ];
        }

        if (str_contains($sql, '@vocab.')) {
            $sql = str_replace('@vocab.', '{@vocabSchema}.', $sql);
            $parameters[] = [
                'key' => 'vocabSchema',
                'label' => 'Vocabulary schema',
                'type' => 'string',
                'default' => 'omop',
                'description' => 'Qualified OMOP vocabulary schema name.',
            ];
        }

        foreach ($inputRows as $row) {
            $example = trim($row['example']);
            if ($example === '') {
                continue;
            }

            $normalizedLabel = preg_replace('/\bID\b/', 'Id', $row['label']) ?? $row['label'];
            $key = Str::camel(preg_replace('/[^A-Za-z0-9]+/', ' ', $normalizedLabel) ?? $normalizedLabel);
            if ($key === '' || in_array($key, ['cdmSchema', 'vocabSchema'], true)) {
                continue;
            }

            $placeholder = '{@'.$key.'}';
            $replacedSql = $this->replaceExampleLiteral($sql, $example, $placeholder);
            if ($replacedSql === $sql) {
                continue;
            }

            $sql = $replacedSql;
            $parameters[] = [
                'key' => $key,
                'label' => $row['label'],
                'type' => $this->inferParameterType($example),
                'default' => trim($example, "\"'"),
                'description' => $row['description'],
            ];
        }

        return [$sql, array_values($parameters)];
    }

    private function replaceExampleLiteral(string $sql, string $example, string $placeholder): string
    {
        $trimmed = trim($example, "\"'");

        $quotedPatterns = [
            "'".str_replace("'", "\\'", $trimmed)."'",
            '"'.str_replace('"', '\\"', $trimmed).'"',
        ];

        foreach ($quotedPatterns as $quoted) {
            if (str_contains($sql, $quoted)) {
                return str_replace($quoted, "'{$placeholder}'", $sql);
            }
        }

        if (preg_match('/^\d+$/', $trimmed)) {
            return (string) preg_replace('/(?<!\w)'.preg_quote($trimmed, '/').'(?!\w)/', $placeholder, $sql, 1);
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed)) {
            return str_replace($trimmed, $placeholder, $sql);
        }

        if (str_contains($sql, $trimmed)) {
            return str_replace($trimmed, $placeholder, $sql);
        }

        return $sql;
    }

    private function inferParameterType(string $example): string
    {
        $trimmed = trim($example, "\"'");

        if (preg_match('/^\d+$/', $trimmed)) {
            return 'number';
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed)) {
            return 'date';
        }

        return 'string';
    }

    /**
     * @param  array<string, string>  $metadata
     * @return list<string>
     */
    private function buildTags(array $metadata, string $domain, string $title, string $sql): array
    {
        $tags = [
            str_replace(' ', '_', Str::lower($domain)),
            Str::slug((string) ($metadata['Author'] ?? ''), '_'),
            Str::slug((string) ($metadata['CDM Version'] ?? ''), '_'),
        ];

        if (str_contains(Str::lower($title), 'count')) {
            $tags[] = 'count';
        }
        if (str_contains(Str::lower($title), 'find')) {
            $tags[] = 'lookup';
        }
        if (preg_match('/\bconcept_ancestor\b/i', $sql)) {
            $tags[] = 'concept_ancestor';
        }

        return array_values(array_unique(array_filter($tags)));
    }

    private function inferCategory(string $title, string $sql): string
    {
        $name = Str::lower($title);

        if (str_contains($name, 'count') || preg_match('/\b(count|sum|avg|min|max)\s*\(/i', $sql)) {
            return 'aggregate';
        }

        if (str_contains($name, 'find') || str_contains($name, 'lookup')) {
            return 'lookup';
        }

        return 'analysis';
    }

    private function isAggregateQuery(string $sql): bool
    {
        return preg_match('/\b(count|sum|avg|min|max)\s*\(/i', $sql) === 1;
    }
}
