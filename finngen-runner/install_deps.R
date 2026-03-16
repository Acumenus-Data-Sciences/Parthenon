options(repos = c(CRAN = "https://cloud.r-project.org"))
options(Ncpus = 1L)

Sys.setenv(
  MAKEFLAGS = "-j1",
  MAKE = "make -j1",
  CMAKE_BUILD_PARALLEL_LEVEL = "1",
  R_REMOTES_UPGRADE = "never",
  NOT_CRAN = "true"
)

install_one <- function(pkg) {
  if (requireNamespace(pkg, quietly = TRUE)) {
    return(TRUE)
  }

  message("Installing CRAN package: ", pkg)
  tryCatch(
    {
      install.packages(pkg, Ncpus = 1L)
      requireNamespace(pkg, quietly = TRUE)
    },
    error = function(err) {
      message("Failed to install CRAN package ", pkg, ": ", conditionMessage(err))
      FALSE
    }
  )
}

install_github_one <- function(repo, pkg_name) {
  if (requireNamespace(pkg_name, quietly = TRUE)) {
    return(TRUE)
  }

  message("Installing GitHub package: ", repo)
  tryCatch(
    {
      remotes::install_github(
        repo,
        upgrade = "never",
        dependencies = FALSE,
        INSTALL_opts = c("--no-multiarch", "--no-test-load")
      )
      requireNamespace(pkg_name, quietly = TRUE)
    },
    error = function(err) {
      message("Failed to install GitHub package ", repo, ": ", conditionMessage(err))
      FALSE
    }
  )
}

install_local_one <- function(path, pkg_name) {
  if (requireNamespace(pkg_name, quietly = TRUE)) {
    return(TRUE)
  }

  if (!file.exists(path)) {
    message("Skipping missing local package path: ", path)
    return(FALSE)
  }

  message("Installing local package: ", path)
  tryCatch(
    {
      remotes::install_local(
        path,
        upgrade = "never",
        dependencies = FALSE,
        force = TRUE,
        INSTALL_opts = c("--no-multiarch", "--no-test-load")
      )
      requireNamespace(pkg_name, quietly = TRUE)
    },
    error = function(err) {
      message("Failed to install local package ", path, ": ", conditionMessage(err))
      FALSE
    }
  )
}

install_one("remotes")

core_cran_packages <- c(
  "checkmate",
  "dplyr",
  "tibble",
  "purrr",
  "rlang",
  "stringr",
  "yaml",
  "jsonlite",
  "digest",
  "memoise",
  "R6",
  "DBI"
)

ui_cran_packages <- c(
  "htmltools",
  "htmlwidgets",
  "reactable",
  "shiny",
  "shinydashboard",
  "shinyjs",
  "shinycustomloader",
  "shinyWidgets",
  "ggupset",
  "ggplot2",
  "plotly",
  "DT",
  "apexcharter",
  "colourpicker",
  "shinyFeedback",
  "shinyjqui",
  "shinybrowser",
  "shinycssloaders",
  "tippy",
  "upsetjs",
  "UpSetR",
  "ggiraph",
  "ggplotify",
  "ggrepel",
  "ggh4x",
  "phosphoricons",
  "datamods"
)

analysis_cran_packages <- c(
  "forcats",
  "httr",
  "tidyr",
  "lubridate",
  "duckdb",
  "openxlsx",
  "zip",
  "pool",
  "readr",
  "scales",
  "dbplyr",
  "validate",
  "rmarkdown",
  "plumber",
  "RJSONIO",
  "renv",
  "gtable",
  "speedglm",
  "bigrquery",
  "knitr",
  "withr"
)

source_only_heavy_packages <- c(
  "DiagrammeR"
)

failures <- character()

for (pkg in c(core_cran_packages, ui_cran_packages, analysis_cran_packages)) {
  if (!isTRUE(install_one(pkg))) {
    failures <- c(failures, pkg)
  }
}

for (pkg in source_only_heavy_packages) {
  if (!isTRUE(install_one(pkg))) {
    failures <- c(failures, pkg)
  }
}

github_packages <- list(
  c("OHDSI/SqlRender", "SqlRender"),
  c("OHDSI/ParallelLogger", "ParallelLogger"),
  c("javier-gracia-tabuenca-tuni/DatabaseConnector@bigquery-DBI-2", "DatabaseConnector"),
  c("ohdsi/Andromeda", "Andromeda"),
  c("ohdsi/FeatureExtraction", "FeatureExtraction"),
  c("ohdsi/ResultModelManager", "ResultModelManager"),
  c("ohdsi/CohortGenerator", "CohortGenerator"),
  c("OHDSI/CommonDataModel", "CommonDataModel"),
  c("OHDSI/Eunomia", "Eunomia"),
  c("OHDSI/ROhdsiWebApi", "ROhdsiWebApi")
)

for (spec in github_packages) {
  if (!isTRUE(install_github_one(spec[[1]], spec[[2]]))) {
    failures <- c(failures, spec[[2]])
  }
}

local_packages <- list(
  c("/opt/finngen/HadesExtras", "HadesExtras"),
  c("/opt/finngen/CO2AnalysisModules", "CO2AnalysisModules"),
  c("/opt/finngen/ROMOPAPI", "ROMOPAPI"),
  c("/opt/finngen/CohortOperations2", "CohortOperations2")
)

for (spec in local_packages) {
  if (!isTRUE(install_local_one(spec[[1]], spec[[2]]))) {
    failures <- c(failures, spec[[2]])
  }
}

if (length(failures) > 0) {
  failures <- unique(failures)
  message("Bootstrap incomplete. Remaining failures: ", paste(failures, collapse = ", "))
  quit(status = 1)
}
