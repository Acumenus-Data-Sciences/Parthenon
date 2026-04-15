<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\SelfControlledCohortAnalysis;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyDesignAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StudyAnalysisPlanMaterializer
{
    private const MODEL_BY_TYPE = [
        'characterization' => Characterization::class,
        'incidence_rate' => IncidenceRateAnalysis::class,
        'pathway' => PathwayAnalysis::class,
        'estimation' => EstimationAnalysis::class,
        'prediction' => PredictionAnalysis::class,
        'sccs' => SccsAnalysis::class,
        'self_controlled_cohort' => SelfControlledCohortAnalysis::class,
        'evidence_synthesis' => EvidenceSynthesisAnalysis::class,
    ];

    public function __construct(
        private readonly StudyAnalysisPlanVerifier $verifier,
    ) {}

    /**
     * @return array{analysis: Model, study_analysis: StudyAnalysis}
     */
    public function materialize(StudyDesignAsset $asset, int $userId): array
    {
        if ($asset->asset_type !== 'analysis_plan') {
            throw ValidationException::withMessages(['asset' => 'Only analysis plan assets can be materialized.']);
        }

        if ($asset->materialized_type !== null || $asset->materialized_id !== null) {
            throw ValidationException::withMessages(['asset' => 'This analysis plan has already been materialized.']);
        }

        if ($asset->verification_status === StudyDesignVerificationStatus::UNVERIFIED->value) {
            $asset = $this->verifier->verify($asset);
        }

        if ($asset->verification_status !== StudyDesignVerificationStatus::VERIFIED->value) {
            throw ValidationException::withMessages(['verification' => 'Only verified analysis plans can be materialized.']);
        }

        if ($asset->status !== StudyDesignAssetStatus::ACCEPTED->value) {
            throw ValidationException::withMessages(['asset' => 'Accept the verified analysis plan before materializing it.']);
        }

        $payload = $asset->draft_payload_json ?? [];
        $analysisType = (string) ($payload['analysis_type'] ?? '');
        $modelClass = self::MODEL_BY_TYPE[$analysisType] ?? null;

        if ($modelClass === null) {
            throw ValidationException::withMessages(['analysis_type' => 'Analysis plan type is not supported for materialization.']);
        }

        return DB::transaction(function () use ($asset, $userId, $payload, $modelClass): array {
            $analysis = $modelClass::create([
                'name' => (string) ($payload['title'] ?? 'Study Designer analysis plan'),
                'description' => $payload['description'] ?? null,
                'design_json' => $payload['design_json'] ?? [],
                'author_id' => $userId,
            ]);

            $studyAnalysis = StudyAnalysis::create([
                'study_id' => $asset->session->study_id,
                'analysis_type' => $modelClass,
                'analysis_id' => $analysis->id,
            ]);

            $asset->update([
                'status' => StudyDesignAssetStatus::MATERIALIZED->value,
                'materialized_type' => $modelClass,
                'materialized_id' => $analysis->id,
                'materialized_at' => now(),
            ]);

            return [
                'analysis' => $analysis->fresh('author:id,name,email') ?? $analysis,
                'study_analysis' => $studyAnalysis->fresh('analysis') ?? $studyAnalysis,
            ];
        });
    }
}
