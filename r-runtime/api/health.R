#* Health check endpoint
#* @get /health
#* @serializer unboxedJSON
function() {
  list(
    status = "ok",
    service = "parthenon-r-runtime",
    version = "0.1.0",
    r_version = paste(R.version$major, R.version$minor, sep = ".")
  )
}
