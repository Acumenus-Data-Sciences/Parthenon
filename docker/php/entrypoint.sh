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

# Remap www-data to host UID/GID if different
if [ "$(id -u www-data)" != "$HOST_UID" ]; then
    deluser www-data 2>/dev/null || true
    delgroup www-data 2>/dev/null || true
    addgroup -g "$HOST_GID" -S www-data
    adduser -u "$HOST_UID" -G www-data -S -D -H www-data
fi

mkdir -p /var/www/html/storage/logs \
         /var/www/html/storage/framework/cache \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/bootstrap/cache

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

exec "$@"
