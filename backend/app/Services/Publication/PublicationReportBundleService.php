<?php

namespace App\Services\Publication;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use JsonException;

class PublicationReportBundleService
{
    public const FORMATS = [
        'ohdsi_report_bundle',
        'ohdsi_report_generator_r',
        'ohdsi_sharing_bundle',
    ];

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function export(array $payload, string $format): array
    {
        $format = $this->normalizeFormat($format);
        $document = $this->documentFromPayload($payload);

        return match ($format) {
            'ohdsi_report_bundle' => $this->jsonArtifact(
                $format,
                $this->slug($document['title']).'.ohdsi-report-bundle.json',
                $this->reportBundle($document),
            ),
            'ohdsi_sharing_bundle' => $this->jsonArtifact(
                $format,
                $this->slug($document['title']).'.ohdsi-sharing-bundle.json',
                $this->sharingBundle($document),
            ),
            'ohdsi_report_generator_r' => $this->textArtifact(
                $format,
                $this->slug($document['title']).'.ohdsi-report-generator.R',
                $this->reportGeneratorScript($document),
            ),
            default => throw new \InvalidArgumentException("Unknown publication report format: {$format}"),
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{title: string, template: string, document_json: array<string, mixed>, metadata: array<string, mixed>}
     */
    public function parseImportPayload(array $payload): array
    {
        $format = $this->normalizeFormat((string) ($payload['format'] ?? 'ohdsi_report_bundle'));
        $artifact = $payload['artifact'] ?? $payload['content'] ?? $payload;

        $parsed = match ($format) {
            'ohdsi_report_bundle', 'ohdsi_sharing_bundle' => $this->parseBundleArtifact($artifact),
            'ohdsi_report_generator_r' => $this->parseScriptArtifact((string) $artifact),
            default => throw new \InvalidArgumentException("Unknown publication report format: {$format}"),
        };

        $document = $parsed['document'] ?? null;
        if (! is_array($document)) {
            throw ValidationException::withMessages([
                'artifact' => 'Report bundle does not contain a publication document.',
            ]);
        }

        $title = trim((string) ($payload['title'] ?? $document['title'] ?? 'Imported OHDSI report'));
        $title = $title !== '' ? $title : 'Imported OHDSI report';
        $template = (string) ($document['template'] ?? 'generic-ohdsi');
        $sections = is_array($document['sections'] ?? null) ? array_values($document['sections']) : [];
        $authors = is_array($document['authors'] ?? null)
            ? array_values(array_filter($document['authors'], 'is_string'))
            : [];

        return [
            'title' => $title,
            'template' => $template !== '' ? $template : 'generic-ohdsi',
            'document_json' => [
                'step' => 4,
                'selectedExecutions' => is_array($document['selectedExecutions'] ?? null)
                    ? array_values($document['selectedExecutions'])
                    : [],
                'sections' => $sections,
                'title' => $title,
                'authors' => $authors,
                'template' => $template !== '' ? $template : 'generic-ohdsi',
            ],
            'metadata' => [
                'format' => $format,
                'source_metadata' => is_array($parsed['metadata'] ?? null) ? $parsed['metadata'] : [],
            ],
        ];
    }

    public function normalizeFormat(string $format): string
    {
        $normalized = strtolower(str_replace(['-', ' '], '_', trim($format)));
        $aliases = [
            'report_bundle' => 'ohdsi_report_bundle',
            'ohdsi_report' => 'ohdsi_report_bundle',
            'report_generator' => 'ohdsi_report_generator_r',
            'ohdsi_report_generator' => 'ohdsi_report_generator_r',
            'sharing_bundle' => 'ohdsi_sharing_bundle',
            'ohdsi_sharing' => 'ohdsi_sharing_bundle',
        ];
        $normalized = $aliases[$normalized] ?? $normalized;

        if (! in_array($normalized, self::FORMATS, true)) {
            throw ValidationException::withMessages([
                'format' => 'Unsupported OHDSI report bundle format.',
            ]);
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function documentFromPayload(array $payload): array
    {
        $sections = array_values(array_filter(
            $payload['sections'] ?? [],
            fn (array $section): bool => (bool) ($section['included'] ?? false),
        ));

        return [
            'title' => trim((string) ($payload['title'] ?? 'Untitled')) ?: 'Untitled',
            'authors' => is_array($payload['authors'] ?? null) ? array_values($payload['authors']) : [],
            'template' => (string) ($payload['template'] ?? 'generic-ohdsi'),
            'sections' => $sections,
            'selectedExecutions' => is_array($payload['selected_executions'] ?? null)
                ? array_values($payload['selected_executions'])
                : [],
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, mixed>
     */
    private function reportBundle(array $document): array
    {
        $reportJson = json_encode($document, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);
        $manifest = $this->manifest($document, 'ohdsi-report-generator');

        return [
            'package' => [
                'name' => Str::studly($this->slug($document['title'])).'Report',
                'type' => 'parthenon-ohdsi-report-bundle',
                'engine' => 'OhdsiReportGenerator',
                'created_at' => now()->toISOString(),
            ],
            'manifest' => $manifest,
            'document' => $document,
            'files' => [
                [
                    'path' => 'inst/reports/report.json',
                    'kind' => 'json',
                    'content' => $reportJson,
                ],
                [
                    'path' => 'inst/reports/report.md',
                    'kind' => 'markdown',
                    'content' => $this->markdown($document),
                ],
                [
                    'path' => 'inst/reports/report-manifest.json',
                    'kind' => 'json',
                    'content' => json_encode($manifest, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT),
                ],
                [
                    'path' => 'R/generate-ohdsi-report.R',
                    'kind' => 'r',
                    'content' => $this->reportGeneratorScript($document),
                ],
                ...$this->figureFiles($document),
                ...$this->tableFiles($document),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, mixed>
     */
    private function sharingBundle(array $document): array
    {
        $bundle = $this->reportBundle($document);
        $sharingManifest = [
            'type' => 'ohdsi-sharing',
            'package' => 'OhdsiSharing',
            'created_at' => now()->toISOString(),
            'title' => $document['title'],
            'assets' => array_map(
                static fn (array $file): string => (string) $file['path'],
                $bundle['files'],
            ),
        ];

        $bundle['package']['type'] = 'parthenon-ohdsi-sharing-bundle';
        $bundle['package']['engine'] = 'OhdsiSharing';
        $bundle['sharing_manifest'] = $sharingManifest;
        $bundle['files'][] = [
            'path' => 'inst/sharing/ohdsi-sharing-manifest.json',
            'kind' => 'json',
            'content' => json_encode($sharingManifest, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT),
        ];
        $bundle['files'][] = [
            'path' => 'R/share-results.R',
            'kind' => 'r',
            'content' => $this->sharingScript($document),
        ];

        return $bundle;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, mixed>
     */
    private function manifest(array $document, string $engine): array
    {
        return [
            'title' => $document['title'],
            'template' => $document['template'],
            'engine' => $engine,
            'section_count' => count($document['sections'] ?? []),
            'figure_count' => count($this->figureFiles($document)),
            'table_count' => count($this->tableFiles($document)),
            'exported_at' => now()->toISOString(),
            'source' => 'parthenon',
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     */
    private function reportGeneratorScript(array $document): string
    {
        $encoded = base64_encode(json_encode($document, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));

        return <<<R
# Parthenon OHDSI report bundle handoff
# Requires jsonlite. OhdsiReportGenerator is used when installed in Darkstar.
# PARTHENON_REPORT_JSON_BEGIN
{$encoded}
# PARTHENON_REPORT_JSON_END

report_document <- jsonlite::fromJSON(rawToChar(jsonlite::base64_dec("{$encoded}")), simplifyVector = FALSE)

if (requireNamespace("OhdsiReportGenerator", quietly = TRUE)) {
  message("OhdsiReportGenerator is installed. report_document is ready for package-level rendering.")
} else {
  message("OhdsiReportGenerator is not installed. report_document remains a portable OHDSI report handoff.")
}
R;
    }

    /**
     * @param  array<string, mixed>  $document
     */
    private function sharingScript(array $document): string
    {
        $encoded = base64_encode(json_encode($document, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));

        return <<<R
# Parthenon OHDSI sharing handoff
# Requires jsonlite. OhdsiSharing is used when installed in Darkstar.
report_document <- jsonlite::fromJSON(rawToChar(jsonlite::base64_dec("{$encoded}")), simplifyVector = FALSE)

if (requireNamespace("OhdsiSharing", quietly = TRUE)) {
  message("OhdsiSharing is installed. Attach generated report assets to the sharing manifest before distribution.")
} else {
  message("OhdsiSharing is not installed. The embedded report_document remains importable by Parthenon.")
}
R;
    }

    /**
     * @param  array<string, mixed>  $document
     */
    private function markdown(array $document): string
    {
        $lines = ['# '.$document['title'], ''];
        $authors = $document['authors'] ?? [];
        if (is_array($authors) && $authors !== []) {
            $lines[] = implode(', ', array_map('strval', $authors));
            $lines[] = '';
        }

        foreach (($document['sections'] ?? []) as $section) {
            if (! is_array($section)) {
                continue;
            }
            $lines[] = '## '.((string) ($section['title'] ?? Str::headline((string) ($section['type'] ?? 'Section'))));
            $content = $section['content'] ?? '';
            if (is_array($content)) {
                $content = json_encode($content, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);
            }
            if (is_string($content) && trim($content) !== '') {
                $lines[] = trim($content);
            }
            if (isset($section['caption']) && is_string($section['caption']) && trim($section['caption']) !== '') {
                $lines[] = '_'.trim($section['caption']).'_';
            }
            $lines[] = '';
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<string, mixed>  $document
     * @return list<array<string, string>>
     */
    private function figureFiles(array $document): array
    {
        $files = [];
        foreach (($document['sections'] ?? []) as $index => $section) {
            if (! is_array($section) || ! is_string($section['svg'] ?? null) || trim($section['svg']) === '') {
                continue;
            }
            $slug = $this->slug((string) ($section['title'] ?? 'figure-'.($index + 1)));
            $files[] = [
                'path' => "inst/reports/figures/{$slug}.svg",
                'kind' => 'svg',
                'content' => $section['svg'],
            ];
        }

        return $files;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return list<array<string, string>>
     */
    private function tableFiles(array $document): array
    {
        $files = [];
        foreach (($document['sections'] ?? []) as $index => $section) {
            if (! is_array($section) || ! is_array($section['table_data'] ?? null)) {
                continue;
            }
            $slug = $this->slug((string) ($section['title'] ?? 'table-'.($index + 1)));
            $files[] = [
                'path' => "inst/reports/tables/{$slug}.json",
                'kind' => 'json',
                'content' => json_encode($section['table_data'], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT),
            ];
        }

        return $files;
    }

    /**
     * @return array<string, mixed>
     */
    private function parseBundleArtifact(mixed $artifact): array
    {
        if (is_string($artifact)) {
            $artifact = $this->decodeJson($artifact, 'Report bundle JSON is invalid.');
        }

        if (! is_array($artifact)) {
            throw ValidationException::withMessages([
                'artifact' => 'Report bundle must be a JSON object.',
            ]);
        }

        $content = is_array($artifact['content'] ?? null) ? $artifact['content'] : $artifact;
        if (is_array($content['document'] ?? null)) {
            return [
                'document' => $content['document'],
                'metadata' => $content['manifest'] ?? $content['package'] ?? [],
            ];
        }

        $files = is_array($content['files'] ?? null) ? $content['files'] : [];
        foreach ($files as $file) {
            if (! is_array($file) || ! str_ends_with((string) ($file['path'] ?? ''), 'report.json')) {
                continue;
            }

            return [
                'document' => $this->decodeJson((string) ($file['content'] ?? '{}'), 'Report JSON file is invalid.'),
                'metadata' => $content['manifest'] ?? $content['package'] ?? [],
            ];
        }

        throw ValidationException::withMessages([
            'artifact' => 'Report bundle does not contain report.json.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function parseScriptArtifact(string $script): array
    {
        if (! preg_match('/PARTHENON_REPORT_JSON_BEGIN\s*(.*?)\s*#?\s*PARTHENON_REPORT_JSON_END/s', $script, $matches)) {
            throw ValidationException::withMessages([
                'artifact' => 'R artifact is missing the Parthenon report payload marker.',
            ]);
        }

        $decoded = base64_decode(trim($matches[1]), true);
        if ($decoded === false) {
            throw ValidationException::withMessages([
                'artifact' => 'Embedded R artifact payload is invalid.',
            ]);
        }

        return [
            'document' => $this->decodeJson($decoded, 'Embedded R artifact payload is invalid.'),
            'metadata' => ['source' => 'parthenon-r-script'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function jsonArtifact(string $format, string $downloadName, array $content): array
    {
        return [
            'format' => $format,
            'mime_type' => 'application/json',
            'download_name' => $downloadName,
            'content' => $content,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function textArtifact(string $format, string $downloadName, string $content): array
    {
        return [
            'format' => $format,
            'mime_type' => 'text/plain',
            'download_name' => $downloadName,
            'content' => $content,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJson(string $json, string $message): array
    {
        try {
            $decoded = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw ValidationException::withMessages([
                'artifact' => $message,
            ]);
        }

        if (! is_array($decoded)) {
            throw ValidationException::withMessages([
                'artifact' => $message,
            ]);
        }

        return $decoded;
    }

    private function slug(string $value): string
    {
        return Str::slug($value) ?: 'ohdsi-report';
    }
}
