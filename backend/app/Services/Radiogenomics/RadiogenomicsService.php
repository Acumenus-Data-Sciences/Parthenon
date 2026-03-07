<?php

namespace App\Services\Radiogenomics;

use App\Models\App\GenomicVariant;
use App\Models\App\ImagingResponseAssessment;
use App\Models\App\VariantDrugInteraction;
use App\Services\Imaging\ImagingTimelineService;
use Illuminate\Support\Collection;

class RadiogenomicsService
{
    public function __construct(
        private readonly ImagingTimelineService $timelineService
    ) {}

    /**
     * Build a unified radiogenomics panel for a patient.
     *
     * @return array{person_id: int, demographics: array, variants: array, imaging: array, drug_exposures: array, correlations: array, recommendations: array}
     */
    public function getPatientPanel(int $personId, ?int $sourceId = null): array
    {
        // Fetch genomic variants
        $variants = GenomicVariant::where('person_id', $personId)
            ->orderByRaw("CASE WHEN clinvar_significance = 'Pathogenic' THEN 0 WHEN clinvar_significance LIKE 'Likely%' THEN 1 WHEN clinvar_significance = 'Uncertain significance' THEN 2 ELSE 3 END")
            ->orderBy('gene_symbol')
            ->get();

        // Fetch imaging timeline (includes studies, drugs, measurements)
        $timeline = $this->timelineService->getPatientTimeline($personId);

        // Fetch response assessments
        $assessments = ImagingResponseAssessment::where('person_id', $personId)
            ->with(['baselineStudy:id,study_date,modality', 'currentStudy:id,study_date,modality'])
            ->orderBy('assessment_date')
            ->get();

        // Build variant-drug correlations
        $correlations = $this->buildCorrelations($variants, $timeline['drug_exposures'], $assessments);

        // Generate precision recommendations
        $recommendations = $this->buildRecommendations($variants, $correlations);

        // Classify variants by actionability
        $actionable = $variants->filter(fn ($v) => $v->clinvar_significance === 'Pathogenic' || str_starts_with($v->clinvar_significance ?? '', 'Likely pathogenic'));
        $vus = $variants->filter(fn ($v) => $v->clinvar_significance === 'Uncertain significance');
        $other = $variants->diff($actionable)->diff($vus);

        return [
            'person_id' => $personId,
            'demographics' => $timeline['person'],
            'variants' => [
                'all' => $variants->toArray(),
                'actionable' => $actionable->pluck('gene_symbol', 'id')->toArray(),
                'vus' => $vus->pluck('gene_symbol', 'id')->toArray(),
                'other' => $other->pluck('gene_symbol', 'id')->toArray(),
                'total' => $variants->count(),
                'pathogenic_count' => $actionable->count(),
                'vus_count' => $vus->count(),
            ],
            'imaging' => [
                'studies' => $timeline['studies'],
                'measurements' => $timeline['measurements'],
                'summary' => $timeline['summary'],
                'response_assessments' => $assessments->toArray(),
            ],
            'drug_exposures' => $timeline['drug_exposures'],
            'correlations' => $correlations,
            'recommendations' => $recommendations,
        ];
    }

