<?php

declare(strict_types=1);

namespace App\Providers;

use App\Services\Templates\TemplateRegistryClient;
use GuzzleHttp\Client;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class TemplatesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TemplateRegistryClient::class, function ($app): TemplateRegistryClient {
            $config = (array) $app['config']->get('services.templates', []);
            $token = $config['internal_token'] ?? null;
            if (! is_string($token) || $token === '') {
                throw new RuntimeException('TEMPLATES_INTERNAL_TOKEN is required to use TemplateRegistryClient.');
            }
            $url = is_string($config['url'] ?? null) ? $config['url'] : 'http://parthenon-templates:8000';
            $timeout = (int) ($config['timeout'] ?? 5);

            $http = new Client([
                'base_uri' => rtrim($url, '/').'/',
                'timeout' => $timeout,
                'connect_timeout' => $timeout,
            ]);

            return new TemplateRegistryClient($http, $token);
        });
    }
}
