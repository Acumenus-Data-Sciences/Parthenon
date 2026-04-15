# ──────────────────────────────────────────────────────────────────
# TreatmentPatterns — OHDSI Treatment Pathway Analysis
# POST /analysis/treatment-patterns/run
# ──────────────────────────────────────────────────────────────────

library(DatabaseConnector)
library(CDMConnector)
library(TreatmentPatterns)
library(dplyr)
library(dbplyr)
library(DBI)
source("/app/R/connection.R")
source("/app/R/progress.R")

.ensure_list <- function(x) {
  if (is.null(x)) return(x)
  if (is.data.frame(x)) {
    rows <- lapply(seq_len(nrow(x)), function(i) {
      .ensure_list(as.list(x[i, , drop = FALSE]))
    })
    if (nrow(x) == 1) return(rows[[1]])
    return(rows)
  }
  if (is.list(x)) return(lapply(x, .ensure_list))
  if (!is.null(names(x)) && length(x) > 1 && is.character(names(x))) {
    return(lapply(as.list(x), .ensure_list))
  }
  x
}

.parse_cohort_table <- function(source, result_schema) {
  raw <- as.character(source$cohort_table %||% "cohort")
  raw <- sub('^"', "", raw)
  raw <- sub('"$', "", raw)

  if (grepl("\\.", raw, fixed = FALSE)) {
    parts <- strsplit(raw, "\\.", fixed = FALSE)[[1]]
    list(schema = parts[1], table = parts[length(parts)])
  } else {
    list(schema = result_schema, table = raw)
  }
}

.quote_qualified_table <- function(connection, schema, table) {
  paste(
    as.character(DBI::dbQuoteIdentifier(connection, schema)),
    as.character(DBI::dbQuoteIdentifier(connection, table)),
    sep = "."
  )
}

.build_cohort_rows <- function(spec) {
  target <- spec$cohorts$target_cohort
  events <- spec$cohorts$event_cohorts

  rows <- list(
    data.frame(
      cohortId = as.integer(target$cohort_id),
      cohortName = as.character(target$cohort_name %||% paste("Target", target$cohort_id)),
      type = "target",
      stringsAsFactors = FALSE
    )
  )

  for (event in events) {
    rows[[length(rows) + 1]] <- data.frame(
      cohortId = as.integer(event$cohort_id),
      cohortName = as.character(event$cohort_name %||% paste("Event", event$cohort_id)),
      type = "event",
      stringsAsFactors = FALSE
    )
  }

  do.call(rbind, rows)
}

.safe_df <- function(x) {
  if (is.null(x)) return(data.frame())
  as.data.frame(x)
}

.normalize_pathway <- function(value) {
  if (is.null(value) || is.na(value) || !nzchar(as.character(value))) return(character())
  strsplit(as.character(value), "-", fixed = TRUE)[[1]]
}

