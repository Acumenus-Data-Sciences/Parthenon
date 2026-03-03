<?php

namespace App\Providers;

use App\Services\Cohort\Builders\CensoringBuilder;
use App\Services\Cohort\Builders\ConceptSetSqlBuilder;
use App\Services\Cohort\Builders\EndStrategyBuilder;
use App\Services\Cohort\Builders\InclusionCriteriaBuilder;
use App\Services\Cohort\Builders\OccurrenceFilterBuilder;
use App\Services\Cohort\Builders\PrimaryCriteriaBuilder;
use App\Services\Cohort\Builders\TemporalWindowBuilder;
use App\Services\Cohort\CohortGenerationService;
use App\Services\Cohort\CohortSqlCompiler;
use App\Services\Cohort\Criteria\CriteriaBuilderRegistry;
use App\Services\Cohort\Criteria\DemographicCriteriaBuilder;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use App\Services\AI\AbbyAiService;
use App\Services\Analysis\CareGapService;
use App\Services\Analysis\CharacterizationService;
use App\Services\Analysis\EstimationService;
use App\Services\Analysis\IncidenceRateService;
use App\Services\Analysis\PathwayService;
use App\Services\Analysis\PatientProfileService;
use App\Services\Analysis\PredictionService;
use App\Services\Analysis\StudyService;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SqlRendererService::class);

        // AI services
        $this->app->singleton(AbbyAiService::class);

        // Analysis services
        $this->app->singleton(CareGapService::class);
        $this->app->singleton(CharacterizationService::class);
        $this->app->singleton(IncidenceRateService::class);
        $this->app->singleton(PathwayService::class);
        $this->app->singleton(PatientProfileService::class);
        $this->app->singleton(EstimationService::class);
        $this->app->singleton(PredictionService::class);
        $this->app->singleton(StudyService::class);

        // Cohort SQL Compiler services
        $this->app->singleton(CohortExpressionSchema::class);
        $this->app->singleton(CriteriaBuilderRegistry::class);
        $this->app->singleton(DemographicCriteriaBuilder::class);
        $this->app->singleton(ConceptSetSqlBuilder::class);
        $this->app->singleton(TemporalWindowBuilder::class);
        $this->app->singleton(OccurrenceFilterBuilder::class);
        $this->app->singleton(EndStrategyBuilder::class);

        $this->app->singleton(PrimaryCriteriaBuilder::class, function ($app) {
            return new PrimaryCriteriaBuilder(
                $app->make(CriteriaBuilderRegistry::class),
                $app->make(CohortExpressionSchema::class),
            );
        });

        $this->app->singleton(InclusionCriteriaBuilder::class, function ($app) {
            return new InclusionCriteriaBuilder(
                $app->make(CriteriaBuilderRegistry::class),
                $app->make(CohortExpressionSchema::class),
                $app->make(TemporalWindowBuilder::class),
                $app->make(OccurrenceFilterBuilder::class),
                $app->make(DemographicCriteriaBuilder::class),
            );
        });

        $this->app->singleton(CensoringBuilder::class, function ($app) {
            return new CensoringBuilder(
                $app->make(CriteriaBuilderRegistry::class),
                $app->make(CohortExpressionSchema::class),
            );
        });

        $this->app->singleton(CohortSqlCompiler::class, function ($app) {
            return new CohortSqlCompiler(
                $app->make(SqlRendererService::class),
                $app->make(CohortExpressionSchema::class),
                $app->make(ConceptSetSqlBuilder::class),
                $app->make(PrimaryCriteriaBuilder::class),
                $app->make(InclusionCriteriaBuilder::class),
                $app->make(CensoringBuilder::class),
                $app->make(EndStrategyBuilder::class),
            );
        });

        $this->app->singleton(CohortGenerationService::class, function ($app) {
            return new CohortGenerationService(
                $app->make(CohortSqlCompiler::class),
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Auto-configure Resend mail transport from .resendapikey file at project root.
        // Mimics the lazy-key-loading pattern from the authregime.
        // If no key is present, falls back to the MAIL_MAILER setting in .env (default: log).
        $keyFile = base_path('../../.resendapikey');
        $key = is_readable($keyFile) ? trim((string) file_get_contents($keyFile)) : '';

        if ($key !== '') {
            config([
                'mail.default'                    => 'resend',
                'mail.mailers.resend.transport'   => 'resend',
                'resend.api_key'                  => $key,
            ]);
        }
    }
}
