library(plumber)

# Create the root API with health as the main plumber file
pr <- plumb("/app/api/health.R")

# Mount sub-routers
pr$mount("/stubs", plumb("/app/api/stubs.R"))
pr$mount("/analysis/estimation", plumb("/app/api/estimation.R"))
pr$mount("/analysis/prediction", plumb("/app/api/prediction.R"))
pr$mount("/analysis/sccs", plumb("/app/api/sccs.R"))
pr$mount("/analysis/evidence-synthesis", plumb("/app/api/evidence_synthesis.R"))
pr$mount("/analysis/cohort-diagnostics", plumb("/app/api/cohort_diagnostics.R"))
pr$mount("/analysis/cohort-incidence", plumb("/app/api/cohort_incidence.R"))
pr$mount("/analysis/characterization", plumb("/app/api/characterization.R"))
pr$mount("/study", plumb("/app/api/study_bridge.R"))
pr$mount("/strategus", plumb("/app/api/strategus.R"))
pr$mount("/etl/synthea", plumb("/app/api/synthea.R"))

# Start server
pr$run(host = "0.0.0.0", port = 8787)
