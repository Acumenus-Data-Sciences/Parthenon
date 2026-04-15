<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\PhenotypeLibraryEntry;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class StudyPhenotypeRecommendationService
{
    public function __construct(
        private readonly StudyDesignAssetVerificationService $verifier,
    ) {}

    /**
     * @return Collection<int, StudyDesignAsset>
     */
    public function recommend(StudyDesignSession $session, StudyDesignVersion $version, int $userId): Collection
    {
        $spec = $version->normalized_spec_json ?? $version->spec_json ?? [];
        $terms = $this->queryTerms($spec);
        $started = microtime(true);
        $remote = $this->studyAgentRecommendations($spec, $terms);

        $recommendations = collect()
            ->merge($remote)
            ->merge($this->phenotypeLibraryRecommendations($terms))
            ->merge($this->localCohortRecommendations($terms))
            ->merge($this->localConceptSetRecommendations($terms))
            ->unique(fn (array $item) => ($item['asset_type'] ?? '').':'.($item['canonical_type'] ?? '').':'.($item['canonical_id'] ?? '').':'.($item['payload']['external_id'] ?? ''))
            ->sortByDesc(fn (array $item) => $this->preRankRecommendation($item))
            ->take(12)
            ->values();

        return DB::transaction(function () use ($session, $version, $userId, $recommendations, $terms, $remote, $started): Collection {
            $session->assets()
                ->where('version_id', $version->id)
                ->whereIn('asset_type', ['phenotype_recommendation', 'local_cohort', 'local_concept_set'])
                ->where('status', StudyDesignAssetStatus::NEEDS_REVIEW->value)
                ->delete();

            $assets = $recommendations->map(function (array $item) use ($session, $version): StudyDesignAsset {
                $asset = StudyDesignAsset::create([
                    'session_id' => $session->id,
                    'version_id' => $version->id,
                    'asset_type' => $item['asset_type'],
                    'role' => $item['role'] ?? null,
                    'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
                    'draft_payload_json' => $item['payload'],
                    'canonical_type' => $item['canonical_type'] ?? null,
                    'canonical_id' => $item['canonical_id'] ?? null,
                    'provenance_json' => $item['provenance'] ?? [],
                ]);

                $verified = $this->verifier->verify($asset);
                $rank = $this->rankAsset($verified, $item);
                $verified->update([
                    'rank_score' => $rank['score'],
                    'rank_score_json' => $rank,
                ]);

                return $verified->fresh() ?? $verified;
            })->sortByDesc('rank_score')->values();

            StudyDesignAiEvent::create([
                'session_id' => $session->id,
                'version_id' => $version->id,
                'created_by' => $userId,
                'event_type' => 'phenotype_recommend',
                'provider' => 'study-agent',
                'model' => null,
                'prompt_template_version' => 'phenotype-recommend-v1',
                'input_summary_json' => [
                    'terms' => $terms,
                    'spec_hash' => hash('sha256', json_encode($version->normalized_spec_json ?? $version->spec_json)),
                ],
                'output_json' => [
                    'remote_count' => count($remote),
                    'recommendation_count' => $assets->count(),
                ],
                'safety_flags_json' => [],
                'latency_ms' => (int) round((microtime(true) - $started) * 1000),
            ]);

            return $assets->values();
        });
    }

    /**
     * @param  array<string, mixed>  $spec
     * @return list<string>
     */
    private function queryTerms(array $spec): array
    {
        $values = [
            data_get($spec, 'study.research_question'),
            data_get($spec, 'study.primary_objective'),
            data_get($spec, 'study.target_population_summary'),
            data_get($spec, 'pico.population.summary'),
            data_get($spec, 'pico.intervention_or_exposure.summary'),
            data_get($spec, 'pico.comparator.summary'),
            data_get($spec, 'pico.time.summary'),
        ];

        foreach ((array) data_get($spec, 'pico.outcomes', []) as $outcome) {
            $values[] = is_array($outcome) ? ($outcome['summary'] ?? null) : $outcome;
        }

        return collect($values)
            ->filter(fn (mixed $value) => is_string($value) && trim($value) !== '')
            ->map(fn (string $value) => trim($value))
            ->unique()
            ->take(8)
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $spec
     * @param  list<string>  $terms
     * @return list<array<string, mixed>>
     */
    private function studyAgentRecommendations(array $spec, array $terms): array
    {
        if ($terms === []) {
            return [];
        }

        try {
            $baseUrl = rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
            $response = Http::timeout(120)->post("{$baseUrl}/study-agent/recommend-phenotypes", [
                'description' => (string) data_get($spec, 'study.research_question', implode(' ', $terms)),
            ]);

            if ($response->failed()) {
                return [];
            }

            $items = $this->extractItems($response->json());

            return collect($items)->map(function (array $item): array {
                $externalId = $item['cohort_id'] ?? $item['id'] ?? null;
                $entry = $externalId ? PhenotypeLibraryEntry::where('cohort_id', (int) $externalId)->first() : null;

                return [
                    'asset_type' => 'phenotype_recommendation',
                    'role' => $item['role'] ?? null,
                    'canonical_type' => $entry ? PhenotypeLibraryEntry::class : null,
                    'canonical_id' => $entry?->id,
                    'payload' => [
                        'title' => (string) ($entry?->cohort_name ?? $item['cohort_name'] ?? $item['name'] ?? 'Recommended phenotype'),
                        'description' => $entry?->description ?? $item['description'] ?? null,
                        'logic_description' => $entry?->logic_description ?? $item['logic_description'] ?? null,
                        'external_id' => $externalId,
                        'score' => (float) ($item['score'] ?? $item['relevance_score'] ?? 0.75),
                        'domain' => $entry?->domain ?? $item['domain'] ?? null,
                        'severity' => $entry?->severity ?? $item['severity'] ?? null,
                        'has_expression' => (bool) ($entry?->expression_json ?? false),
                        'is_imported' => (bool) ($entry?->is_imported ?? false),
                        'imported_cohort_id' => $entry?->imported_cohort_id,
                        'rationale' => $item['rationale'] ?? 'Recommended by StudyAgent from the reviewed study intent.',
                    ],
                    'provenance' => [
                        'source' => 'study-agent',
                        'retrieved_at' => now()->toIso8601String(),
                    ],
                ];
            })->all();
        } catch (\Throwable $e) {
            Log::info('StudyAgent phenotype recommendation unavailable', ['message' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function extractItems(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $items = $payload['data']['recommendations']
            ?? $payload['data']['phenotypes']
            ?? $payload['recommendations']
            ?? $payload['phenotypes']
            ?? [];

        return is_array($items) ? array_values(array_filter($items, 'is_array')) : [];
    }

    /**
     * @param  list<string>  $terms
     * @return list<array<string, mixed>>
     */
    private function phenotypeLibraryRecommendations(array $terms): array
    {
        return collect($terms)
            ->flatMap(function (string $term) {
                return PhenotypeLibraryEntry::query()
                    ->where(function ($query) use ($term) {
                        $query->where('cohort_name', 'ilike', "%{$term}%")
                            ->orWhere('description', 'ilike', "%{$term}%")
                            ->orWhere('logic_description', 'ilike', "%{$term}%");
                    })
                    ->limit(4)
                    ->get()
                    ->map(fn (PhenotypeLibraryEntry $entry) => $this->phenotypeAsset($entry, $term));
            })
            ->values()
            ->all();
    }

    private function phenotypeAsset(PhenotypeLibraryEntry $entry, string $term): array
    {
        return [
            'asset_type' => 'phenotype_recommendation',
            'canonical_type' => PhenotypeLibraryEntry::class,
            'canonical_id' => $entry->id,
            'payload' => [
                'title' => $entry->cohort_name,
                'description' => $entry->description,
                'logic_description' => $entry->logic_description,
                'external_id' => $entry->cohort_id,
                'score' => $this->scoreText($term, $entry->cohort_name, $entry->description),
                'domain' => $entry->domain,
                'severity' => $entry->severity,
                'has_expression' => $entry->expression_json !== null,
                'is_imported' => $entry->is_imported,
                'imported_cohort_id' => $entry->imported_cohort_id,
                'rationale' => 'Matched against OHDSI PhenotypeLibrary metadata.',
            ],
            'provenance' => [
                'source' => 'phenotype_library',
                'matched_term' => $term,
                'retrieved_at' => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * @param  list<string>  $terms
     * @return list<array<string, mixed>>
     */
    private function localCohortRecommendations(array $terms): array
    {
        return collect($terms)
            ->flatMap(function (string $term) {
                return CohortDefinition::query()
                    ->active()
                    ->where(function ($query) use ($term) {
                        $query->where('name', 'ilike', "%{$term}%")
                            ->orWhere('description', 'ilike', "%{$term}%");
                    })
                    ->limit(3)
                    ->get()
                    ->map(fn (CohortDefinition $cohort) => [
                        'asset_type' => 'local_cohort',
                        'canonical_type' => CohortDefinition::class,
                        'canonical_id' => $cohort->id,
                        'payload' => [
                            'title' => $cohort->name,
                            'description' => $cohort->description,
                            'score' => $this->scoreText($term, $cohort->name, $cohort->description),
                            'has_expression' => $cohort->expression_json !== null,
                            'quality_tier' => $cohort->quality_tier,
                            'version' => $cohort->version,
                            'rationale' => 'Existing local cohort definition matched the reviewed study intent.',
                        ],
                        'provenance' => [
                            'source' => 'local_cohort_definitions',
                            'matched_term' => $term,
                            'retrieved_at' => now()->toIso8601String(),
                        ],
                    ]);
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<string>  $terms
     * @return list<array<string, mixed>>
     */
    private function localConceptSetRecommendations(array $terms): array
    {
        return collect($terms)
            ->flatMap(function (string $term) {
                return ConceptSet::query()
                    ->where(function ($query) use ($term) {
                        $query->where('name', 'ilike', "%{$term}%")
                            ->orWhere('description', 'ilike', "%{$term}%");
                    })
                    ->limit(3)
                    ->get()
                    ->map(fn (ConceptSet $conceptSet) => [
                        'asset_type' => 'local_concept_set',
                        'canonical_type' => ConceptSet::class,
                        'canonical_id' => $conceptSet->id,
                        'payload' => [
                            'title' => $conceptSet->name,
                            'description' => $conceptSet->description,
                            'score' => $this->scoreText($term, $conceptSet->name, $conceptSet->description),
                            'has_expression' => $conceptSet->expression_json !== null,
                            'is_public' => $conceptSet->is_public,
                            'rationale' => 'Existing local concept set matched the reviewed study intent.',
                        ],
                        'provenance' => [
                            'source' => 'local_concept_sets',
                            'matched_term' => $term,
                            'retrieved_at' => now()->toIso8601String(),
                        ],
                    ]);
            })
            ->values()
            ->all();
    }

    private function scoreText(string $term, string $title, ?string $description): float
    {
        $haystack = mb_strtolower($title.' '.($description ?? ''));
        $needle = mb_strtolower($term);

        if (str_contains($haystack, $needle)) {
            return 0.9;
        }

        $tokens = collect(preg_split('/\s+/', $needle) ?: [])
            ->filter(fn (string $token) => mb_strlen($token) > 3);
        $matches = $tokens->filter(fn (string $token) => str_contains($haystack, $token))->count();

        return min(0.85, 0.45 + ($matches * 0.1));
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function preRankRecommendation(array $item): float
    {
        $payload = (array) ($item['payload'] ?? []);
        $provenance = (array) ($item['provenance'] ?? []);
        $source = (string) ($provenance['source'] ?? '');
        $hasCanonical = ! empty($item['canonical_type']) && ! empty($item['canonical_id']);

        return ((float) ($payload['score'] ?? 0) * 20)
            + ($hasCanonical ? 20 : 0)
            + match ($source) {
                'local_cohort_definitions' => 15,
                'phenotype_library' => 14,
                'local_concept_sets' => 12,
                'study-agent' => $hasCanonical ? 10 : 0,
                default => 0,
            }
        + (! empty($payload['has_expression']) ? 10 : 0);
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function rankAsset(StudyDesignAsset $asset, array $item): array
    {
        $payload = $asset->draft_payload_json ?? [];
        $provenance = $asset->provenance_json ?? [];
        $source = (string) ($provenance['source'] ?? 'unknown');
        $verification = StudyDesignVerificationStatus::tryFrom((string) $asset->verification_status)
            ?? StudyDesignVerificationStatus::UNVERIFIED;
        $aiScore = (float) ($payload['score'] ?? 0);
        $hasExpression = (bool) ($payload['has_expression'] ?? false);
        $hasCanonical = $asset->canonical_type !== null && $asset->canonical_id !== null;

        $components = [
            'verification' => match ($verification) {
                StudyDesignVerificationStatus::VERIFIED => 45.0,
                StudyDesignVerificationStatus::PARTIAL => 10.0,
                StudyDesignVerificationStatus::BLOCKED => -60.0,
                StudyDesignVerificationStatus::UNVERIFIED => 0.0,
            },
            'source_quality' => match ($source) {
                'local_cohort_definitions' => 18.0,
                'phenotype_library' => 16.0,
                'local_concept_sets' => 14.0,
                'study-agent' => $hasCanonical ? 10.0 : 0.0,
                default => 2.0,
            },
            'computable_expression' => $hasExpression ? 12.0 : 0.0,
            'canonical_record' => $hasCanonical ? 10.0 : 0.0,
            'matched_text' => min(12.0, max(0.0, $aiScore * 12.0)),
            'role_hint' => ! empty($item['role'] ?? null) ? 3.0 : 0.0,
        ];

        $score = max(0.0, min(100.0, array_sum($components)));

        return [
            'score' => round($score, 3),
            'components' => $components,
            'source' => $source,
            'ai_score' => $aiScore,
            'verification_status' => $verification->value,
            'policy' => 'Deterministic rank score is separate from AI-provided score and cannot override verification blockers.',
        ];
    }
}
