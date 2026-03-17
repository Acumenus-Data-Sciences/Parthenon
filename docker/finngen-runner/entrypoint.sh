#!/usr/bin/env bash
set -euo pipefail

MARKER="/opt/runner-state/deps-installed"

mkdir -p /opt/runner-state

export MAKEFLAGS="${MAKEFLAGS:--j1}"
export MAKE="${MAKE:-make -j1}"
export CMAKE_BUILD_PARALLEL_LEVEL="${CMAKE_BUILD_PARALLEL_LEVEL:-1}"
export R_REMOTES_UPGRADE="${R_REMOTES_UPGRADE:-never}"
export R_COMPILE_AND_INSTALL_PACKAGES="${R_COMPILE_AND_INSTALL_PACKAGES:-always}"

if [ ! -f "$MARKER" ]; then
  echo "[finngen-runner] Installing R dependencies..."
  if Rscript /app/install_deps.R; then
    touch "$MARKER"
    echo "[finngen-runner] Dependency bootstrap complete."
  else
    echo "[finngen-runner] Dependency bootstrap failed; runner will start in compatibility mode." >&2
  fi
fi

# Download JDBC driver if missing
JDBC_DIR="${DATABASECONNECTOR_JAR_FOLDER:-/opt/runner-state/jdbc}"
mkdir -p "$JDBC_DIR"
if [ ! -f "$JDBC_DIR/postgresql"*.jar ] 2>/dev/null; then
  echo "[finngen-runner] Downloading PostgreSQL JDBC driver..."
  Rscript -e "library(DatabaseConnector); downloadJdbcDrivers('postgresql', pathToDriver='$JDBC_DIR')" 2>&1 || echo "[finngen-runner] JDBC download failed; R upstream execution may be unavailable." >&2
fi
export DATABASECONNECTOR_JAR_FOLDER="$JDBC_DIR"

exec python /app/server.py
