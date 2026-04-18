<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Contracts\TranslationProviderInterface;
use App\DataTransferObjects\TranslationBatchItem;
use App\DataTransferObjects\TranslationBatchRequest;
use App\DataTransferObjects\TranslationReviewRequest;
use App\Enums\TranslationDataClass;
use Illuminate\Console\Command;
use ValueError;

class TranslationDraftAssetsCommand extends Command
{
    protected $signature = 'translation:draft-assets
        {--input=output/translation-assets/latest : Translation asset bundle directory}
        {--output=output/translation-assets/provider-drafts/latest : Provider draft output directory}
        {--only=frontend,backend,help : Comma-separated asset groups with messages.json}
        {--locales= : Comma-separated target locale codes; defaults to bundle target locales}
        {--data-class= : Override translation data class for all rows}
        {--all : Draft/review all rows instead of only missing target rows}
        {--fail-on-review : Return failure when provider review finds violations}';

    protected $description = 'Draft/review exported translation asset rows through the configured translation provider';

    public function __construct(
        private readonly TranslationProviderInterface $provider,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $inputDir = $this->resolveRepoPath((string) $this->option('input'));
        $outputDir = $this->resolveRepoPath((string) $this->option('output'));
        $manifest = $this->readJson($inputDir.'/manifest.json');

        if ($manifest === null) {
            $this->error("Translation asset manifest not found: {$inputDir}/manifest.json");

            return self::FAILURE;
        }

        $groups = $this->csvOption('only');
        $locales = $this->csvOption('locales') ?: (array) ($manifest['targetLocales'] ?? []);
        $sourceLocale = (string) ($manifest['sourceLocale'] ?? 'en-US');
        $includeAllRows = (bool) $this->option('all');
        $failOnReview = (bool) $this->option('fail-on-review');
        $report = [
            'provider' => config('translation.primary', 'local'),
            'source_locale' => $sourceLocale,
            'target_locales' => $locales,
            'input' => $this->relativeToRepo($inputDir),
            'output' => $this->relativeToRepo($outputDir),
            'include_all_rows' => $includeAllRows,
            'groups' => [],
            'totals' => [
                'candidate_rows' => 0,
                'drafted_rows' => 0,
                'review_failures' => 0,
                'warnings' => 0,
            ],
        ];

        foreach ($groups as $group) {
            $messagesPath = "{$inputDir}/{$group}/messages.json";
            $rows = $this->readJson($messagesPath);

            if (! is_array($rows)) {
                $this->warn("Skipping {$group}: messages.json not found.");

                continue;
            }

            $groupSummary = $this->processGroup(
                group: $group,
                rows: $rows,
                locales: $locales,
                sourceLocale: $sourceLocale,
                dataClass: $this->dataClassFor($group),
                includeAllRows: $includeAllRows,
                outputDir: $outputDir,
            );

            $report['groups'][$group] = $groupSummary;
            $report['totals']['candidate_rows'] += $groupSummary['candidate_rows'];
            $report['totals']['drafted_rows'] += $groupSummary['drafted_rows'];
            $report['totals']['review_failures'] += $groupSummary['review_failures'];
            $report['totals']['warnings'] += $groupSummary['warnings'];
        }

        $this->writeJson("{$outputDir}/provider-draft-report.json", $report);

        $this->info('Translation provider draft complete.');
        $this->line('Provider: '.config('translation.primary', 'local'));
        $this->line('Output: '.$this->relativeToRepo($outputDir));
        $this->line('Candidate rows: '.$report['totals']['candidate_rows']);
        $this->line('Drafted rows: '.$report['totals']['drafted_rows']);
        $this->line('Review failures: '.$report['totals']['review_failures']);
        $this->line('Warnings: '.$report['totals']['warnings']);

        return $failOnReview && $report['totals']['review_failures'] > 0
            ? self::FAILURE
            : self::SUCCESS;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>  $locales
     * @return array<string, mixed>
     */
    private function processGroup(
        string $group,
        array $rows,
        array $locales,
        string $sourceLocale,
        TranslationDataClass $dataClass,
        bool $includeAllRows,
        string $outputDir,
    ): array {
        $outputRows = [];
        $summary = [
            'data_class' => $dataClass->value,
            'candidate_rows' => 0,
            'drafted_rows' => 0,
            'review_failures' => 0,
            'warnings' => 0,
            'locales' => [],
        ];

        foreach ($locales as $locale) {
            if (! $this->provider->supportsLocale($sourceLocale, $locale)) {
                $summary['locales'][$locale] = ['skipped' => 'unsupported-locale'];

                continue;
            }

            if (! $this->provider->supportsDataClass($dataClass)) {
                $summary['locales'][$locale] = ['skipped' => 'unsupported-data-class'];

                continue;
            }

            $candidateRows = array_values(array_filter(
                $rows,
                fn (array $row): bool => ($row['target_locale'] ?? null) === $locale
                    && ($includeAllRows || (string) ($row['target_text'] ?? '') === ''),
            ));

            $items = array_map(
                fn (array $row): TranslationBatchItem => new TranslationBatchItem(
                    key: (string) $row['asset_id'],
                    sourceText: (string) $row['source_text'],
                    targetText: $row['target_text'] ? (string) $row['target_text'] : null,
                    metadata: [
                        'group' => $group,
                        'namespace' => $row['namespace'] ?? null,
                        'key' => $row['key'] ?? null,
                        'source_path' => $row['source_path'] ?? null,
                    ],
                ),
                $candidateRows,
            );

            $translation = $this->provider->translateBatch(new TranslationBatchRequest(
                sourceLocale: $sourceLocale,
                targetLocale: $locale,
                dataClass: $dataClass,
                items: $items,
            ));

            $reviewItems = array_map(
                fn (array $item): TranslationBatchItem => new TranslationBatchItem(
                    key: $item['key'],
                    sourceText: $item['source_text'],
                    targetText: $item['target_text'],
                    metadata: $item['metadata'] ?? [],
                ),
                $translation->items,
            );

            $review = $this->provider->reviewBatch(new TranslationReviewRequest(
                sourceLocale: $sourceLocale,
                targetLocale: $locale,
                dataClass: $dataClass,
                items: $reviewItems,
            ));

            $reviewByKey = collect($review->items)->keyBy('key');
            foreach ($translation->items as $item) {
                $row = $candidateRows[array_search($item['key'], array_column($candidateRows, 'asset_id'), true)] ?? [];
                $reviewItem = $reviewByKey->get($item['key'], [
                    'passed' => false,
                    'violations' => [['type' => 'missing-review']],
                ]);

                $outputRows[] = [
                    ...$row,
                    'target_text' => $item['target_text'],
                    'provider' => $translation->provider,
                    'provider_status' => $item['status'],
                    'review_passed' => $reviewItem['passed'],
                    'review_violations' => $reviewItem['violations'],
                ];
            }

            $reviewFailures = collect($review->items)
                ->filter(fn (array $item): bool => ! $item['passed'])
                ->count();
            $warningCount = count($translation->warnings) + count($review->warnings);

            $summary['candidate_rows'] += count($candidateRows);
            $summary['drafted_rows'] += count($translation->items);
            $summary['review_failures'] += $reviewFailures;
            $summary['warnings'] += $warningCount;
            $summary['locales'][$locale] = [
                'candidate_rows' => count($candidateRows),
                'drafted_rows' => count($translation->items),
                'review_failures' => $reviewFailures,
                'warnings' => $warningCount,
            ];
        }

        $this->writeJson("{$outputDir}/{$group}/messages.json", $outputRows);

        return $summary;
    }

    private function dataClassFor(string $group): TranslationDataClass
    {
        $override = $this->option('data-class');
        if (is_string($override) && $override !== '') {
            try {
                return TranslationDataClass::from($override);
            } catch (ValueError) {
                $allowed = collect(TranslationDataClass::cases())
                    ->map(fn (TranslationDataClass $case): string => $case->value)
                    ->implode(', ');

                throw new ValueError("Unsupported --data-class={$override}. Allowed values: {$allowed}");
            }
        }

        return $group === 'help'
            ? TranslationDataClass::Documentation
            : TranslationDataClass::ProductCopy;
    }

    /**
     * @return list<string>
     */
    private function csvOption(string $name): array
    {
        $value = $this->option($name);
        if (! is_string($value) || trim($value) === '') {
            return [];
        }

        return array_values(array_filter(array_map(
            fn (string $item): string => trim($item),
            explode(',', $value),
        )));
    }

    /**
     * @return array<mixed>|null
     */
    private function readJson(string $path): ?array
    {
        if (! is_file($path)) {
            return null;
        }

        $payload = json_decode((string) file_get_contents($path), true);

        return is_array($payload) ? $payload : null;
    }

    /**
     * @param  array<mixed>  $payload
     */
    private function writeJson(string $path, array $payload): void
    {
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0775, true);
        }

        file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");
    }

    private function resolveRepoPath(string $path): string
    {
        if (str_starts_with($path, '/')) {
            return rtrim($path, '/');
        }

        return rtrim($this->repoRoot().'/'.$path, '/');
    }

    private function repoRoot(): string
    {
        return realpath(base_path('..')) ?: dirname(base_path());
    }

    private function relativeToRepo(string $path): string
    {
        return ltrim((string) str_replace($this->repoRoot(), '', $path), '/');
    }
}
