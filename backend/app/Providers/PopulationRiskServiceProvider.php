<?php

namespace App\Providers;

use App\Services\PopulationRisk\ConceptResolutionService;
use App\Services\PopulationRisk\PatientFeatureExtractor;
use App\Services\PopulationRisk\PopulationRiskScoreRegistry;
use App\Services\PopulationRisk\RiskScoreExecutionService;
use App\Services\PopulationRisk\RiskScoreRecommendationService;
use App\Services\PopulationRisk\Scores\RS001FraminghamRiskScore;
use App\Services\PopulationRisk\Scores\RS002PooledCohortEquations;
use App\Services\PopulationRisk\Scores\RS003CHA2DS2VASc;
use App\Services\PopulationRisk\Scores\RS004HASBLED;
use App\Services\PopulationRisk\Scores\RS005CharlsonComorbidityIndex;
use App\Services\PopulationRisk\Scores\RS006ElixhauserIndex;
use App\Services\PopulationRisk\Scores\RS007MELDScore;
use App\Services\PopulationRisk\Scores\RS008ChildPughScore;
use App\Services\PopulationRisk\Scores\RS009RevisedCardiacRiskIndex;
use App\Services\PopulationRisk\Scores\RS010CURB65;
use App\Services\PopulationRisk\Scores\RS011DiabetesComplicationsSeverity;
use App\Services\PopulationRisk\Scores\RS012SCORE2;
use App\Services\PopulationRisk\Scores\RS013FIB4Index;
use App\Services\PopulationRisk\Scores\RS014MetabolicSyndrome;
use App\Services\PopulationRisk\Scores\RS015TIMIRiskScore;
use App\Services\PopulationRisk\Scores\RS016FRAXFractureRisk;
use App\Services\PopulationRisk\Scores\RS017GRACEScore;
use App\Services\PopulationRisk\Scores\RS018STOPBANGApnea;
use App\Services\PopulationRisk\Scores\RS019CHADS2Score;
use App\Services\PopulationRisk\Scores\RS020MultimorbidityBurden;
use App\Services\PopulationRisk\V2Scores\RS005CharlsonV2;
use Illuminate\Support\ServiceProvider;

class PopulationRiskServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ConceptResolutionService::class);
        $this->app->singleton(PatientFeatureExtractor::class);

        $this->app->singleton(RiskScoreRecommendationService::class, function ($app) {
            $service = new RiskScoreRecommendationService($app->make(ConceptResolutionService::class));
            $service->registerV2Score(new RS005CharlsonV2);

            return $service;
        });

        $this->app->singleton(RiskScoreExecutionService::class, function ($app) {
            $service = new RiskScoreExecutionService(
                $app->make(PatientFeatureExtractor::class),
                $app->make(ConceptResolutionService::class),
            );
            $service->registerV2Score(new RS005CharlsonV2);

            return $service;
        });

        $this->app->singleton(PopulationRiskScoreRegistry::class, function () {
            $registry = new PopulationRiskScoreRegistry;

            // ── Cardiovascular ──────────────────────────────────────────────────────────
            foreach ([
                new RS001FraminghamRiskScore,
                new RS002PooledCohortEquations,
                new RS003CHA2DS2VASc,
                new RS004HASBLED,
                new RS009RevisedCardiacRiskIndex,
                new RS012SCORE2,
                new RS015TIMIRiskScore,
                new RS017GRACEScore,
                new RS019CHADS2Score,
            ] as $score) {
                $registry->register($score);
            }

            // ── Comorbidity Burden ──────────────────────────────────────────────────────
            foreach ([
                new RS005CharlsonComorbidityIndex,
                new RS006ElixhauserIndex,
                new RS020MultimorbidityBurden,
            ] as $score) {
                $registry->register($score);
            }

            // ── Hepatic ─────────────────────────────────────────────────────────────────
            foreach ([
                new RS007MELDScore,
                new RS008ChildPughScore,
                new RS013FIB4Index,
            ] as $score) {
                $registry->register($score);
            }

            // ── Pulmonary ───────────────────────────────────────────────────────────────
            foreach ([
                new RS010CURB65,
                new RS018STOPBANGApnea,
            ] as $score) {
                $registry->register($score);
            }

            // ── Metabolic / Endocrine ───────────────────────────────────────────────────
            foreach ([
                new RS011DiabetesComplicationsSeverity,
                new RS014MetabolicSyndrome,
            ] as $score) {
                $registry->register($score);
            }

            // ── Musculoskeletal ─────────────────────────────────────────────────────────
            foreach ([
                new RS016FRAXFractureRisk,
            ] as $score) {
                $registry->register($score);
            }

            return $registry;
        });
    }

    public function boot(): void {}
}
