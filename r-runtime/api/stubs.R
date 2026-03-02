#* Run population-level estimation (stub)
#* @post /estimation
#* @serializer unboxedJSON
function(req, res) {
  spec <- req$body
  res$status <- 501L
  list(
    status = "not_implemented",
    message = "Not yet implemented - requires HADES CohortMethod package",
    spec_received = !is.null(spec),
    spec_keys = if (!is.null(spec)) names(spec) else list(),
    hint = "This endpoint will integrate with the OHDSI CohortMethod R package for comparative cohort analysis"
  )
}

#* Run patient-level prediction (stub)
#* @post /prediction
#* @serializer unboxedJSON
function(req, res) {
  spec <- req$body
  res$status <- 501L
  list(
    status = "not_implemented",
    message = "Not yet implemented - requires HADES PatientLevelPrediction package",
    spec_received = !is.null(spec),
    spec_keys = if (!is.null(spec)) names(spec) else list(),
    hint = "This endpoint will integrate with the OHDSI PatientLevelPrediction R package for predictive modeling"
  )
}

#* Run feature extraction (stub)
#* @post /feature-extraction
#* @serializer unboxedJSON
function(req, res) {
  spec <- req$body
  res$status <- 501L
  list(
    status = "not_implemented",
    message = "Not yet implemented - requires HADES FeatureExtraction package",
    spec_received = !is.null(spec),
    spec_keys = if (!is.null(spec)) names(spec) else list(),
    hint = "This endpoint will integrate with the OHDSI FeatureExtraction R package for covariate construction"
  )
}

#* Run self-controlled case series (stub)
#* @post /self-controlled
#* @serializer unboxedJSON
function(req, res) {
  spec <- req$body
  res$status <- 501L
  list(
    status = "not_implemented",
    message = "Not yet implemented - requires HADES SelfControlledCaseSeries package",
    spec_received = !is.null(spec),
    spec_keys = if (!is.null(spec)) names(spec) else list(),
    hint = "This endpoint will integrate with the OHDSI SelfControlledCaseSeries R package"
  )
}
