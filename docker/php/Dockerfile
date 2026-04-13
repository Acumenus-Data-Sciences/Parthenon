FROM php:8.4-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    linux-headers \
    postgresql-dev \
    libzip-dev \
    zip \
    unzip \
    git \
    curl \
    fcgi \
    icu-dev \
    oniguruma-dev

# Install PHP extensions
RUN docker-php-ext-install \
    pdo_pgsql \
    pgsql \
    zip \
    bcmath \
    intl \
    mbstring \
    pcntl \
    opcache

# Install Redis extension
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

# GD extension (PhpWord image support)
RUN apk add --no-cache freetype-dev libjpeg-turbo-dev libpng-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd

# Imagick for SVG→PNG conversion (publication exports)
RUN apk add --no-cache imagemagick imagemagick-dev autoconf g++ make \
    && pecl install imagick \
    && docker-php-ext-enable imagick \
    && apk del autoconf g++ make

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# PHP-FPM healthcheck script — pinned to known-good commit
RUN wget -O /usr/local/bin/php-fpm-healthcheck \
    https://raw.githubusercontent.com/renatomefi/php-fpm-healthcheck/v0.5.0/php-fpm-healthcheck \
    && chmod +x /usr/local/bin/php-fpm-healthcheck

# Configure PHP
COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/zz-custom.conf

# Graceful reload: wait up to 5 minutes for in-flight workers to finish
# before killing them on USR2. Default 0 = kill immediately, which aborts
# long-running requests (Patient Similarity PSM / landscape) mid-compute.
RUN sed -i 's/^;\?process_control_timeout\s*=.*/process_control_timeout = 300s/' \
      /usr/local/etc/php-fpm.conf \
    && grep -q '^process_control_timeout' /usr/local/etc/php-fpm.conf \
    || echo 'process_control_timeout = 300s' >> /usr/local/etc/php-fpm.conf

WORKDIR /var/www/html

# Install dependencies (cached layer)
COPY backend/composer.json backend/composer.lock* ./
RUN composer install --no-scripts --no-autoloader --prefer-dist

# Copy application
COPY backend/ .
RUN composer dump-autoload --optimize

# Set permissions (build-time — overridden by bind mount, but kept for non-mount deploys)
RUN mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Entrypoint fixes storage permissions after bind mount overwrites ownership
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm"]