    /**
     * Build variant-drug-response correlations using the interaction database.
     *
     * @return array<int, array{variant_id: int, gene_symbol: string, hgvs_p: string|null, drug_name: string, relationship: string, mechanism: string|null, evidence_level: string, confidence: string, drug_start: string|null, drug_end: string|null, response_category: string|null, response_rationale: string|null}>
     */
    private function buildCorrelations(Collection $variants, array $drugExposures, Collection $assessments): array
    {
        $correlations = [];
        $drugNames = collect($drugExposures)->pluck('drug_name')->map(fn ($n) => strtolower($n))->toArray();

        foreach ($variants as $variant) {
            // Look up known interactions for this gene/variant
            $interactions = VariantDrugInteraction::where('gene_symbol', $variant->gene_symbol)
                ->where('is_active', true)
                ->where(function ($q) use ($variant) {
                    $q->where('hgvs_p', $variant->hgvs_p)
                        ->orWhereNull('hgvs_p'); // gene-level interactions (e.g., any KRAS activating mutation)
                })
                ->get();

            foreach ($interactions as $interaction) {
                // Check if the patient actually received this drug
                $matchedDrug = collect($drugExposures)->first(
                    fn ($d) => str_contains(strtolower($d['drug_name']), strtolower($interaction->drug_name))
                        || str_contains(strtolower($interaction->drug_name), strtolower($d['drug_name']))
                );

                // Find response assessment closest to drug exposure end
                $responseCategory = null;
                $responseRationale = null;
                if ($matchedDrug && $assessments->isNotEmpty()) {
                    $closest = $assessments->sortBy(function ($a) use ($matchedDrug) {
                        return abs(strtotime($a->assessment_date) - strtotime($matchedDrug['end_date'] ?? $matchedDrug['start_date']));
                    })->first();
                    if ($closest) {
                        $responseCategory = $closest->response_category;
                        $responseRationale = $closest->rationale;
                    }
                }

                $correlations[] = [
                    'variant_id' => $variant->id,
                    'gene_symbol' => $variant->gene_symbol,
                    'hgvs_p' => $variant->hgvs_p,
                    'clinvar_significance' => $variant->clinvar_significance,
                    'drug_name' => $interaction->drug_name,
                    'relationship' => $interaction->relationship,
                    'mechanism' => $interaction->mechanism,
                    'evidence_level' => $interaction->evidence_level,
                    'confidence' => $interaction->confidence,
                    'evidence_summary' => $interaction->evidence_summary,
                    'patient_received_drug' => $matchedDrug !== null,
                    'drug_start' => $matchedDrug['start_date'] ?? null,
                    'drug_end' => $matchedDrug['end_date'] ?? null,
                    'drug_days' => $matchedDrug['total_days'] ?? null,
                    'response_category' => $responseCategory,
                    'response_rationale' => $responseRationale,
                ];
            }
        }

        return $correlations;
    }

    /**
     * Generate precision oncology recommendations from variants + known interactions.
     *
     * @return array<int, array{gene: string, variant: string, recommendation_type: string, drugs_avoid: string[], drugs_consider: string[], rationale: string}>
     */
    private function buildRecommendations(Collection $variants, array $correlations): array
    {
        $recommendations = [];
        $pathogenicVariants = $variants->filter(fn ($v) => $v->clinvar_significance === 'Pathogenic');

        foreach ($pathogenicVariants as $variant) {
            $variantCorrelations = collect($correlations)->where('variant_id', $variant->id);

            $drugsAvoid = $variantCorrelations
                ->where('relationship', 'resistant')
                ->pluck('drug_name')
                ->unique()
                ->values()
                ->toArray();

            $drugsConsider = $variantCorrelations
                ->whereIn('relationship', ['sensitive', 'partial_response'])
                ->pluck('drug_name')
                ->unique()
                ->values()
                ->toArray();

            if (empty($drugsAvoid) && empty($drugsConsider)) {
                continue;
            }

            $rationale = $this->buildRationale($variant, $drugsAvoid, $drugsConsider, $variantCorrelations);

            $recommendations[] = [
                'gene' => $variant->gene_symbol,
                'variant' => $variant->hgvs_p ?? $variant->variant_class,
                'recommendation_type' => ! empty($drugsAvoid) ? 'avoid_and_consider' : 'consider',
                'drugs_avoid' => $drugsAvoid,
                'drugs_consider' => $drugsConsider,
                'rationale' => $rationale,
            ];
        }

        return $recommendations;
    }

    private function buildRationale(GenomicVariant $variant, array $avoid, array $consider, Collection $correlations): string
    {
        $parts = [];

        if (! empty($avoid)) {
            $resistantMechanisms = $correlations->where('relationship', 'resistant')->pluck('mechanism')->filter()->unique();
            $parts[] = sprintf(
                '%s %s confers resistance to %s.%s',
                $variant->gene_symbol,
                $variant->hgvs_p ?? $variant->variant_class,
                implode(', ', $avoid),
                $resistantMechanisms->isNotEmpty() ? ' Mechanism: '.$resistantMechanisms->implode('; ').'.' : ''
            );
        }

        if (! empty($consider)) {
            $parts[] = sprintf('Consider %s (potential sensitivity via %s pathway).', implode(', ', $consider), $variant->gene_symbol);
        }

        return implode(' ', $parts);
    }
}
