# Database connection helper for R runtime
# Uses RPostgres to connect to the Parthenon PostgreSQL database

get_db_connection <- function() {
  database_url <- Sys.getenv("DATABASE_URL", "postgresql://parthenon:secret@postgres:5432/parthenon")

  # Parse the URL
  url_parts <- regmatches(database_url, regexec("postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)", database_url))[[1]]

  if (length(url_parts) != 6) {
    stop("Invalid DATABASE_URL format")
  }

  DBI::dbConnect(
    RPostgres::Postgres(),
    user = url_parts[2],
    password = url_parts[3],
    host = url_parts[4],
    port = as.integer(url_parts[5]),
    dbname = url_parts[6]
  )
}