#* Run package-native TreatmentPatterns and return Parthenon-normalized results
#* @post /analysis/treatment-patterns/run
#* @serializer unboxedJSON
function(body, response) {
  spec <- .ensure_list(body)
  logger <- create_analysis_logger()

  if (is.null(spec)) {
    response$status <- 400L
    return(list(status = "error", message = "No specification provided in request body"))
  }

  required_keys <- c("source", "cohorts")
  missing <- setdiff(required_keys, names(spec))
  if (length(missing) > 0) {
    response$status <- 400L
    return(list(status = "error", message = paste("Missing required fields:", paste(missing, collapse = ", "))))
  }

  if (is.null(spec$cohorts$target_cohort) || is.null(spec$cohorts$event_cohorts) || length(spec$cohorts$event_cohorts) == 0) {
    response$status <- 400L
    return(list(status = "error", message = "cohorts.target_cohort and cohorts.event_cohorts are required"))
  }

  safe_execute(response, logger, {
    settings <- spec$settings %||% list()
    source <- spec$source

    cdm_schema <- source$cdm_schema
    result_schema <- source$results_schema
    write_schema <- source$write_schema %||% result_schema
    table_parts <- .parse_cohort_table(source, result_schema)
    cohort_alias <- "cohort"

    min_cell_count <- as.integer(settings$min_cell_count %||% 5L)
    max_path_length <- as.integer(settings$max_path_length %||% 5L)
    era_collapse <- as.integer(settings$era_collapse_window_days %||% settings$eraCollapseWindowDays %||% 30L)
    combination_window <- as.integer(settings$combination_window_days %||% settings$combinationWindowDays %||% 30L)
    min_era_duration <- as.integer(settings$min_era_duration_days %||% 0L)
    min_post_combination_duration <- as.integer(settings$min_post_combination_duration_days %||% combination_window)
    filter_treatments <- as.character(settings$filter_treatments %||% "First")
    overlap_method <- as.character(settings$overlap_method %||% "truncate")
    include_no_event_path <- isTRUE(settings$include_no_event_path %||% settings$includeNoEventPath)
    export_package_artifacts <- isTRUE(settings$export_package_artifacts %||% settings$exportPackageArtifacts)

    cohorts <- .build_cohort_rows(spec)

    logger$info("TreatmentPatterns pipeline started", list(
      target = cohorts$cohortId[cohorts$type == "target"],
      events = length(cohorts$cohortId[cohorts$type == "event"]),
      cohort_table = paste(table_parts$schema, table_parts$table, sep = ".")
    ))

    connection_details <- create_hades_connection(source)
    connection <- DatabaseConnector::connect(connection_details)
    on.exit(safe_disconnect(connection), add = TRUE)

    cohort_table_sql <- .quote_qualified_table(connection, table_parts$schema, table_parts$table)
    target_count <- DBI::dbGetQuery(
      connection,
      sprintf(
        "SELECT COUNT(DISTINCT subject_id) AS target_count FROM %s WHERE cohort_definition_id = %d",
        cohort_table_sql,
        as.integer(spec$cohorts$target_cohort$cohort_id)
      )
    )$target_count[[1]]
    target_count <- as.integer(target_count %||% 0L)

    cdm <- CDMConnector::cdmFromCon(
      con = connection,
      cdmSchema = cdm_schema,
      writeSchema = write_schema,
      writePrefix = sprintf("tp_%s_", spec$execution_id %||% as.integer(Sys.time()))
    )
    cdm[[cohort_alias]] <- dplyr::tbl(
      src = connection,
      from = dbplyr::in_schema(table_parts$schema, table_parts$table)
    )

    output_env <- TreatmentPatterns::computePathways(
      cohorts = cohorts,
      cohortTableName = cohort_alias,
      cdm = cdm,
      analysisId = as.integer(spec$analysis_id %||% 1L),
      description = as.character(spec$description %||% ""),
      minEraDuration = min_era_duration,
      eraCollapseSize = era_collapse,
      combinationWindow = combination_window,
      minPostCombinationDuration = min_post_combination_duration,
      filterTreatments = filter_treatments,
      maxPathLength = max_path_length,
      overlapMethod = overlap_method,
      concatTargets = TRUE
    )
    on.exit(tryCatch(Andromeda::close(output_env), error = function(e) NULL), add = TRUE)

    output_path <- NULL
    archive_name <- NULL
    if (export_package_artifacts) {
      output_path <- file.path(tempdir(), sprintf("parthenon-treatment-patterns-%s", spec$execution_id %||% as.integer(Sys.time())))
      archive_name <- "treatment-patterns-output.zip"
      dir.create(output_path, recursive = TRUE, showWarnings = FALSE)
    }

    package_results <- TreatmentPatterns::export(
      andromeda = output_env,
      outputPath = output_path,
      minCellCount = min_cell_count,
      censorType = "remove",
      archiveName = archive_name,
      nonePaths = include_no_event_path,
      stratify = FALSE
    )

    treatment_pathways <- .safe_df(package_results$treatment_pathways)
    attrition <- .safe_df(package_results$attrition)
    metadata <- .safe_df(package_results$metadata)
    arguments <- .safe_df(package_results$arguments)

    if (nrow(attrition) > 0 && "number_subjects" %in% names(attrition)) {
      attrition_count <- max(attrition$number_subjects, na.rm = TRUE)
      if (is.finite(attrition_count) && attrition_count > 0) {
        target_count <- as.integer(attrition_count)
      }
    }

    pathways <- list()
    if (nrow(treatment_pathways) > 0) {
      treatment_pathways <- treatment_pathways[order(-as.numeric(treatment_pathways$freq)), , drop = FALSE]
      pathways <- lapply(seq_len(nrow(treatment_pathways)), function(i) {
        row <- treatment_pathways[i, , drop = FALSE]
        count <- as.integer(row$freq)
        raw_path <- as.character(row$path %||% row$pathway)
        list(
          path = as.list(.normalize_pathway(raw_path)),
          raw_path = raw_path,
          count = count,
          percent = if (target_count > 0) round((count / target_count) * 100, 2) else 0,
          suppressed = FALSE,
          age = as.character(row$age %||% "all"),
          sex = as.character(row$sex %||% "all"),
          index_year = as.character(row$index_year %||% "all")
        )
      })
    }

    persons_with_events <- sum(vapply(pathways, function(p) {
      if (identical(p$raw_path, "None")) 0L else as.integer(p$count)
    }, integer(1)), na.rm = TRUE)

    event_names <- cohorts[cohorts$type == "event", c("cohortId", "cohortName"), drop = FALSE]
    event_map <- as.list(stats::setNames(as.character(event_names$cohortName), as.character(event_names$cohortId)))

    artifacts <- list()
    if (!is.null(output_path) && !is.null(archive_name)) {
      archive_path <- file.path(output_path, archive_name)
      archive_exists <- file.exists(archive_path)
      archive_size <- if (archive_exists) file.info(archive_path)$size else 0L
      artifacts <- list(list(
        id = "treatment_patterns_zip",
        type = "treatment_patterns_zip",
        name = archive_name,
        mime_type = "application/zip",
        size_bytes = as.integer(archive_size),
        available = archive_exists,
        content_base64 = if (archive_exists) {
          jsonlite::base64_enc(readBin(archive_path, what = "raw", n = as.integer(archive_size)))
        } else {
          NULL
        }
      ))
    }

    logger$info("TreatmentPatterns pipeline completed", list(
      target_count = target_count,
      pathway_rows = length(pathways)
    ))

    list(
      status = "completed",
      engine = "treatment_patterns",
      package = "TreatmentPatterns",
      package_version = as.character(utils::packageVersion("TreatmentPatterns")),
      target_cohort_id = as.integer(spec$cohorts$target_cohort$cohort_id),
      target_count = target_count,
      pathways = pathways,
      event_cohorts = event_map,
      summary = list(
        unique_pathways = length(pathways),
        persons_with_events = as.integer(persons_with_events),
        persons_without_events = as.integer(max(target_count - persons_with_events, 0))
      ),
      treatment_patterns = list(
        attrition = attrition,
        metadata = metadata,
        arguments = arguments
      ),
      artifacts = artifacts,
      warnings = list(),
      logs = logger$entries(),
      elapsed_seconds = logger$elapsed()
    )
  })
}
