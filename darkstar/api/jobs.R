# ──────────────────────────────────────────────────────────────────
# Async job management endpoints
# Mounted at /jobs in plumber_api.R
# ──────────────────────────────────────────────────────────────────

source("/app/R/async_jobs.R")
source("/app/R/connection.R")

#* Submit an async analysis job
#* @post /jobs/submit
#* @serializer unboxedJSON
function(body, response) {
  spec <- body

  if (is.null(spec) || is.null(spec$type)) {
    response$status <- 400L
    return(list(status = "error", message = "Request body must include 'type' and analysis spec"))
  }

  analysis_type <- tolower(spec$type)

  # Build the worker function based on analysis type.
  # Each worker sources its own dependencies (runs in a separate R process).
  worker_func <- switch(analysis_type,
    "estimation" = function(spec) {
      source("/app/R/connection.R")
      source("/app/R/covariates.R")
      source("/app/R/progress.R")
      source("/app/R/results.R")
      library(CohortMethod)
      library(FeatureExtraction)
      library(DatabaseConnector)

      logger <- create_analysis_logger()
      connectionDetails <- create_hades_connection(spec$source)

      source("/app/api/estimation_worker.R")
      run_estimation_pipeline(spec, connectionDetails, logger)
    },
    "prediction" = function(spec) {
      source("/app/R/connection.R")
      source("/app/R/covariates.R")
      source("/app/R/progress.R")
      source("/app/R/results.R")
      library(PatientLevelPrediction)
      library(FeatureExtraction)
      library(DatabaseConnector)

      logger <- create_analysis_logger()
      source("/app/api/prediction_worker.R")
      run_prediction_pipeline(spec, logger)
    },
    "sccs" = function(spec) {
      source("/app/R/connection.R")
      source("/app/R/progress.R")
      library(SelfControlledCaseSeries)
      library(DatabaseConnector)

      logger <- create_analysis_logger()
      source("/app/api/sccs_worker.R")
      run_sccs_pipeline(spec, logger)
    },
    {
      response$status <- 400L
      return(list(status = "error", message = paste("Unknown analysis type:", analysis_type)))
    }
  )

  job_id <- submit_job(analysis_type, spec, worker_func)

  response$status <- 202L
  list(status = "submitted", job_id = job_id, type = analysis_type)
}

#* Check job status (and retrieve result if complete)
#* @get /jobs/status/<job_id>
#* @serializer unboxedJSON
function(job_id, response) {
  result <- get_job_status(job_id)

  if (result$status == "not_found") {
    response$status <- 404L
  }

  result
}

#* Cancel a running job
#* @post /jobs/cancel/<job_id>
#* @serializer unboxedJSON
function(job_id, response) {
  result <- cancel_job(job_id)

  if (result$status == "not_found") {
    response$status <- 404L
  }

  result
}

#* List all active jobs
#* @get /jobs/list
#* @serializer unboxedJSON
function() {
  list(jobs = list_jobs())
}
