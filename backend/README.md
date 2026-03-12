# Parthenon Backend

Laravel 11 REST API powering the Parthenon platform.

## Tech Stack

- **PHP 8.4** with Laravel 11
- **PostgreSQL 16/17** (multi-schema: app, cdm, vocab, results)
- **Redis 7** for cache and Horizon queues
- **Sanctum** token authentication + Spatie RBAC

## API Controllers (81)

- `AbbyAiController`
- `AbbyConversationController`
- `AchillesController`
- `AiProviderController`
- `AtlasMigrationController`
- `AuthProviderController`
- `ChromaStudioController`
- `FhirConnectionController`
- `PacsConnectionController`
- `RoleController`
- `SolrAdminController`
- `SystemHealthController`
- `UserController`
- `VocabularyController`
- `WebApiRegistryController`
- `AnalysisStatsController`
- `AriadneController`
- `AuthController`
- `CareGapController`
- `CharacterizationController`
- `CirceController`
- `ClaimsSearchController`
- `ClinicalCoherenceController`
- `CohortDefinitionController`
- `CohortDiagnosticsController`
- `ConceptSetController`
- `DashboardController`
- `DataQualityController`
- `EstimationController`
- `EvidenceSynthesisController`
- `FhirR4Controller`
- `FhirToCdmController`
- `GenomicsController`
- `GisAirQualityController`
- `GisComorbidityController`
- `GisController`
- `GisEtlController`
- `GisGeographyController`
- `GisHospitalController`
- `GisRuccController`
- `GisSviController`
- `GlobalSearchController`
- `HealthController`
- `HecateController`
- `HelpController`
- `HeorController`
- `ImagingController`
- `ImagingTimelineController`
- `IncidenceRateController`
- `IngestionController`
- `MappingReviewController`
- `NegativeControlController`
- `NetworkAnalysisController`
- `NotificationPreferenceController`
- `OnboardingController`
- `PathwayController`
- `PatientProfileController`
- `PhenotypeLibraryController`
- `PopulationCharacterizationController`
- `PopulationRiskScoreController`
- `PredictionController`
- `PublicationController`
- `RadiogenomicsController`
- `SccsController`
- `SourceController`
- `StrategusController`
- `StudyActivityController`
- `StudyAgentController`
- `StudyArtifactController`
- `StudyCohortController`
- `StudyController`
- `StudyMilestoneController`
- `StudyResultController`
- `StudySiteController`
- `StudyStatsController`
- `StudySynthesisController`
- `StudyTeamController`
- `SyntheaController`
- `TextToSqlController`
- `VocabularyController`
- `WhiteRabbitController`

## Routes

434+ API routes registered in `routes/api.php`.

## Testing

```bash
vendor/bin/pest              # 21 test files
vendor/bin/pint --test       # Code style
vendor/bin/phpstan analyse   # Static analysis (level 8)
```

## Key Commands

```bash
php artisan admin:seed                   # Create/update super-admin
php artisan eunomia:seed-source          # Seed Eunomia demo source
php artisan parthenon:load-eunomia       # Load GiBleed CDM dataset
php artisan achilles:run {source_id}     # Run Achilles characterization
php artisan solr:index-clinical          # Index clinical data to Solr
```

## Directory Structure

```
app/
  Http/Controllers/Api/V1/   # API controllers
  Models/                    # Eloquent models (App/, Cdm/, Vocabulary/, Results/)
  Services/                  # Business logic
  Jobs/                      # Horizon queue jobs
  Notifications/             # Email/SMS notifications
routes/api.php               # All API routes
database/migrations/         # Schema migrations
```
