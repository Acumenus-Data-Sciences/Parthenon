#!/bin/sh
# Ensure storage and bootstrap/cache are writable by www-data.
# The bind mount (./backend:/var/www/html) resets ownership to the
# host UID on every container create, so we fix it here.
#
# We remap www-data to match the host UID (default 1000) so files
# created by PHP-FPM are owned by the host user, preventing
# permission conflicts with git and other host-side tooling.

HOST_UID="${HOST_UID:-1000}"
HOST_GID="${HOST_GID:-1000}"

# PHP-FPM's pool config references user=www-data and group=www-data by name,
# so the www-data group must exist regardless of what gid we end up with.
# Strategy: keep (or recreate) a group named www-data. Try to give it
# HOST_GID; if that collides with an existing group (e.g. gid 20 is 'dialout'
# inside Alpine but 'staff' on macOS hosts), fall back to the default gid.
# Then remap the www-data user to HOST_UID so files written via the bind
# mount are owned by the host user on Linux. On macOS the gRPC-FUSE /
# virtiofs layer translates uids transparently, so a mismatch is benign.
if ! getent group www-data >/dev/null 2>&1; then
    addgroup -g "$HOST_GID" -S www-data 2>/dev/null || addgroup -S www-data
fi
www_data_gid=$(getent group www-data | cut -d: -f3)

if [ "$(id -u www-data 2>/dev/null)" != "$HOST_UID" ]; then
    deluser www-data 2>/dev/null || true
    adduser -u "$HOST_UID" -G www-data -S -D -H www-data 2>/dev/null \
        || adduser -G www-data -S -D -H www-data
fi

mkdir -p /var/www/html/storage/logs \
         /var/www/html/storage/framework/cache \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/bootstrap/cache

chown -R "www-data:www-data" /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

exec "$@"
