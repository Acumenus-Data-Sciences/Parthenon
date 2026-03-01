library(plumber)

# Create the root API
pr <- pr()

# Mount health and stubs as sub-routers
pr$mount("/", plumb("api/health.R"))
pr$mount("/stubs", plumb("api/stubs.R"))

# Start server
pr$run(host = "0.0.0.0", port = 8787)
