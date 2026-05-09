options(shiny.port = 3838, shiny.host = "0.0.0.0")

suppressPackageStartupMessages({
  library(shiny)
  library(jsonlite)
  library(httr2)
})

api_url <- sub("/+$", "", Sys.getenv("PARTHENON_API_URL", "http://nginx:80/api/v1"))

resolve_launch <- function(token) {
  req <- request(paste0(api_url, "/shiny/launch-context")) |>
    req_method("POST") |>
    req_body_json(list(launch_token = token), auto_unbox = TRUE) |>
    req_timeout(30)

  resp <- req_perform(req)
  body <- resp_body_json(resp, simplifyVector = FALSE)
  body$data
}

value_or <- function(value, fallback = "") {
  if (is.null(value) || length(value) == 0) {
    return(fallback)
  }

  value
}

ui <- fluidPage(
  tags$head(
    tags$style(HTML("
      body { background: #f7f8fa; color: #1f2937; }
      .container-fluid { max-width: 1180px; padding: 24px; }
      .panel { background: white; border: 1px solid #d8dee8; border-radius: 8px; padding: 18px; margin-bottom: 16px; }
      .eyebrow { color: #64748b; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
      .metric { display: inline-block; margin-right: 16px; color: #475569; }
      pre { background: #0f172a; color: #e2e8f0; border: 0; border-radius: 6px; }
    "))
  ),
  uiOutput("launch_status"),
  uiOutput("context_summary"),
  uiOutput("artifact_files"),
  uiOutput("package_status")
)

server <- function(input, output, session) {
  launch_context <- reactiveVal(NULL)
  launch_error <- reactiveVal(NULL)

  observeEvent(session$clientData$url_search, {
    query <- parseQueryString(session$clientData$url_search)
    token <- query$parthenon_launch

    if (is.null(token) || token == "") {
      launch_error("Missing Parthenon launch token. Open this viewer from a managed Parthenon study artifact.")
      return()
    }

    tryCatch(
      {
        launch_context(resolve_launch(token))
        launch_error(NULL)
      },
      error = function(err) {
        launch_error(conditionMessage(err))
      }
    )
  }, ignoreInit = FALSE)

  output$launch_status <- renderUI({
    err <- launch_error()
    context <- launch_context()

    if (!is.null(err)) {
      return(div(class = "panel", div(class = "eyebrow", "Launch blocked"), p(err)))
    }

    if (is.null(context)) {
      return(div(class = "panel", div(class = "eyebrow", "Launching"), p("Resolving Parthenon study artifact context...")))
    }

    div(
      class = "panel",
      div(class = "eyebrow", "Managed OHDSI Shiny"),
      h2(value_or(context$app$label, "OHDSI Viewer")),
      span(class = "metric", paste("Runtime app:", value_or(context$app$key))),
      span(class = "metric", paste("Workspace:", value_or(context$launch$workspace_id)))
    )
  })

  output$context_summary <- renderUI({
    context <- launch_context()
    req(context)

    div(
      class = "panel",
      div(class = "eyebrow", "Study Artifact"),
      h3(value_or(context$artifact$title, "Untitled artifact")),
      p(value_or(context$artifact$description, "No artifact description provided.")),
      tags$dl(
        tags$dt("Study"),
        tags$dd(value_or(context$study$title)),
        tags$dt("Artifact type"),
        tags$dd(value_or(context$artifact$artifact_type)),
        tags$dt("Version"),
        tags$dd(value_or(context$artifact$version)),
        tags$dt("Context file"),
        tags$dd(code(value_or(context$workspace$context_path)))
      )
    )
  })

  output$artifact_files <- renderUI({
    context <- launch_context()
    req(context)

    workspace <- value_or(context$workspace$container_path)
    files <- if (dir.exists(workspace)) {
      list.files(workspace, recursive = TRUE, full.names = FALSE)
    } else {
      character()
    }

    div(
      class = "panel",
      div(class = "eyebrow", "Mounted Launch Workspace"),
      if (length(files) == 0) {
        p("The launch workspace is ready, but this artifact did not materialize a local file.")
      } else {
        tags$ul(lapply(files, tags$li))
      }
    )
  })

  output$package_status <- renderUI({
    context <- launch_context()
    req(context)

    packages <- unique(c(
      value_or(context$app$package),
      "OhdsiShinyModules",
      "OhdsiShinyAppBuilder"
    ))
    packages <- packages[packages != ""]
    rows <- lapply(packages, function(pkg) {
      installed <- requireNamespace(pkg, quietly = TRUE)
      tags$tr(
        tags$td(pkg),
        tags$td(if (installed) as.character(packageVersion(pkg)) else "not installed"),
        tags$td(if (installed) "available" else "missing")
      )
    })

    div(
      class = "panel",
      div(class = "eyebrow", "OHDSI Runtime Packages"),
      tags$table(
        class = "table table-condensed",
        tags$thead(tags$tr(tags$th("Package"), tags$th("Version"), tags$th("Status"))),
        tags$tbody(rows)
      )
    )
  })
}

shinyApp(ui, server)
