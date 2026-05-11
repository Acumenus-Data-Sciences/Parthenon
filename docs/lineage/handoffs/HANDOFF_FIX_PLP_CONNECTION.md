# Handoff: Fix PatientLevelPrediction R Connection Error

## Problem

Study 5 (IRSF CSS Functional Decline Predictor) fails at the PLP data extraction step with `"cannot open the connection"`. The R runtime (Darkstar) successfully runs CohortMethod (Study 4 Estimation) and SelfControlledCaseSeries (Study 6 SCCS) against the same database, so this is a PLP-specific issue, not a general connectivity problem.

## Error Details

```
[info]  Prediction pipeline started  (target=201, outcome=202, model=lasso_logistic_regression)
[info]  Connecting to CDM database
[info]  CDM=omop, Vocab=omop, Results=results
[info]  Building covariate settings
[info]  Extracting PLP data from database
[error] cannot open the connection        ← fails here after ~10s
```

The error occurs inside `PatientLevelPrediction::getPlpData()` at line 100 of `darkstar/api/prediction.R`. The R function establishes a JDBC connection via `DatabaseConnector` (same as CohortMethod), then calls PLP's data extraction. The "cannot open the connection" message is an R-level error, not a database-level one.

## Working Hypothesis

PLP's `getPlpData()` internally opens a **second connection** or writes intermediate data to a **temp file/directory**. The likely failure modes:

1. **Temp directory write failure**: PLP writes intermediate Andromeda objects to disk. If `/tmp` or the R temp directory is full, read-only, or on a noexec mount inside the Docker container, this manifests as "cannot open the connection" (R's generic file connection error).

2. **JDBC connection pool exhaustion**: CohortMethod uses one JDBC connection. PLP may open additional parallel connections for covariate extraction. If the JDBC pool or PostgreSQL `max_connections` is exhausted, the second connection fails.

3. **Andromeda/Arrow file lock**: PLP uses the `Andromeda` package (backed by DuckDB/Arrow) for large dataset handling. If a prior PLP run left a lock file in the temp directory, subsequent runs fail to open the Andromeda object.

## Key Files

| File | Purpose |
|------|---------|
| `darkstar/api/prediction.R` | PLP pipeline endpoint — lines 98-104 are where it fails |
| `darkstar/R/connection.R` | `create_hades_connection()` — builds JDBC connectionDetails |
| `darkstar/R/covariates.R` | `build_covariate_settings()` — covariate config builder |
| `backend/app/Services/RService.php` | PHP client — `runPrediction()` calls `POST /analysis/prediction/run` |
| `backend/app/Services/Analysis/PredictionService.php` | Laravel service — builds the spec and calls RService |
| `backend/app/Services/Analysis/HadesBridgeService.php` | `buildSourceSpec()` — builds the source connection spec sent to R (lines 97-140) |

## Database Connection Details

The R sidecar connects to the host PostgreSQL (not the Docker postgres):
- Host: `pgsql.acumenus.net`
- Port: `5432`
- Database: `parthenon`
- Schemas: `omop` (CDM/vocab), `results` (cohort table)
- Connection spec is built by `HadesBridgeService::buildSourceSpec()` using Source model #57 (IRSF-NHS)

The JDBC URL constructed by `connection.R` (line 49-52):
```
jdbc:postgresql://pgsql.acumenus.net:5432/parthenon?socketTimeout=300&connectTimeout=30&loginTimeout=30&tcpKeepAlive=true
```

## What Works (for comparison)

- **CohortMethod (Estimation)**: Extracts data in 21s, fits PS model, runs Cox PH. Full pipeline completes in 58s.
- **SCCS**: Extracts data in 3.9s, creates study population, fits model. Completes in 4.5s.
- Both use the identical `create_hades_connection()` function and the same source spec.

## Debugging Steps

1. **Check R container temp space**:
   ```bash
   docker compose exec darkstar df -h /tmp
   docker compose exec darkstar ls -la /tmp/Rtmp*
   ```

2. **Check if Andromeda/DuckDB is the issue**:
   ```bash
   docker compose exec darkstar R -e "library(Andromeda); a <- andromeda(); close(a); cat('Andromeda OK\n')"
   ```

3. **Check PostgreSQL max_connections**:
   ```sql
   SHOW max_connections;
   SELECT count(*) FROM pg_stat_activity;
   ```

4. **Run PLP data extraction with verbose logging**:
   Add to `darkstar/api/prediction.R` before line 100:
   ```r
   options(andromedaTempFolder = tempdir())
   cat(sprintf("Temp dir: %s, writable: %s\n", tempdir(), file.access(tempdir(), 2) == 0))
   cat(sprintf("Free disk: %s\n", system("df -h /tmp | tail -1", intern = TRUE)))
   ```

5. **Test PLP extraction in isolation** (from inside the R container):
   ```r
   library(PatientLevelPrediction)
   library(DatabaseConnector)
   cd <- createConnectionDetails(
     dbms = "postgresql",
     connectionString = "jdbc:postgresql://pgsql.acumenus.net:5432/parthenon?socketTimeout=300&connectTimeout=30",
     user = "<user>", password = "<password>",
     pathToDriver = "/opt/jdbc"
   )
   dd <- createDatabaseDetails(
     connectionDetails = cd,
     cdmDatabaseSchema = "omop", cdmDatabaseName = "parthenon", cdmDatabaseId = "test",
     cohortDatabaseSchema = "results", cohortTable = "cohort",
     outcomeDatabaseSchema = "results", outcomeTable = "cohort",
     targetId = 201, outcomeIds = 202
   )
   covSettings <- FeatureExtraction::createCovariateSettings(
     useDemographicsAge = TRUE, useDemographicsGender = TRUE
   )
   # This is the call that fails:
   plpData <- getPlpData(databaseDetails = dd, covariateSettings = covSettings)
   ```

## Study Design (validated, ready to execute)

The study design is correct and complete — only the R execution needs fixing:

- **Analysis record**: `app.prediction_analyses` id=20
- **Study record**: `app.studies` id=108 ("Predicting Functional Decline in Rett Syndrome")
- **Target cohort**: 201 (Progression Cohort, N=1,820 in results.cohort)
- **Outcome cohort**: 202 (CSS Progressors, N=1,820 in results.cohort)
- **Model**: LASSO logistic regression, seed=42
- **Time-at-risk**: 1-730 days (2-year prediction window)
- **Split**: 75/25 stratified, 5-fold CV
- **Min observation**: 365 days

## Success Criteria

The fix is successful when:
```bash
docker compose exec -T php php artisan tinker --execute="
use App\Models\App\PredictionAnalysis;
use App\Models\App\AnalysisExecution;
use App\Models\App\Source;
use App\Enums\ExecutionStatus;
use App\Services\Analysis\PredictionService;

\$analysis = PredictionAnalysis::findOrFail(20);
\$source = Source::findOrFail(57);
\$execution = AnalysisExecution::create([
  'analysis_type' => PredictionAnalysis::class,
  'analysis_id' => 20, 'source_id' => 57,
  'status' => ExecutionStatus::Queued, 'started_at' => now(),
]);
app(PredictionService::class)->execute(\$analysis, \$source, \$execution);
\$execution->refresh();
\$r = \$execution->result_json;
echo 'Status: ' . \$r['status'] . PHP_EOL;
echo 'AUC: ' . (\$r['performance']['auc'] ?? 0) . PHP_EOL;
echo 'Top predictors: ' . count(\$r['top_predictors'] ?? []) . PHP_EOL;
"
```
Expected output:
```
Status: completed
AUC: >0.5  (any non-zero AUC means the model trained)
Top predictors: >0
```
