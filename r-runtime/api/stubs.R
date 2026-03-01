#* Run population-level estimation (stub)
#* @post /estimation
#* @serializer unboxedJSON
function(req, res) {
  res$status <- 501L
  list(message = "Not yet implemented - requires HADES CohortMethod package")
}

#* Run patient-level prediction (stub)
#* @post /prediction
#* @serializer unboxedJSON
function(req, res) {
  res$status <- 501L
  list(message = "Not yet implemented - requires HADES PatientLevelPrediction package")
}

#* Run feature extraction (stub)
#* @post /feature-extraction
#* @serializer unboxedJSON
function(req, res) {
  res$status <- 501L
  list(message = "Not yet implemented - requires HADES FeatureExtraction package")
}

#* Run self-controlled case series (stub)
#* @post /self-controlled
#* @serializer unboxedJSON
function(req, res) {
  res$status <- 501L
  list(message = "Not yet implemented - requires HADES SelfControlledCaseSeries package")
}
