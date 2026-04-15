# darkstar/api/finngen/romopapi.R
#
# Sync read endpoints wrapping ROMOPAPI package + direct concept_relationship /
# concept_ancestor queries. Each function is callable standalone (for testthat)
# and also wired into Plumber via darkstar/api/finngen/routes.R (Task B6).
#
# Invariant: we NEVER call ROMOPAPI::runApiServer() — we host our own Plumber
# and call the package's functions directly. See
# docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md §0.4
# (handoff doc) for the upstream contract.

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(ROMOPAPI)
  library(DatabaseConnector)
  library(SqlRender)
})

# --- 1. Stratified code counts via ROMOPAPI::getCodeCounts -------------

finngen_romopapi_code_counts <- function(source_envelope, concept_id) {
  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

  counts <- ROMOPAPI::getCodeCounts(handler, conceptId = as.integer(concept_id))

  # Upstream ROMOPAPI returns a named list whose shape has drifted across
  # versions. Normalize to the Parthenon API contract:
  stratified <- counts$stratified_code_counts %||% counts$codeCounts %||% counts$stratifiedCodeCounts
  node_count <- counts$node_count %||%
    (if (!is.null(stratified) && "n" %in% names(stratified)) sum(stratified$n, na.rm = TRUE) else NA_integer_)
  descendant_count <- counts$descendant_count %||% counts$descendantCount %||% NA_integer_

  list(
    concept = counts$concept,
    stratified_counts = stratified,
    node_count = node_count,
    descendant_count = descendant_count
  )
}

# --- 2. Concept relationships (direct SQL against vocab schema) --------

finngen_romopapi_relationships <- function(source_envelope, concept_id) {
  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

  sql <- SqlRender::render(
    "SELECT cr.relationship_id,
            cr.concept_id_2,
            c2.concept_name AS concept_name_2,
            c2.vocabulary_id AS vocabulary_id_2,
            c2.standard_concept
     FROM @vocab.concept_relationship cr
     JOIN @vocab.concept c2 ON c2.concept_id = cr.concept_id_2
     WHERE cr.concept_id_1 = @concept_id
       AND cr.invalid_reason IS NULL
     ORDER BY cr.relationship_id, c2.concept_name
     LIMIT 10000",
    vocab      = source_envelope$schemas$vocab,
    concept_id = as.integer(concept_id)
  )
  conn <- handler$connectionHandler$getConnection()
  rs <- DatabaseConnector::querySql(conn, sql)
  list(relationships = rs)
}

# --- 3. Ancestors / descendants + Mermaid DAG ---------------------------

finngen_romopapi_ancestors <- function(source_envelope, concept_id, direction = "both", max_depth = 5) {
  stopifnot(direction %in% c("up", "down", "both"))
  max_depth <- max(1L, min(10L, as.integer(max_depth)))

  handler <- build_cdm_handler(source_envelope)
  on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)
  conn <- handler$connectionHandler$getConnection()

  vocab <- source_envelope$schemas$vocab
  concept_id <- as.integer(concept_id)
  frames <- list()

  if (direction %in% c("up", "both")) {
    sql_up <- SqlRender::render(
      "SELECT ca.ancestor_concept_id AS src,
              ca.descendant_concept_id AS dst,
              ca.min_levels_of_separation AS depth
       FROM @vocab.concept_ancestor ca
       WHERE ca.descendant_concept_id = @concept_id
         AND ca.min_levels_of_separation BETWEEN 1 AND @max_depth",
      vocab = vocab, concept_id = concept_id, max_depth = max_depth
    )
    frames$up <- DatabaseConnector::querySql(conn, sql_up)
  }
  if (direction %in% c("down", "both")) {
    sql_down <- SqlRender::render(
      "SELECT ca.ancestor_concept_id AS src,
              ca.descendant_concept_id AS dst,
              ca.min_levels_of_separation AS depth
       FROM @vocab.concept_ancestor ca
       WHERE ca.ancestor_concept_id = @concept_id
         AND ca.min_levels_of_separation BETWEEN 1 AND @max_depth",
      vocab = vocab, concept_id = concept_id, max_depth = max_depth
    )
    frames$down <- DatabaseConnector::querySql(conn, sql_down)
  }

  edges <- do.call(rbind, frames)
  if (is.null(edges) || nrow(edges) == 0) {
    edges <- data.frame(SRC = integer(), DST = integer(), DEPTH = integer())
  }

  # Node set = unique union of src, dst, and the anchor concept
  node_ids <- unique(c(edges$SRC, edges$DST, concept_id))
  node_ids <- node_ids[!is.na(node_ids)]

  if (length(node_ids) == 0) {
    nodes <- data.frame(CONCEPT_ID = integer(), CONCEPT_NAME = character())
  } else {
    nodes_sql <- SqlRender::render(
      "SELECT concept_id, concept_name FROM @vocab.concept WHERE concept_id IN (@ids)",
      vocab = vocab,
      ids   = paste(node_ids, collapse = ",")
    )
    nodes <- DatabaseConnector::querySql(conn, nodes_sql)
  }

  # Mermaid DAG — node label first (so IDs resolve), then edges
  mermaid_lines <- c("graph TD")
  if (nrow(nodes) > 0) {
    for (i in seq_len(nrow(nodes))) {
      name <- gsub('"', "'", nodes$CONCEPT_NAME[i], fixed = TRUE)
      name <- substr(name, 1, 80)  # cap label length
      mermaid_lines <- c(mermaid_lines, sprintf('  c%d["%s"]', nodes$CONCEPT_ID[i], name))
    }
  }
  if (nrow(edges) > 0) {
    for (i in seq_len(nrow(edges))) {
      mermaid_lines <- c(mermaid_lines, sprintf("  c%d --> c%d", edges$SRC[i], edges$DST[i]))
    }
  }

  list(
    nodes   = nodes,
    edges   = edges,
    mermaid = paste(mermaid_lines, collapse = "\n")
  )
}
