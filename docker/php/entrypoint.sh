#!/bin/sh
# Ensure storage and bootstrap/cache are writable by www-data.
# The bind mount (./backend:/var/www/html) resets ownership to the
# host UID on every container create, so we fix it here.

mkdir -p /var/www/html/storage/logs \
         /var/www/html/storage/framework/cache \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/bootstrap/cache

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

exec "$@"
