# darkstar/api/finngen/routes.R
#
# Plumber annotation file for all FinnGen endpoints (SP1 Runtime Foundation).
# Mounted by plumber_api.R alongside the other api/*.R files.
#
# Sync endpoints (6): inline handlers, calls wrapped in run_with_classification
#   to pre-classify R errors via the common.R taxonomy.
# Async endpoints (7): call submit_job() from the existing Darkstar
#   async jobs subsystem (darkstar/R/async_jobs.R). Returns
#   {job_id, status:"running", run_id}. Laravel polls /jobs/status/<job_id>
#   and reads progress.json / summary.json from
#   /opt/finngen-artifacts/runs/<run_id>/ directly (spec §3.2).

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi.R")
source("/app/api/finngen/hades_extras.R")
source("/app/api/finngen/co2_analysis.R")
source("/app/api/finngen/cohort_ops.R")
source("/app/api/finngen/romopapi_async.R")
source("/app/R/async_jobs.R")  # provides submit_job()

suppressPackageStartupMessages({
  library(jsonlite)
})

# Helpers ----------------------------------------------------------------

.decode_source <- function(source_json) {
  jsonlite::fromJSON(source_json, simplifyVector = FALSE)
}

# Build a worker closure for a given FinnGen async endpoint key. The closure
# runs in the callr background R process (which re-sources all needed files).
.build_worker <- function(endpoint_key) {
  switch(endpoint_key,
    "finngen.co2.codewas" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/co2_analysis.R")
      finngen_co2_codewas_execute(
        source_envelope   = spec$source,
        run_id            = spec$run_id,
        export_folder     = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        analysis_settings = spec$params %||% spec$analysis_settings
      )
    },
    "finngen.co2.time_codewas" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/co2_analysis.R")
      finngen_co2_time_codewas_execute(
        source_envelope   = spec$source,
        run_id            = spec$run_id,
        export_folder     = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        analysis_settings = spec$params %||% spec$analysis_settings
      )
    },
    "finngen.co2.overlaps" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/co2_analysis.R")
      finngen_co2_overlaps_execute(
        source_envelope   = spec$source,
        run_id            = spec$run_id,
        export_folder     = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        analysis_settings = spec$params %||% spec$analysis_settings
      )
    },
    "finngen.co2.demographics" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/co2_analysis.R")
      finngen_co2_demographics_execute(
        source_envelope   = spec$source,
        run_id            = spec$run_id,
        export_folder     = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        analysis_settings = spec$params %||% spec$analysis_settings
      )
    },
    "finngen.cohort.generate" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/cohort_ops.R")
      finngen_cohort_generate_execute(
        source_envelope = spec$source,
        run_id          = spec$run_id,
        export_folder   = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        params          = spec$params
      )
    },
    "finngen.cohort.match" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/cohort_ops.R")
      finngen_cohort_match_execute(
        source_envelope = spec$source,
        run_id          = spec$run_id,
        export_folder   = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        params          = spec$params
      )
    },
    "finngen.romopapi.report" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/romopapi_async.R")
      finngen_romopapi_report_execute(
        source_envelope = spec$source,
        run_id          = spec$run_id,
        export_folder   = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        params          = spec$params
      )
    },
    "finngen.romopapi.setup" = function(spec) {
      source("/app/api/finngen/common.R"); source("/app/api/finngen/romopapi_async.R")
      finngen_romopapi_setup_source_execute(
        source_envelope = spec$source,
        run_id          = spec$run_id,
        export_folder   = file.path("/opt/finngen-artifacts/runs", spec$run_id),
        params          = spec$params
      )
    },
    stop(paste0("Unknown FinnGen endpoint key: ", endpoint_key))
  )
}

.dispatch_async <- function(endpoint_key, spec, response) {
  # plumber2 injects the parsed POST body as the `body` parameter directly.
  # Each route calls: .dispatch_async("key", body, response)
  if (is.null(spec) || is.null(spec$run_id) || is.null(spec$source)) {
    response$status <- 400L
    return(list(status = "error", message = "Request body must include run_id and source"))
  }
  # Ensure export folder exists before the background process runs — so progress.json
  # writes succeed on first invocation.
  export_folder <- file.path("/opt/finngen-artifacts/runs", spec$run_id)
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  writeLines(
    jsonlite::toJSON(spec, auto_unbox = TRUE, null = "null", force = TRUE),
    file.path(export_folder, "params.json")
  )

  worker <- .build_worker(endpoint_key)
  job_id <- submit_job(endpoint_key, spec, worker)
  response$status <- 202L
  list(job_id = job_id, status = "running", run_id = spec$run_id)
}

