#!/bin/sh
# Source each /run/secrets/* file as an environment variable before exec.
# Used when Docker secrets are bind-mounted from .secrets/ via compose override.
for f in /run/secrets/*; do
    [ -f "$f" ] && export "$(basename "$f")"="$(cat "$f")"
done
exec "$@"
