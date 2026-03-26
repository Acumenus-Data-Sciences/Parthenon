<?php

namespace App\Providers;

use App\Events\AchillesRunCompleted;
use App\Events\DqdRunCompleted;
use App\Events\ReleaseCreated;
use App\Listeners\AssociateDqdWithRelease;
use App\Listeners\ComputeDqDeltas;
use App\Listeners\CreateAutoAnnotation;
use App\Listeners\CreateAutoRelease;
use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EtlProject;
use App\Models\App\IngestionProject;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\HeorAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\Study;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyCohort;
use App\Models\App\StudyComment;
use App\Models\App\StudyExecution;
use App\Models\App\StudyMilestone;
use App\Models\App\StudyResult;
use App\Models\App\StudySite;
use App\Models\App\StudySynthesis;
use App\Models\App\StudyTeamMember;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use App\Observers\CohortDefinitionObserver;
use App\Observers\DesignProtection\CharacterizationProtectionObserver;
use App\Observers\DesignProtection\CohortDefinitionProtectionObserver;
use App\Observers\DesignProtection\ConceptSetProtectionObserver;
use App\Observers\DesignProtection\EstimationAnalysisProtectionObserver;
use App\Observers\DesignProtection\EvidenceSynthesisAnalysisProtectionObserver;
use App\Observers\DesignProtection\HeorAnalysisProtectionObserver;
use App\Observers\DesignProtection\IncidenceRateAnalysisProtectionObserver;
use App\Observers\DesignProtection\PathwayAnalysisProtectionObserver;
use App\Observers\DesignProtection\PredictionAnalysisProtectionObserver;
use App\Observers\DesignProtection\SccsAnalysisProtectionObserver;
use App\Observers\StudyObserver;
use App\Observers\StudySubResourceObserver;
use App\Policies\Commons\ChannelPolicy;
use App\Policies\Commons\MessagePolicy;
use App\Policies\EtlProjectPolicy;
use App\Policies\IngestionProjectPolicy;
use App\Services\AI\AbbyAiService;
use App\Services\Analysis\CareGapService;
use App\Services\Analysis\CharacterizationService;
use App\Services\Analysis\EstimationService;
use App\Services\Analysis\IncidenceRateService;
use App\Services\Analysis\PathwayService;
use App\Services\Analysis\PatientProfileService;
use App\Services\Analysis\PredictionService;
use App\Services\Analysis\StudyService;
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
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageManagerInterface;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SqlRendererService::class);

        // Image processing (Intervention Image v3 with GD driver)
        $this->app->singleton(ImageManagerInterface::class, fn () => ImageManager::gd());

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
        // Check multiple possible locations for the Resend API key file:
        // 1. Docker mount at /var/www/.resendapikey (mounted from repo root)
        // 2. Repo root relative to backend dir (local dev without Docker)
        $keyFile = null;
        foreach (['/var/www/.resendapikey', base_path('../.resendapikey')] as $candidate) {
            if (is_readable($candidate)) {
                $keyFile = $candidate;
                break;
            }
        }
        $key = $keyFile ? trim((string) file_get_contents($keyFile)) : '';

        if ($key !== '') {
            config([
                'mail.default' => 'resend',
                'mail.mailers.resend.transport' => 'resend',
                'services.resend.key' => $key,
            ]);
        }

        // Ares event → listener mappings
        Event::listen(AchillesRunCompleted::class, CreateAutoRelease::class);
        Event::listen(DqdRunCompleted::class, AssociateDqdWithRelease::class);
        Event::listen(ReleaseCreated::class, ComputeDqDeltas::class);
        Event::listen(ReleaseCreated::class, CreateAutoAnnotation::class);
        Event::listen(DqdRunCompleted::class, CreateAutoAnnotation::class);

        // Commons policies
        Gate::policy(Channel::class, ChannelPolicy::class);
        Gate::policy(Message::class, MessagePolicy::class);

        // Aqueduct ETL policies
        Gate::policy(EtlProject::class, EtlProjectPolicy::class);

        // Ingestion project policies
        Gate::policy(IngestionProject::class, IngestionProjectPolicy::class);

        // Model observers — activity logging + Solr delta indexing
        CohortDefinition::observe(CohortDefinitionObserver::class);
        Study::observe(StudyObserver::class);

        $subResourceModels = [
            StudySite::class,
            StudyTeamMember::class,
            StudyCohort::class,
            StudyExecution::class,
            StudyResult::class,
            StudySynthesis::class,
            StudyArtifact::class,
            StudyMilestone::class,
            StudyComment::class,
        ];

        foreach ($subResourceModels as $model) {
            $model::observe(StudySubResourceObserver::class);
        }

        // Design Protection observers — audit log + fixture export for all 10 design entity types
        CohortDefinition::observe(CohortDefinitionProtectionObserver::class);
        ConceptSet::observe(ConceptSetProtectionObserver::class);
        Characterization::observe(CharacterizationProtectionObserver::class);
        EstimationAnalysis::observe(EstimationAnalysisProtectionObserver::class);
        PredictionAnalysis::observe(PredictionAnalysisProtectionObserver::class);
        SccsAnalysis::observe(SccsAnalysisProtectionObserver::class);
        IncidenceRateAnalysis::observe(IncidenceRateAnalysisProtectionObserver::class);
        PathwayAnalysis::observe(PathwayAnalysisProtectionObserver::class);
        EvidenceSynthesisAnalysis::observe(EvidenceSynthesisAnalysisProtectionObserver::class);
        HeorAnalysis::observe(HeorAnalysisProtectionObserver::class);
    }
}