# Sync endpoints ---------------------------------------------------------

# plumber2 does not inject query parameters as named function args.
# Access them via req$query$X. `response` still binds by name.

.safe_sync <- function(endpoint_name, response, handler_fn) {
  # ROMOPAPI + some HadesExtras helpers write temp files to CWD.
  # Use a per-request temp dir so sync reads don't accumulate in /app or similar.
  tmpdir <- tempfile(pattern = paste0("finngen_sync_", endpoint_name, "_"))
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  old_wd <- getwd()
  setwd(tmpdir)
  on.exit({
    setwd(old_wd)
    unlink(tmpdir, recursive = TRUE)
  }, add = TRUE)

  out <- tryCatch(handler_fn(), error = function(e) {
    message(sprintf("[FinnGen %s] UNHANDLED: %s", endpoint_name, conditionMessage(e)))
    list(ok = FALSE, error = list(category = "ROUTE_HANDLER_ERROR", message = conditionMessage(e)))
  })
  if (!isTRUE(out$ok)) response$status <- 422L
  out
}

#* @get /finngen/romopapi/code-counts
#* @serializer unboxedJSON
function(request, response) {
  .safe_sync("code-counts", response, function() {
    src <- .decode_source(request$query$source)
    cid <- as.integer(request$query$concept_id)
    run_with_classification(NULL, function() finngen_romopapi_code_counts(src, cid))
  })
}

#* @get /finngen/romopapi/relationships
#* @serializer unboxedJSON
function(request, response) {
  .safe_sync("relationships", response, function() {
    src <- .decode_source(request$query$source)
    cid <- as.integer(request$query$concept_id)
    run_with_classification(NULL, function() finngen_romopapi_relationships(src, cid))
  })
}

#* @get /finngen/romopapi/ancestors
#* @serializer unboxedJSON
function(request, response) {
  .safe_sync("ancestors", response, function() {
    src <- .decode_source(request$query$source)
    cid <- as.integer(request$query$concept_id)
    dir_arg <- request$query$direction %||% "both"
    depth_arg <- as.integer(request$query$max_depth %||% 5L)
    run_with_classification(NULL, function() {
      finngen_romopapi_ancestors(src, cid, dir_arg, depth_arg)
    })
  })
}

#* @get /finngen/hades/counts
#* @serializer unboxedJSON
function(request, response) {
  .safe_sync("hades/counts", response, function() {
    src <- .decode_source(request$query$source)
    ids <- as.integer(strsplit(request$query$cohort_ids, ",")[[1]])
    run_with_classification(NULL, function() finngen_hades_counts(src, ids))
  })
}

#* @get /finngen/hades/overlap
#* @serializer unboxedJSON
function(request, response) {
  .safe_sync("hades/overlap", response, function() {
    src <- .decode_source(request$query$source)
    ids <- as.integer(strsplit(request$query$cohort_ids, ",")[[1]])
    run_with_classification(NULL, function() finngen_hades_overlap(src, ids))
  })
}

#* @get /finngen/hades/demographics
#* @serializer unboxedJSON
function(request, response) {
  .safe_sync("hades/demographics", response, function() {
    src <- .decode_source(request$query$source)
    cid <- as.integer(request$query$cohort_id)
    run_with_classification(NULL, function() finngen_hades_demographics(src, cid))
  })
}

#* @post /finngen/cohort/preview-count
#* @serializer unboxedJSON
function(body, response) {
  .safe_sync("cohort/preview-count", response, function() {
    if (is.null(body$source) || is.null(body$sql)) {
      stop("preview-count requires {source, sql} in body")
    }
    run_with_classification(NULL, function() {
      finngen_cohort_preview_count(body$source, body$sql)
    })
  })
}

# Async endpoints --------------------------------------------------------

#* @post /finngen/co2/codewas
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.co2.codewas", body, response)
}

#* @post /finngen/co2/time-codewas
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.co2.time_codewas", body, response)
}

#* @post /finngen/co2/overlaps
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.co2.overlaps", body, response)
}

#* @post /finngen/co2/demographics
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.co2.demographics", body, response)
}

#* @post /finngen/cohort/generate
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.cohort.generate", body, response)
}

#* @post /finngen/cohort/match
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.cohort.match", body, response)
}

#* @post /finngen/romopapi/report
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.romopapi.report", body, response)
}

#* @post /finngen/romopapi/setup
#* @serializer unboxedJSON
function(body, response) {
  .dispatch_async("finngen.romopapi.setup", body, response)
}
