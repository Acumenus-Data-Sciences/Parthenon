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
use App\Services\PopulationRisk\V2Scores\RS001FraminghamV2;
use App\Services\PopulationRisk\V2Scores\RS002PooledCohortV2;
use App\Services\PopulationRisk\V2Scores\RS003CHA2DS2VASc_V2;
use App\Services\PopulationRisk\V2Scores\RS004HASBLED_V2;
use App\Services\PopulationRisk\V2Scores\RS005CharlsonV2;
use App\Services\PopulationRisk\V2Scores\RS006ElixhauserV2;
use App\Services\PopulationRisk\V2Scores\RS007MELDV2;
use App\Services\PopulationRisk\V2Scores\RS008ChildPughV2;
use App\Services\PopulationRisk\V2Scores\RS009RCRIV2;
use App\Services\PopulationRisk\V2Scores\RS010CURB65V2;
use App\Services\PopulationRisk\V2Scores\RS011DCSIV2;
use App\Services\PopulationRisk\V2Scores\RS012SCORE2V2;
use App\Services\PopulationRisk\V2Scores\RS013FIB4V2;
use App\Services\PopulationRisk\V2Scores\RS014MetabolicSyndromeV2;
use App\Services\PopulationRisk\V2Scores\RS015TIMIV2;
use App\Services\PopulationRisk\V2Scores\RS016FRAXV2;
use App\Services\PopulationRisk\V2Scores\RS017GRACEV2;
use App\Services\PopulationRisk\V2Scores\RS018STOPBANGV2;
use App\Services\PopulationRisk\V2Scores\RS019CHADS2V2;
use App\Services\PopulationRisk\V2Scores\RS020MultimorbidityV2;
use Illuminate\Support\ServiceProvider;

class PopulationRiskServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ConceptResolutionService::class);
        $this->app->singleton(PatientFeatureExtractor::class);

        // All 20 v2 score instances (shared between execution + recommendation services)
        $this->app->singleton('risk-score.v2-instances', function () {
            return [
                new RS001FraminghamV2,
                new RS002PooledCohortV2,
                new RS003CHA2DS2VASc_V2,
                new RS004HASBLED_V2,
                new RS005CharlsonV2,
                new RS006ElixhauserV2,
                new RS007MELDV2,
                new RS008ChildPughV2,
                new RS009RCRIV2,
                new RS010CURB65V2,
                new RS011DCSIV2,
                new RS012SCORE2V2,
                new RS013FIB4V2,
                new RS014MetabolicSyndromeV2,
                new RS015TIMIV2,
                new RS016FRAXV2,
                new RS017GRACEV2,
                new RS018STOPBANGV2,
                new RS019CHADS2V2,
                new RS020MultimorbidityV2,
            ];
        });

        $this->app->singleton(RiskScoreRecommendationService::class, function ($app) {
            $service = new RiskScoreRecommendationService($app->make(ConceptResolutionService::class));
            foreach ($app->make('risk-score.v2-instances') as $score) {
                $service->registerV2Score($score);
            }

            return $service;
        });

        $this->app->singleton(RiskScoreExecutionService::class, function ($app) {
            $service = new RiskScoreExecutionService(
                $app->make(PatientFeatureExtractor::class),
                $app->make(ConceptResolutionService::class),
            );
            foreach ($app->make('risk-score.v2-instances') as $score) {
                $service->registerV2Score($score);
            }

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
