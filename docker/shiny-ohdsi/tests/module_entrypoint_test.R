source("docker/shiny-ohdsi/manifest.R")
source("docker/shiny-ohdsi/loaders.R")
source("docker/shiny-ohdsi/handoffs.R")

required_packages <- managed_shiny_official_viewer_packages()
missing_packages <- required_packages[!vapply(required_packages, function(pkg) {
  suppressWarnings(suppressPackageStartupMessages(requireNamespace(pkg, quietly = TRUE)))
}, logical(1))]

if (length(missing_packages) > 0) {
  message(sprintf(
    "Skipping official OHDSI module entrypoint smoke because packages are missing: %s",
    paste(missing_packages, collapse = ", ")
  ))
  quit(status = 0)
}

suppressPackageStartupMessages({
  library(shiny)
  library(OhdsiShinyAppBuilder)
  library(OhdsiShinyModules)
})

registry <- managed_shiny_official_viewer_registry()

for (loader_key in names(registry)) {
  definition <- registry[[loader_key]]

  ui_function <- getExportedValue("OhdsiShinyModules", definition$ui_function)
  server_function <- getExportedValue("OhdsiShinyModules", definition$server_function)
  config_function <- getExportedValue("OhdsiShinyAppBuilder", definition$config_function)

  if (!is.function(ui_function)) {
    stop(sprintf("Registered UI function is unavailable for %s: %s", loader_key, definition$ui_function))
  }
  if (!is.function(server_function)) {
    stop(sprintf("Registered server function is unavailable for %s: %s", loader_key, definition$server_function))
  }
  if (!is.function(config_function)) {
    stop(sprintf("Registered config function is unavailable for %s: %s", loader_key, definition$config_function))
  }

  config <- config_function()
  if (!identical(config$id, definition$module_id)) {
    stop(sprintf("Config module id mismatch for %s.", loader_key))
  }
  if (!identical(config$uiFunction, definition$ui_function)) {
    stop(sprintf("Config UI function mismatch for %s.", loader_key))
  }
  if (!identical(config$serverFunction, definition$server_function)) {
    stop(sprintf("Config server function mismatch for %s.", loader_key))
  }

  ui <- ui_function(definition$module_id)
  if (!inherits(ui, "shiny.tag") && !inherits(ui, "shiny.tag.list") && !inherits(ui, "html")) {
    stop(sprintf("Registered UI function did not return a Shiny UI object for %s.", loader_key))
  }
}

message(sprintf("Validated official OHDSI module entrypoints for %d managed loader families.", length(registry)))
