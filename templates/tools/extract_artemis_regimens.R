#!/usr/bin/env Rscript
# templates/tools/extract_artemis_regimens.R
#
# Phase 3 Plan 7 Section B Task 14 (T-024-carryover). Extracts the
# full ARTEMIS oncology regimen library from the HemOnc R-package
# (https://github.com/HemOnc-org/HemOnc) and writes it as JSON
# matching the v0.1.0 schema from
# templates/runtime/oncology/artemis/v0.1.0/patterns.json.
#
# Output schema (v0.2.0):
#
#   {
#     "version": "v0.2.0",
#     "source": "HemOnc R-package <SHA>; full library extracted at Docker build time.",
#     "regimens": [
#       {
#         "regimen_name": "FOLFIRINOX",
#         "indication": "pancreatic cancer",
#         "phase": "induction",
#         "drugs": [
#           {"name": "fluorouracil", "rxnorm_concept_id": 1153888},
#           ...
#         ]
#       },
#       ...
#     ]
#   }
#
# The script is invoked from Stage 1 of templates/Dockerfile under
# `Rscript /build/extract.R --output /build/v0.2.0/patterns.json`.
# Stage 2 (the runtime image) copies only the JSON forward.

suppressPackageStartupMessages({
  library(jsonlite)
  library(HemOnc)
})

# Argparse-style option handling without external deps. The script
# accepts --output <path> and otherwise writes to stdout.
args <- commandArgs(trailingOnly = TRUE)
output_path <- NULL
i <- 1L
while (i <= length(args)) {
  if (identical(args[[i]], "--output")) {
    if (i == length(args)) {
      stop("--output requires a path argument", call. = FALSE)
    }
    output_path <- args[[i + 1L]]
    i <- i + 2L
  } else {
    stop(sprintf("unknown argument: %s", args[[i]]), call. = FALSE)
  }
}

# HemOnc::regimens() returns a tidy data frame keyed by regimen_id.
# components_for_regimen() maps each regimen_id to its component drugs
# with RxNorm concept_ids. indications_for_regimen() carries cancer
# type / phase metadata.
#
# The exact accessor names vary across HemOnc versions; we wrap each
# in a defensive `tryCatch` so the script fails closed with a
# descriptive error if the upstream API drifts.

safe_get <- function(fn_name, ...) {
  fn <- tryCatch(get(fn_name, envir = asNamespace("HemOnc")),
                 error = function(e) NULL)
  if (is.null(fn)) {
    stop(sprintf(
      "HemOnc::%s not found in installed package; pin a HemOnc commit SHA known to expose it",
      fn_name
    ), call. = FALSE)
  }
  fn(...)
}

regimens <- safe_get("regimens")
components <- safe_get("components_for_regimen")
indications <- safe_get("indications_for_regimen")

normalize_drug <- function(row) {
  list(
    name = tolower(as.character(row$ingredient_name)),
    rxnorm_concept_id = as.integer(row$rxnorm_concept_id)
  )
}

build_regimen_record <- function(regimen_id) {
  reg <- regimens[regimens$regimen_id == regimen_id, ]
  comp <- components[components$regimen_id == regimen_id, ]
  ind <- indications[indications$regimen_id == regimen_id, ]
  if (nrow(reg) == 0L || nrow(comp) == 0L) {
    return(NULL)
  }
  list(
    regimen_name = as.character(reg$regimen_name[[1]]),
    indication   = if (nrow(ind) > 0) tolower(as.character(ind$indication[[1]])) else "unspecified",
    phase        = if (nrow(ind) > 0 && !is.na(ind$phase[[1]])) tolower(as.character(ind$phase[[1]])) else "induction",
    drugs        = lapply(seq_len(nrow(comp)), function(k) normalize_drug(comp[k, ]))
  )
}

regimen_ids <- unique(regimens$regimen_id)
records <- Filter(Negate(is.null), lapply(regimen_ids, build_regimen_record))

# Sanity floor — if the extraction yields fewer than 100 records,
# something is wrong with the HemOnc install (likely incomplete
# data download). Fail loudly so the Docker build aborts.
if (length(records) < 100L) {
  stop(sprintf(
    "ARTEMIS extraction yielded only %d records; expected several hundred. Check HemOnc install.",
    length(records)
  ), call. = FALSE)
}

# Pull the installed HemOnc SHA so the output's ``source`` field is
# reproducible. ``installed.packages()`` includes "Built" but not the
# git SHA; sessionInfo() carries the version number which is
# sufficient.
hemonc_version <- as.character(packageVersion("HemOnc"))

payload <- list(
  version = "v0.2.0",
  source  = sprintf(
    "HemOnc R-package v%s; full library extracted via tools/extract_artemis_regimens.R at Docker build time.",
    hemonc_version
  ),
  regimens = records
)

if (is.null(output_path)) {
  cat(toJSON(payload, pretty = TRUE, auto_unbox = TRUE))
} else {
  dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
  write(toJSON(payload, pretty = TRUE, auto_unbox = TRUE), file = output_path)
  cat(sprintf("wrote %d regimens to %s\n", length(records), output_path))
}
