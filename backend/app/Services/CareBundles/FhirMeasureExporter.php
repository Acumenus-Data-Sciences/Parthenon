<?php

namespace App\Services\CareBundles;

use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;

/**
 * Export a ConditionBundle as a FHIR R4 Measure resource (library-style, one
 * group per QualityMeasure in the bundle).
 *
 * This is a pragmatic serializer — the output passes basic FHIR Measure
 * cardinality checks but does NOT include a full executable CQL library
 * (Phase 3b concern). Instead, criteria are expressed as structured OMOP
 * concept-set references in the `expression` field, flagged with
 * `language=text/omop-concept-set-ids`. Consumers that understand this
 * dialect can execute; generic FHIR validators accept the Measure as
 * a well-formed draft resource.
 *
 * Reference: https://hl7.org/fhir/R4/measure.html
 */
class FhirMeasureExporter
{
    /**
     * @return array<string, mixed>
     */
    public function exportBundle(ConditionBundle $bundle): array
    {
        $bundle->loadMissing('measures');

        $id = $this->slug($bundle->bundle_code);
        $baseUrl = rtrim((string) config('care_bundles.fhir.base_url'), '/');
        $canonical = "{$baseUrl}/Measure/{$id}";

        return [
            'resourceType' => 'Measure',
            'id' => $id,
            'url' => $canonical,
            'identifier' => [[
                'system' => "{$baseUrl}/bundle-code",
                'value' => $bundle->bundle_code,
            ]],
            'version' => (string) ($bundle->updated_at?->timestamp ?? '1'),
            'name' => $this->pascalize($bundle->bundle_code),
            'title' => $bundle->condition_name,
            'status' => $bundle->is_active ? 'active' : 'retired',
            'experimental' => false,
            'date' => ($bundle->updated_at ?? now())->toIso8601String(),
            'publisher' => (string) config('care_bundles.fhir.publisher'),
            'description' => (string) ($bundle->description ?? $bundle->condition_name),
            'topic' => $bundle->disease_category
                ? [[
                    'coding' => [[
                        'system' => "{$baseUrl}/disease-category",
                        'code' => $bundle->disease_category,
                        'display' => ucfirst((string) $bundle->disease_category),
                    ]],
                ]]
                : [],
            'scoring' => [
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/measure-scoring',
                    'code' => 'proportion',
                    'display' => 'Proportion',
                ]],
            ],
            'type' => [[
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/measure-type',
                    'code' => 'process',
                    'display' => 'Process',
                ]],
            ]],
            'useContext' => [
                [
                    'code' => [
                        'system' => 'http://terminology.hl7.org/CodeSystem/usage-context-type',
                        'code' => 'focus',
                    ],
                    'valueCodeableConcept' => [
                        'coding' => array_map(
                            fn (int $conceptId) => [
                                'system' => 'http://omop.org/concept',
                                'code' => (string) $conceptId,
                            ],
                            (array) ($bundle->omop_concept_ids ?? []),
                        ),
                    ],
                ],
            ],
            'group' => $bundle->measures
                ->map(fn (QualityMeasure $m) => $this->renderGroup($bundle, $m))
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function exportMeasure(ConditionBundle $bundle, QualityMeasure $measure): array
    {
        $id = $this->slug($measure->measure_code);
        $baseUrl = rtrim((string) config('care_bundles.fhir.base_url'), '/');

        return [
            'resourceType' => 'Measure',
            'id' => $id,
            'url' => "{$baseUrl}/Measure/{$id}",
            'identifier' => [[
                'system' => "{$baseUrl}/measure-code",
                'value' => $measure->measure_code,
            ]],
            'version' => (string) ($measure->updated_at?->timestamp ?? '1'),
            'name' => $this->pascalize($measure->measure_code),
            'title' => $measure->measure_name,
            'status' => $measure->is_active ? 'active' : 'retired',
            'experimental' => false,
            'date' => ($measure->updated_at ?? now())->toIso8601String(),
            'publisher' => (string) config('care_bundles.fhir.publisher'),
            'description' => (string) ($measure->description ?? $measure->measure_name),
            'scoring' => [
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/measure-scoring',
                    'code' => 'proportion',
                    'display' => 'Proportion',
                ]],
            ],
            'type' => [[
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/measure-type',
                    'code' => $this->measureTypeCode($measure->measure_type),
                ]],
            ]],
            'group' => [$this->renderGroup($bundle, $measure)],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function renderGroup(ConditionBundle $bundle, QualityMeasure $measure): array
    {
        $population = [
            $this->renderPopulation(
                id: "{$measure->measure_code}-initial-population",
                code: 'initial-population',
                display: 'Initial Population',
                description: "Patients qualifying for bundle {$bundle->bundle_code}.",
                concepts: (array) ($bundle->omop_concept_ids ?? []),
                lookbackDays: null,
            ),
            $this->renderPopulation(
                id: "{$measure->measure_code}-denominator",
                code: 'denominator',
                display: 'Denominator',
                description: "Patients eligible for {$measure->measure_name}.",
                concepts: (array) ($measure->denominator_criteria['concept_ids'] ?? []),
                lookbackDays: $measure->denominator_criteria['lookback_days'] ?? null,
            ),
            $this->renderPopulation(
                id: "{$measure->measure_code}-numerator",
                code: 'numerator',
                display: 'Numerator',
                description: "Patients meeting the compliance criterion for {$measure->measure_name}.",
                concepts: (array) ($measure->numerator_criteria['concept_ids'] ?? []),
                lookbackDays: $measure->numerator_criteria['lookback_days'] ?? null,
            ),
        ];

        $exclusionConcepts = (array) ($measure->exclusion_criteria['concept_ids'] ?? []);
        if (! empty($exclusionConcepts)) {
            $population[] = $this->renderPopulation(
                id: "{$measure->measure_code}-denominator-exclusion",
                code: 'denominator-exclusion',
                display: 'Denominator Exclusion',
                description: "Patients excluded from {$measure->measure_name}.",
                concepts: $exclusionConcepts,
                lookbackDays: $measure->exclusion_criteria['lookback_days'] ?? null,
            );
        }

        return [
            'id' => $this->slug($measure->measure_code),
            'description' => $measure->description ?? $measure->measure_name,
            'code' => [
                'coding' => [[
                    'system' => 'http://parthenon.local/measure-code',
                    'code' => $measure->measure_code,
                    'display' => $measure->measure_name,
                ]],
            ],
            'population' => $population,
        ];
    }

    /**
     * @param  list<int>  $concepts
     * @return array<string, mixed>
     */
    private function renderPopulation(
        string $id,
        string $code,
        string $display,
        string $description,
        array $concepts,
        ?int $lookbackDays,
    ): array {
        $expressionPayload = [
            'concept_ids' => array_values(array_map('intval', $concepts)),
        ];
        if ($lookbackDays !== null) {
            $expressionPayload['lookback_days'] = $lookbackDays;
        }

        return [
            'id' => $id,
            'code' => [
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/measure-population',
                    'code' => $code,
                    'display' => $display,
                ]],
            ],
            'description' => $description,
            'criteria' => [
                // Custom dialect — consumers that understand Parthenon's
                // concept-set-id flavor can execute directly; Phase 3b will
                // emit executable CQL once the runtime lands.
                'language' => 'text/omop-concept-set-ids',
                'expression' => json_encode($expressionPayload, JSON_UNESCAPED_SLASHES),
            ],
        ];
    }

    private function measureTypeCode(?string $internal): string
    {
        return match ($internal) {
            'preventive' => 'outcome',
            'chronic' => 'process',
            'behavioral' => 'patient-reported-outcome',
            default => 'process',
        };
    }

    private function slug(string $code): string
    {
        $slug = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $code) ?? $code);

        return trim($slug, '-');
    }

    private function pascalize(string $code): string
    {
        $parts = preg_split('/[^A-Za-z0-9]+/', $code) ?: [];

        return implode('', array_map(ucfirst(...), array_filter($parts)));
    }
}
