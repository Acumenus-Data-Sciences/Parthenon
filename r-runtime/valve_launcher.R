# plumber2 + mirai launcher — runs the API with async worker daemons.
# Called by s6-overlay, NOT directly by CMD.
#
# mirai daemons handle @async endpoints (estimation, prediction, SCCS)
# in separate R processes, keeping the main event loop responsive.

library(mirai)

# Start persistent mirai worker daemons for @async handlers.
# 3 daemons × ~3GB each (HADES + JVM) = ~9GB, within 32GB container limit.
# The remaining ~23GB is for the main process + JVM heap.
mirai::daemons(n = 3L)

cat(sprintf("[STARTUP] mirai daemons started: %d workers\n", 3L))

# Source and run the plumber2 API
source("/app/plumber_api.R")
