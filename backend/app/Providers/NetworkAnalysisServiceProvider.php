<?php

namespace App\Providers;

use App\Services\Network\Analyses\NA001ConditionPrevalence;
use App\Services\Network\Analyses\NA002DemographicParity;
use App\Services\Network\Analyses\NA003DataDensityFingerprint;
use App\Services\Network\Analyses\NA004DomainCoverageCompleteness;
use App\Services\Network\Analyses\NA005VocabularyUsage;
use App\Services\Network\Analyses\NA006TemporalDistribution;
use App\Services\Network\Analyses\NA007RiskScoreComparison;
use App\Services\Network\Analyses\NA008HeterogeneityIndex;
use App\Services\Network\NetworkAnalysisRegistry;
use Illuminate\Support\ServiceProvider;

class NetworkAnalysisServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(NetworkAnalysisRegistry::class, function () {
            $registry = new NetworkAnalysisRegistry;

            // ── Prevalence ───────────────────────────────────────────────────
            foreach ([
                new NA001ConditionPrevalence,
            ] as $a) {
                $registry->register($a);
            }

            // ── Demographics ─────────────────────────────────────────────────
            foreach ([
                new NA002DemographicParity,
            ] as $a) {
                $registry->register($a);
            }

            // ── Coverage ─────────────────────────────────────────────────────
            foreach ([
                new NA003DataDensityFingerprint,
                new NA004DomainCoverageCompleteness,
                new NA005VocabularyUsage,
                new NA006TemporalDistribution,
            ] as $a) {
                $registry->register($a);
            }

            // ── Risk ─────────────────────────────────────────────────────────
            foreach ([
                new NA007RiskScoreComparison,
            ] as $a) {
                $registry->register($a);
            }

            // ── Heterogeneity ────────────────────────────────────────────────
            foreach ([
                new NA008HeterogeneityIndex,
            ] as $a) {
                $registry->register($a);
            }

            return $registry;
        });
    }

    public function boot(): void {}
}
