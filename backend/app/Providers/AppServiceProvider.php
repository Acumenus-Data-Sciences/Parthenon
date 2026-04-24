<?php

namespace App\Providers;

use App\Context\SourceContext;
use App\Contracts\TranslationProviderInterface;
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
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\HeorAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\IngestionProject;
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
use App\Observers\FinnGen\FinnGenGwasRunObserver;
use App\Observers\FinnGen\GwasCovariateSetObserver;
use App\Observers\StudyObserver;
use App\Observers\StudySubResourceObserver;
use App\Policies\Commons\ChannelPolicy;
use App\Policies\Commons\MessagePolicy;
use App\Policies\EtlProjectPolicy;
use App\Policies\FinnGen\RunPolicy as FinnGenRunPolicy;
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
use App\Services\Auth\Oidc\OidcDiscoveryService;
use App\Services\Auth\Oidc\OidcHandshakeStore;
use App\Services\Auth\Oidc\OidcReconciliationService;
use App\Services\Auth\Oidc\OidcTokenValidator;
use App\Services\CareBundles\CareBundleMaterializationService;
use App\Services\CareBundles\CareBundleMeasureEvaluator;
use App\Services\CareBundles\CareBundleQualificationService;
use App\Services\CareBundles\Evaluators\CohortBasedMeasureEvaluator;
use App\Services\CareBundles\Evaluators\CqlMeasureEvaluator;
use App\Services\Cohort\Builders\CensoringBuilder;
use App\Services\Cohort\Builders\ConceptSetSqlBuilder;
use App\Services\Cohort\Builders\EndStrategyBuilder;
use App\Services\Cohort\Builders\InclusionCriteriaBuilder;
use App\Services\Cohort\Builders\OccurrenceFilterBuilder;
use App\Services\Cohort\Builders\PrimaryCriteriaBuilder;
use App\Services\Cohort\Builders\RiskScoreCriteriaBuilder;
use App\Services\Cohort\Builders\TemporalWindowBuilder;
use App\Services\Cohort\CohortGenerationService;
use App\Services\Cohort\CohortSqlCompiler;
use App\Services\Cohort\Criteria\CriteriaBuilderRegistry;
use App\Services\Cohort\Criteria\DemographicCriteriaBuilder;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use App\Services\FinnGen\FinnGenArtifactService;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenIdempotencyStore;
use App\Services\FinnGen\GencodeService;
use App\Services\FinnGen\ManhattanAggregationService;
use App\Services\SqlRenderer\SqlRendererService;
use App\Services\Translation\PlaceholderIntegrityService;
use App\Services\Translation\Providers\LocalFileTranslationProvider;
use App\Services\Translation\TranslationPolicyService;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageManagerInterface;
use Pest\TestSuite;
use PHPUnit\Framework\TestCase as PhpUnitTestCase;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(SourceContext::class, fn () => new SourceContext);

        $this->app->singleton(SqlRendererService::class);

        // OIDC services — feature-flagged; only wired when config('services.oidc.enabled') is true.
        $this->app->singleton(OidcDiscoveryService::class, fn ($app) => new OidcDiscoveryService(
            (string) config('services.oidc.discovery_url')
        ));
        $this->app->singleton(OidcTokenValidator::class, fn ($app) => new OidcTokenValidator(
            $app->make(OidcDiscoveryService::class),
            (string) config('services.oidc.client_id')
        ));
        $this->app->singleton(OidcReconciliationService::class, fn ($app) => new OidcReconciliationService(
            (array) config('services.oidc.allowed_groups', ['Parthenon Admins'])
        ));
        $this->app->singleton(OidcHandshakeStore::class);

        // Image processing (Intervention Image v3 with GD driver)
        $this->app->singleton(ImageManagerInterface::class, fn () => ImageManager::gd());

        // AI services
        $this->app->singleton(AbbyAiService::class);

        // Translation services
        $this->app->singleton(PlaceholderIntegrityService::class);
        $this->app->singleton(TranslationPolicyService::class);
        $this->app->singleton(LocalFileTranslationProvider::class);
        $this->app->singleton(TranslationProviderInterface::class, function ($app) {
            $provider = (string) config('translation.primary', 'local');
            $providerClass = config("translation.providers.{$provider}.class", LocalFileTranslationProvider::class);

            return $app->make($providerClass);
        });

        // CareBundles Workbench — config-driven evaluator binding.
        // Default: cohort_based (direct SQL). Phase 3b: cql (external CQL engine).
        $this->app->bind(CareBundleMeasureEvaluator::class, function () {
            $impl = (string) config('care_bundles.evaluator', 'cohort_based');

            return match ($impl) {
                'cql' => $this->app->make(CqlMeasureEvaluator::class),
                default => $this->app->make(CohortBasedMeasureEvaluator::class),
            };
        });
        $this->app->singleton(CareBundleMaterializationService::class);
        $this->app->singleton(CareBundleQualificationService::class);

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
                $app->make(RiskScoreCriteriaBuilder::class),
            );
        });

        $this->app->singleton(CohortGenerationService::class, function ($app) {
            return new CohortGenerationService(
                $app->make(CohortSqlCompiler::class),
            );
        });

        // FinnGen SP1 services
        $this->app->singleton(FinnGenArtifactService::class, fn () => new FinnGenArtifactService(
            (string) config('finngen.artifacts_path'),
            (int) config('finngen.artifacts_stream_threshold_bytes'),
        ));

        $this->app->singleton(FinnGenIdempotencyStore::class, fn () => new FinnGenIdempotencyStore(
            (int) config('finngen.idempotency_ttl_seconds'),
        ));

        // FinnGenClient has a primitive constructor — use the config-driven factory.
        $this->app->singleton(
            FinnGenClient::class,
            fn () => FinnGenClient::forContainer(),
        );

        // Phase 16-01 — PheWeb-style GWAS visualization services.
        // ManhattanAggregationService: stateless but benefits from singleton
        // binding so the container doesn't reconstruct it on every request.
        // GencodeService: MUST be a singleton — it memoizes ~60k gene rows
        // in a static property per PHP-FPM worker lifetime.
        $this->app->singleton(ManhattanAggregationService::class);
        $this->app->singleton(GencodeService::class);
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
            if (is_file($candidate) && is_readable($candidate)) {
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

        $this->configureTestingDatabaseConnection();

        Event::listen(CommandStarting::class, function (CommandStarting $event): void {
            $this->guardDangerousConsoleCommands($event->command);
        });

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

        // FinnGen run policies
        Gate::policy(Run::class, FinnGenRunPolicy::class);

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

        // Phase 14 — maintain covariate_columns_hash on every Eloquent save
        // (seeder bypasses this via DB::table updateOrInsert; runtime writes
        // go through Eloquent where this observer fires).
        GwasCovariateSet::observe(GwasCovariateSetObserver::class);

        // Phase 15 — backfill EndpointGwasRun tracking rows from finngen.runs status
        // transitions. Observer is tight-loop-safe (every DB op try-catch-wrapped,
        // never re-throws per CLAUDE.md Gotcha #12 — transaction poisoning guard).
        Run::observe(FinnGenGwasRunObserver::class);

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

    private function configureTestingDatabaseConnection(): void
    {
        $requestedConnection = (string) env('DB_CONNECTION', '');
        $runningUnderPhpunit = $this->isRunningUnderPhpunit();
        $isTestingRuntime = app()->environment('testing')
            || $requestedConnection === 'pgsql_testing'
            || $runningUnderPhpunit;

        if (! $isTestingRuntime) {
            return;
        }

        $base = Config::get('database.connections.pgsql', []);

        $baseDatabase = (string) ($base['database'] ?? 'parthenon');
        $configuredTestDatabase = (string) env('DB_TEST_DATABASE', 'parthenon_testing');

        // In CI, phpunit.xml may force DB_TEST_DATABASE=parthenon_testing while the
        // job provisions only DB_DATABASE=..._test. Prefer the provisioned test DB.
        $testDatabase = $configuredTestDatabase;
        if ($configuredTestDatabase === 'parthenon_testing' && str_ends_with($baseDatabase, '_test')) {
            $testDatabase = $baseDatabase;
        }

        config([
            'database.connections.pgsql_testing' => array_merge($base, [
                'url' => env('DB_TEST_URL'),
                'host' => env('DB_TEST_HOST', $base['host'] ?? '127.0.0.1'),
                'port' => env('DB_TEST_PORT', $base['port'] ?? '5432'),
                'database' => $testDatabase,
                'username' => env('DB_TEST_USERNAME', $base['username'] ?? 'parthenon'),
                'password' => env('DB_TEST_PASSWORD', $base['password'] ?? ''),
                'search_path' => 'app,php',
            ]),
            'database.default' => 'pgsql_testing',
        ]);

        // When Pest/PHPUnit is detected but phpunit.xml's `<env force="true">`
        // directives did not reach Laravel's env repository (a known issue when
        // `backend/.env.testing` also hard-codes these keys), force the rest of
        // the testing runtime so downstream services (Spatie permission cache,
        // session store, queues, mail, app->environment()) don't leak into the
        // production Redis / queue / cache from the dev `.env`.
        if ($runningUnderPhpunit && ! app()->environment('testing')) {
            // Rebind the Laravel application environment to 'testing' without
            // touching the env file loader (which has already run). This makes
            // app()->environment('testing') and runningUnitTests() return true.
            $this->app->detectEnvironment(fn () => 'testing');

            config([
                'app.env' => 'testing',
                'cache.default' => 'array',
                'session.driver' => 'array',
                'queue.default' => 'sync',
                'mail.default' => 'array',
                'permission.cache.store' => 'array',
            ]);
        }
    }

    /**
     * Detect whether the current PHP process is a PHPUnit/Pest test run.
     *
     * phpunit.xml's `<env force="true">` directives do not reliably reach
     * Laravel's env() repository when `backend/.env.testing` also sets
     * `DB_CONNECTION=pgsql`, so we fall back to process-level signals that
     * cannot be overridden by dotenv files.
     *
     * IMPORTANT: `\PHPUnit\Runner\Version` is NOT a reliable signal — Laravel's
     * dev tooling (Telescope, Tinker, Pail, etc.) transitively autoloads it
     * during normal `artisan` runs and would cause false positives that
     * re-route artisan tinker / jobs / queue workers into the testing DB.
     * `\PHPUnit\Framework\TestCase` is only loaded when a real test class is
     * parsed, which is what we want.
     */
    private function isRunningUnderPhpunit(): bool
    {
        // PHPUnit's Composer bootstrap defines this constant for any phpunit/pest run.
        if (defined('PHPUNIT_COMPOSER_INSTALL')) {
            return true;
        }

        // Loaded only when a real test class (which extends it) is parsed.
        if (class_exists(PhpUnitTestCase::class, false)) {
            return true;
        }

        // Pest-specific runner class — also a strong positive.
        if (class_exists(TestSuite::class, false)) {
            return true;
        }

        // Final safety net: inspect argv for a pest/phpunit invocation. Matches
        // both `vendor/bin/pest` and `vendor/bin/phpunit` entry points. Scoped
        // narrowly to avoid matching artisan commands that happen to embed the
        // word "pest" or "phpunit" in their arguments.
        $argv = (array) ($_SERVER['argv'] ?? []);
        $entryScript = isset($argv[0]) && is_string($argv[0]) ? strtolower(basename($argv[0])) : '';
        if ($entryScript === 'pest' || $entryScript === 'phpunit') {
            return true;
        }

        return false;
    }

    private function guardDangerousConsoleCommands(string $command): void
    {
        if ($command === '') {
            return;
        }

        $connectionName = Config::get('database.default', 'pgsql');
        $databaseName = (string) Config::get("database.connections.{$connectionName}.database", '');
        $protectedDatabases = collect(explode(',', (string) env('PROTECTED_CONSOLE_DATABASES', 'parthenon')))
            ->map(fn (string $db) => trim($db))
            ->filter()
            ->values()
            ->all();

        $isProtectedDatabase = in_array($databaseName, $protectedDatabases, true);
        $isTestingConnection = $connectionName === 'pgsql_testing' || str_ends_with($databaseName, '_testing');

        if ($isTestingConnection || ! $isProtectedDatabase) {
            return;
        }

        // Always-blocked destructive commands
        $blockedCommands = [
            'test',
            'db:wipe',
            'migrate:fresh',
            'migrate:refresh',
            'migrate:reset',
            'migrate:rollback',
        ];

        if (in_array($command, $blockedCommands, true)) {
            throw new \RuntimeException(
                "Refusing to run [{$command}] against protected database [{$databaseName}] ".
                "on connection [{$connectionName}]. Use a dedicated testing database."
            );
        }

        // Block bare `migrate` without --path on protected databases.
        // On 2026-03-30, `migrate --force` re-ran ALL migrations and wiped results.cohort.
        // Only `migrate --path=<specific_file>` is allowed on production data.
        if ($command === 'migrate') {
            $argv = $_SERVER['argv'] ?? [];
            $hasPathFlag = false;
            foreach ($argv as $arg) {
                if (str_starts_with($arg, '--path=') || str_starts_with($arg, '--path ')) {
                    $hasPathFlag = true;
                    break;
                }
            }

            if (! $hasPathFlag) {
                throw new \RuntimeException(
                    "Refusing to run [migrate] without --path= against protected database [{$databaseName}]. ".
                    'Bare migrate can re-run ALL migrations and destroy data (see 2026-03-30 incident). '.
                    'Use: php artisan migrate --path=database/migrations/SPECIFIC_FILE.php [--force]'
                );
            }
        }
    }
}
