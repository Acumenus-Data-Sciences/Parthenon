library(plumber)

# Create the root API
pr <- pr()

# Mount health endpoint
pr$mount("/", plumb("api/health.R"))

# Mount legacy stubs (kept for backwards compat during transition)
pr$mount("/stubs", plumb("api/stubs.R"))

# Mount HADES analysis routers
pr$mount("/analysis/estimation", plumb("api/estimation.R"))
pr$mount("/analysis/prediction", plumb("api/prediction.R"))
pr$mount("/analysis/sccs", plumb("api/sccs.R"))
pr$mount("/analysis/evidence-synthesis", plumb("api/evidence_synthesis.R"))

# Mount study bridge (Parthenon study orchestrator → HADES)
pr$mount("/study", plumb("api/study_bridge.R"))

# Start server
pr$run(host = "0.0.0.0", port = 8787)
