#!/bin/bash
# Create Solr cores that have configsets available.
# Only creates cores where a matching configset directory exists.

set -e

CONFIGSET_BASE="/opt/solr/server/solr/configsets"

# Only create cores that have configsets — future phases add more
for configdir in "${CONFIGSET_BASE}"/*/; do
  core=$(basename "$configdir")
  # Skip Solr's built-in configsets
  if [[ "$core" == "_default" || "$core" == "sample_techproducts_configs" ]]; then
    continue
  fi
  if [ ! -d "/var/solr/data/${core}" ]; then
    echo "Creating core '${core}' from configset ${configdir}..."
    precreate-core "$core" "$configdir"
  else
    echo "Core '${core}' already exists, skipping."
  fi
done

exec solr-foreground
