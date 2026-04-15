<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\PhenotypeLibraryEntry;
use App\Models\App\StudyDesignAsset;
use App\Models\Vocabulary\Concept;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class StudyDesignAssetVerificationService
{
    public function verify(StudyDesignAsset $asset): StudyDesignAsset
    {
        $result = match ($asset->asset_type) {
            'phenotype_recommendation' => $this->verifyPhenotypeRecommendation($asset),
            'local_cohort' => $this->verifyLocalCohort($asset),
            'local_concept_set' => $this->verifyLocalConceptSet($asset),
            default => $this->unsupportedAsset($asset),
        };

        $asset->update([
            'verification_status' => $result['status'],
            'verification_json' => $result,
            'verified_at' => now(),
        ]);

        return $asset->fresh() ?? $asset;
    }

    /**
     * @return array<string, mixed>
     */
    private function verifyPhenotypeRecommendation(StudyDesignAsset $asset): array
    {
        $checks = [];
        $payload = $asset->draft_payload_json ?? [];
        $entry = $this->canonicalRecord($asset, PhenotypeLibraryEntry::class);

        if (! $entry instanceof PhenotypeLibraryEntry) {
            $checks[] = $this->check('source_record', 'fail', 'Blocked: phenotype recommendation did not resolve to a local Phenotype Library entry.');

            return $this->result($checks, $asset);
        }

        $checks[] = $this->check('source_record', 'pass', 'Resolved to a local Phenotype Library entry.', [
            'phenotype_library_entry_id' => $entry->id,
            'cohort_id' => $entry->cohort_id,
        ]);

        if (isset($payload['external_id']) && (int) $payload['external_id'] !== (int) $entry->cohort_id) {
            $checks[] = $this->check('external_id', 'fail', 'Blocked: suggested OHDSI cohort ID does not match the local source record.', [
                'suggested' => $payload['external_id'],
                'canonical' => $entry->cohort_id,
            ]);
        } else {
            $checks[] = $this->check('external_id', 'pass', 'Suggested cohort ID matches the local source record.');
        }

        $checks[] = $this->titleCheck((string) ($payload['title'] ?? ''), (string) $entry->cohort_name, 'cohort_name');
        $checks[] = $this->expressionCheck((bool) ($payload['has_expression'] ?? false), $entry->expression_json, 'phenotype_expression');

        if (isset($payload['domain']) && $entry->domain !== null && (string) $payload['domain'] !== (string) $entry->domain) {
            $checks[] = $this->check('domain', 'fail', 'Blocked: suggested domain does not match the local Phenotype Library metadata.', [
                'suggested' => $payload['domain'],
                'canonical' => $entry->domain,
            ]);
        }

        if ($entry->is_imported && $entry->imported_cohort_id === null) {
            $checks[] = $this->check('imported_cohort', 'warn', 'Phenotype is marked imported but has no linked local cohort definition.');
        }

        return $this->result([...$checks, ...$this->conceptChecks($payload)], $asset);
    }

    /**
     * @return array<string, mixed>
     */
    private function verifyLocalCohort(StudyDesignAsset $asset): array
    {
        $checks = [];
        $payload = $asset->draft_payload_json ?? [];
        $cohort = $this->canonicalRecord($asset, CohortDefinition::class);

        if (! $cohort instanceof CohortDefinition) {
            $checks[] = $this->check('source_record', 'fail', 'Blocked: local cohort recommendation did not resolve to an existing cohort definition.');

            return $this->result($checks, $asset);
        }

        $checks[] = $this->check('source_record', 'pass', 'Resolved to an existing local cohort definition.', [
            'cohort_definition_id' => $cohort->id,
        ]);
        $checks[] = $this->titleCheck((string) ($payload['title'] ?? ''), (string) $cohort->name, 'cohort_name');
        $checks[] = $this->expressionCheck((bool) ($payload['has_expression'] ?? false), $cohort->expression_json, 'cohort_expression');

        if ($cohort->isDeprecated()) {
            $checks[] = $this->check('active_status', 'fail', 'Blocked: local cohort is deprecated and cannot be accepted as a verified recommendation.');
        } else {
            $checks[] = $this->check('active_status', 'pass', 'Local cohort is active.');
        }

        return $this->result([...$checks, ...$this->conceptChecks($payload)], $asset);
    }

    /**
     * @return array<string, mixed>
     */
    private function verifyLocalConceptSet(StudyDesignAsset $asset): array
    {
        $checks = [];
        $payload = $asset->draft_payload_json ?? [];
        $conceptSet = $this->canonicalRecord($asset, ConceptSet::class);

        if (! $conceptSet instanceof ConceptSet) {
            $checks[] = $this->check('source_record', 'fail', 'Blocked: local concept set recommendation did not resolve to an existing concept set.');

            return $this->result($checks, $asset);
        }

        $checks[] = $this->check('source_record', 'pass', 'Resolved to an existing local concept set.', [
            'concept_set_id' => $conceptSet->id,
        ]);
        $checks[] = $this->titleCheck((string) ($payload['title'] ?? ''), (string) $conceptSet->name, 'concept_set_name');
        $checks[] = $this->expressionCheck((bool) ($payload['has_expression'] ?? false), $conceptSet->expression_json, 'concept_set_expression');

        return $this->result([...$checks, ...$this->conceptChecks($payload)], $asset);
    }

    /**
     * @param  class-string<Model>  $expectedType
     */
    private function canonicalRecord(StudyDesignAsset $asset, string $expectedType): ?Model
    {
        if ($asset->canonical_type !== $expectedType || $asset->canonical_id === null) {
            return null;
        }

        /** @var Model|null $record */
        $record = $expectedType::query()->find($asset->canonical_id);

        return $record;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     */
    private function conceptChecks(array $payload): array
    {
        $conceptIds = $this->extractConceptIds($payload);

        if ($conceptIds === []) {
            return [$this->check('omop_concepts', 'info', 'No explicit OMOP concept IDs were present in this recommendation payload.')];
        }

        $concepts = Concept::query()
            ->whereIn('concept_id', $conceptIds)
            ->get(['concept_id', 'concept_name', 'domain_id', 'standard_concept', 'invalid_reason'])
            ->keyBy('concept_id');

        $missing = collect($conceptIds)->reject(fn (int $id) => $concepts->has($id))->values()->all();
        $invalid = $concepts
            ->filter(fn (Concept $concept) => filled($concept->invalid_reason))
            ->map(fn (Concept $concept) => [
                'concept_id' => $concept->concept_id,
                'concept_name' => $concept->concept_name,
                'invalid_reason' => $concept->invalid_reason,
            ])
            ->values()
            ->all();

        if ($missing !== [] || $invalid !== []) {
            return [$this->check('omop_concepts', 'fail', 'Blocked: one or more explicit OMOP concept IDs could not be verified as valid vocabulary concepts.', [
                'missing_concept_ids' => $missing,
                'invalid_concepts' => $invalid,
            ])];
        }

        return [$this->check('omop_concepts', 'pass', 'Explicit OMOP concept IDs resolved to valid vocabulary concepts.', [
            'concept_count' => count($conceptIds),
        ])];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<int>
     */
    private function extractConceptIds(array $payload): array
    {
        $ids = [];
        $walk = function (mixed $value, ?string $key = null) use (&$walk, &$ids): void {
            $normalizedKey = $key ? strtolower((string) preg_replace('/[^a-zA-Z0-9]/', '', $key)) : '';

            if (in_array($normalizedKey, ['conceptid', 'conceptids'], true)) {
                foreach ((array) $value as $candidate) {
                    if (is_numeric($candidate)) {
                        $ids[] = (int) $candidate;
                    }
                }
            }

            if (is_array($value)) {
                foreach ($value as $childKey => $childValue) {
                    $walk($childValue, is_string($childKey) ? $childKey : null);
                }
            }
        };

        $walk($payload);

        return collect($ids)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->take(100)
            ->values()
            ->all();
    }

    private function titleCheck(string $suggested, string $canonical, string $field): array
    {
        if ($suggested === '') {
            return $this->check($field, 'warn', 'Recommendation payload has no title to compare with the source record.');
        }

        if ($this->textMatches($suggested, $canonical)) {
            return $this->check($field, 'pass', 'Recommendation title matches the source record.');
        }

        return $this->check($field, 'fail', 'Blocked: recommendation title does not match the source record.', [
            'suggested' => $suggested,
            'canonical' => $canonical,
        ]);
    }

    private function expressionCheck(bool $payloadClaimsExpression, mixed $expression, string $name): array
    {
        $hasExpression = $expression !== null && $expression !== [] && $expression !== '';

        if ($payloadClaimsExpression && ! $hasExpression) {
            return $this->check($name, 'fail', 'Blocked: recommendation claims a computable expression, but the source record has none.');
        }

        if ($hasExpression) {
            return $this->check($name, 'pass', 'Source record has a computable expression.');
        }

        return $this->check($name, 'warn', 'Source record has no computable expression yet.');
    }

    private function textMatches(string $left, string $right): bool
    {
        $leftNorm = $this->normalizeText($left);
        $rightNorm = $this->normalizeText($right);

        if ($leftNorm === '' || $rightNorm === '') {
            return false;
        }

        if ($leftNorm === $rightNorm || str_contains($leftNorm, $rightNorm) || str_contains($rightNorm, $leftNorm)) {
            return true;
        }

        $leftTokens = $this->tokens($leftNorm);
        $rightTokens = $this->tokens($rightNorm);

        if ($leftTokens->isEmpty() || $rightTokens->isEmpty()) {
            return false;
        }

        $overlap = $leftTokens->intersect($rightTokens)->count();
        $smaller = min($leftTokens->count(), $rightTokens->count());

        return $smaller > 0 && ($overlap / $smaller) >= 0.6;
    }

    private function normalizeText(string $value): string
    {
        return trim((string) preg_replace('/\s+/', ' ', mb_strtolower((string) preg_replace('/[^[:alnum:]\s]/u', ' ', $value))));
    }

    /**
     * @return Collection<int, string>
     */
    private function tokens(string $value): Collection
    {
        return collect(preg_split('/\s+/', $value) ?: [])
            ->filter(fn (string $token) => mb_strlen($token) > 2)
            ->unique()
            ->values();
    }

    /**
     * @param  list<array<string, mixed>>  $checks
     * @return array<string, mixed>
     */
    private function result(array $checks, StudyDesignAsset $asset): array
    {
        $statuses = collect($checks)->pluck('status');

        $status = match (true) {
            $statuses->contains('fail') => StudyDesignVerificationStatus::BLOCKED->value,
            $statuses->contains('warn') => StudyDesignVerificationStatus::PARTIAL->value,
            default => StudyDesignVerificationStatus::VERIFIED->value,
        };

        $blockingReasons = collect($checks)
            ->where('status', 'fail')
            ->pluck('message')
            ->values()
            ->all();
        $warnings = collect($checks)
            ->where('status', 'warn')
            ->pluck('message')
            ->values()
            ->all();
        $canAccept = $status === StudyDesignVerificationStatus::VERIFIED->value;

        return [
            'status' => $status,
            'verified_at' => now()->toIso8601String(),
            'asset_type' => $asset->asset_type,
            'canonical_type' => $asset->canonical_type,
            'canonical_id' => $asset->canonical_id,
            'eligibility' => [
                'can_accept' => $canAccept,
                'can_materialize' => false,
                'reason' => $canAccept
                    ? 'Recommendation can be accepted for downstream Study Designer drafting.'
                    : 'Recommendation must be corrected, replaced, deferred, or rejected before downstream drafting.',
            ],
            'checks' => $checks,
            'blocking_reasons' => $blockingReasons,
            'warnings' => $warnings,
            'source_summary' => $this->sourceSummary($asset),
            'canonical_summary' => $this->canonicalSummary($asset),
            'accepted_downstream_actions' => $canAccept
                ? ['accept_recommendation', 'draft_concept_sets']
                : ['defer', 'reject'],
            'acceptance_policy' => 'Only verified assets may be accepted for downstream study design work.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function unsupportedAsset(StudyDesignAsset $asset): array
    {
        return $this->result([
            $this->check('asset_type', 'fail', "Blocked: no deterministic verifier is registered for {$asset->asset_type}."),
        ], $asset);
    }

    /**
     * @return array<string, mixed>
     */
    private function sourceSummary(StudyDesignAsset $asset): array
    {
        $provenance = $asset->provenance_json ?? [];

        return [
            'source' => $provenance['source'] ?? 'unknown',
            'matched_term' => $provenance['matched_term'] ?? null,
            'retrieved_at' => $provenance['retrieved_at'] ?? null,
            'ai_suggested' => ($provenance['source'] ?? null) === 'study-agent',
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function canonicalSummary(StudyDesignAsset $asset): ?array
    {
        if ($asset->canonical_type === null || $asset->canonical_id === null) {
            return null;
        }

        if (! is_subclass_of($asset->canonical_type, Model::class)) {
            return null;
        }

        /** @var class-string<Model> $canonicalType */
        $canonicalType = $asset->canonical_type;
        $record = $canonicalType::query()->find($asset->canonical_id);
        if (! $record instanceof Model) {
            return null;
        }

        $title = match (true) {
            $record instanceof PhenotypeLibraryEntry => $record->cohort_name,
            $record instanceof CohortDefinition => $record->name,
            $record instanceof ConceptSet => $record->name,
            default => null,
        };

        return [
            'type' => $asset->canonical_type,
            'id' => $asset->canonical_id,
            'title' => $title,
        ];
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function check(string $name, string $status, string $message, array $meta = []): array
    {
        $check = [
            'name' => $name,
            'status' => $status,
            'message' => $message,
        ];

        if ($meta !== []) {
            $check['meta'] = $meta;
        }

        return $check;
    }
}
