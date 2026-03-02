library(plumber)

# Create the root API
pr <- pr()

# Mount health and stubs as sub-routers
pr$mount("/", plumb("api/health.R"))
pr$mount("/stubs", plumb("api/stubs.R"))

# Mount analysis routers (skeleton for HADES integration)
pr$mount("/analysis/estimation", plumb("api/estimation.R"))
pr$mount("/analysis/prediction", plumb("api/prediction.R"))

# Start server
pr$run(host = "0.0.0.0", port = 8787)
