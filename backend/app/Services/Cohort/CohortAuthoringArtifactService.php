<?php

namespace App\Services\Cohort;

use App\Models\App\CohortDefinition;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CohortAuthoringArtifactService
{
    public const FORMATS = [
        'atlas_json',
        'circe_json',
        'circer_r',
        'capr_r',
        'r_package',
    ];

    public function __construct(
        private readonly CohortExpressionSchema $schema,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function export(CohortDefinition $cohortDefinition, string $format): array
    {
        $format = $this->normalizeFormat($format);
        $expression = $this->schema->validate($cohortDefinition->expression_json ?? []);
        $payload = $this->basePayload($cohortDefinition, $expression);

        return match ($format) {
            'atlas_json' => $this->jsonArtifact($format, "{$this->slug($cohortDefinition)}.atlas.json", [
                'name' => $cohortDefinition->name,
                'description' => $cohortDefinition->description,
                'expression' => $expression,
            ]),
            'circe_json' => $this->jsonArtifact($format, "{$this->slug($cohortDefinition)}.circe.json", [
                'cohortDefinition' => $payload,
                'expression' => $expression,
            ]),
            'circer_r' => $this->textArtifact(
                $format,
                "{$this->slug($cohortDefinition)}.circer.R",
                $this->circeRScript($payload),
            ),
            'capr_r' => $this->textArtifact(
                $format,
                "{$this->slug($cohortDefinition)}.capr.R",
                $this->caprScript($payload),
            ),
            'r_package' => $this->packageArtifact($cohortDefinition, $payload),
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{name: string, description: string|null, expression: array<string, mixed>, metadata: array<string, mixed>}
     */
    public function parseImportPayload(array $payload): array
    {
        $format = $this->normalizeFormat((string) ($payload['format'] ?? 'atlas_json'));
        $artifact = $payload['artifact'] ?? $payload['content'] ?? $payload;
        $parsed = match ($format) {
            'atlas_json', 'circe_json' => $this->parseJsonLikeArtifact($artifact),
            'circer_r', 'capr_r' => $this->parseScriptArtifact((string) $artifact),
            'r_package' => $this->parsePackageArtifact($artifact),
        };

        $name = trim((string) ($payload['name'] ?? $parsed['name'] ?? 'Imported cohort'));
        $description = $payload['description'] ?? $parsed['description'] ?? null;
        $expression = $parsed['expression'] ?? null;
        if (! is_array($expression)) {
            throw ValidationException::withMessages([
                'artifact' => 'Authoring artifact does not contain a cohort expression.',
            ]);
        }

        return [
            'name' => $name !== '' ? $name : 'Imported cohort',
            'description' => is_string($description) ? $description : null,
            'expression' => $this->schema->validate($expression),
            'metadata' => [
                'format' => $format,
                'source_metadata' => $parsed['metadata'] ?? [],
            ],
        ];
    }

    public function normalizeFormat(string $format): string
    {
        $normalized = strtolower(str_replace(['-', ' '], '_', trim($format)));
        $aliases = [
            'atlas' => 'atlas_json',
            'circe' => 'circe_json',
            'circer' => 'circer_r',
            'capr' => 'capr_r',
            'package' => 'r_package',
        ];
        $normalized = $aliases[$normalized] ?? $normalized;

        if (! in_array($normalized, self::FORMATS, true)) {
            throw ValidationException::withMessages([
                'format' => 'Unsupported cohort authoring artifact format.',
            ]);
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $expression
     * @return array<string, mixed>
     */
    private function basePayload(CohortDefinition $cohortDefinition, array $expression): array
    {
        return [
            'id' => $cohortDefinition->id,
            'name' => $cohortDefinition->name,
            'description' => $cohortDefinition->description,
            'version' => $cohortDefinition->version,
            'expression' => $expression,
            'metadata' => [
                'source' => 'parthenon',
                'exported_at' => now()->toISOString(),
                'parthenon_cohort_definition_id' => $cohortDefinition->id,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $content
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
     * @param  array<string, mixed>  $payload
     */
    private function circeRScript(array $payload): string
    {
        $encoded = base64_encode(json_encode($payload, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));

        return <<<R
# Parthenon CirceR cohort artifact
# Requires jsonlite. CirceR is optional for SQL generation in an R runtime.
# PARTHENON_COHORT_JSON_BEGIN
{$encoded}
# PARTHENON_COHORT_JSON_END

cohort_payload <- jsonlite::fromJSON(rawToChar(jsonlite::base64_dec("{$encoded}")), simplifyVector = FALSE)
cohort_expression <- cohort_payload\$expression

if (requireNamespace("CirceR", quietly = TRUE)) {
  message("CirceR is installed. cohort_expression is ready for CirceR workflows.")
} else {
  message("CirceR is not installed. cohort_expression still contains the OHDSI Circe JSON expression.")
}
R;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function caprScript(array $payload): string
    {
        $encoded = base64_encode(json_encode($payload, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));

        return <<<R
# Parthenon Capr cohort handoff artifact
# This file preserves the canonical OHDSI Circe JSON expression and names the Capr boundary.
# Use it as the package-level handoff point for teams that build or rewrite the cohort in Capr.
# PARTHENON_COHORT_JSON_BEGIN
{$encoded}
# PARTHENON_COHORT_JSON_END

cohort_payload <- jsonlite::fromJSON(rawToChar(jsonlite::base64_dec("{$encoded}")), simplifyVector = FALSE)
cohort_expression <- cohort_payload\$expression

if (requireNamespace("Capr", quietly = TRUE)) {
  message("Capr is installed. Use cohort_expression as the reference expression while authoring a Capr DSL equivalent.")
} else {
  message("Capr is not installed. The embedded cohort_expression remains importable by Parthenon.")
}
R;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function packageArtifact(CohortDefinition $cohortDefinition, array $payload): array
    {
        $slug = $this->slug($cohortDefinition);
        $cohortJson = json_encode($payload, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);

        return [
            'format' => 'r_package',
            'mime_type' => 'application/json',
            'download_name' => "{$slug}.authoring-package.json",
            'content' => [
                'package' => [
                    'name' => Str::studly($slug).'Cohort',
                    'type' => 'parthenon-ohdsi-authoring',
                    'created_at' => now()->toISOString(),
                ],
                'files' => [
                    [
                        'path' => 'inst/cohorts/cohort.json',
                        'kind' => 'json',
                        'content' => $cohortJson,
                    ],
                    [
                        'path' => 'R/circer-export.R',
                        'kind' => 'r',
                        'content' => $this->circeRScript($payload),
                    ],
                    [
                        'path' => 'R/capr-handoff.R',
                        'kind' => 'r',
                        'content' => $this->caprScript($payload),
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function parseJsonLikeArtifact(mixed $artifact): array
    {
        if (is_string($artifact)) {
            $artifact = json_decode($artifact, true, flags: JSON_THROW_ON_ERROR);
        }

        if (! is_array($artifact)) {
            throw ValidationException::withMessages([
                'artifact' => 'JSON authoring artifact must be an object.',
            ]);
        }

        $cohort = $artifact['cohortDefinition'] ?? $artifact;

        return [
            'name' => $cohort['name'] ?? $artifact['name'] ?? null,
            'description' => $cohort['description'] ?? $artifact['description'] ?? null,
            'expression' => $cohort['expression'] ?? $artifact['expression'] ?? $artifact['expression_json'] ?? null,
            'metadata' => $cohort['metadata'] ?? $artifact['metadata'] ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function parseScriptArtifact(string $script): array
    {
        if (! preg_match('/PARTHENON_COHORT_JSON_BEGIN\s*(.*?)\s*#?\s*PARTHENON_COHORT_JSON_END/s', $script, $matches)) {
            throw ValidationException::withMessages([
                'artifact' => 'R artifact is missing the Parthenon cohort payload marker.',
            ]);
        }

        $payload = json_decode(base64_decode(trim($matches[1]), true) ?: '', true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($payload)) {
            throw ValidationException::withMessages([
                'artifact' => 'Embedded R artifact payload is invalid.',
            ]);
        }

        return [
            'name' => $payload['name'] ?? null,
            'description' => $payload['description'] ?? null,
            'expression' => $payload['expression'] ?? null,
            'metadata' => $payload['metadata'] ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function parsePackageArtifact(mixed $artifact): array
    {
        if (is_string($artifact)) {
            $artifact = json_decode($artifact, true, flags: JSON_THROW_ON_ERROR);
        }

        $files = is_array($artifact) ? ($artifact['files'] ?? $artifact['content']['files'] ?? null) : null;
        if (! is_array($files)) {
            return $this->parseJsonLikeArtifact($artifact);
        }

        foreach ($files as $file) {
            $path = (string) ($file['path'] ?? '');
            if (str_ends_with($path, 'cohort.json')) {
                return $this->parseJsonLikeArtifact((string) ($file['content'] ?? '{}'));
            }
        }

        throw ValidationException::withMessages([
            'artifact' => 'Package artifact does not contain inst/cohorts/cohort.json.',
        ]);
    }

    private function slug(CohortDefinition $cohortDefinition): string
    {
        return Str::slug($cohortDefinition->name) ?: "cohort-{$cohortDefinition->id}";
    }
}
