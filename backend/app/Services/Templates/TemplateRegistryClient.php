<?php

declare(strict_types=1);

namespace App\Services\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\ResponseInterface;

class TemplateRegistryClient
{
    public function __construct(
        private readonly Client $http,
        private readonly string $internalToken,
    ) {}

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listTemplates(): array
    {
        /** @var array<int,array<string,mixed>> $decoded */
        $decoded = $this->json('GET', '/templates');

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function getTemplate(string $id): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/templates/%s', $id));

        return $decoded;
    }

    /**
     * @param  array<string,mixed>  $parameters
     * @return array<string,mixed>
     */
    public function submitRun(string $templateId, string $version, array $parameters, string $correlationId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('POST', '/runs', [
            'json' => [
                'template_id' => $templateId,
                'version' => $version,
                'parameters' => $parameters,
                'correlation_id' => $correlationId,
            ],
        ]);

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function getRun(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/runs/%s', $prefectRunId));

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function getLogs(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/runs/%s/logs', $prefectRunId));

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function getArtifacts(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/runs/%s/artifacts', $prefectRunId));

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function cancelRun(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('DELETE', sprintf('/runs/%s', $prefectRunId));

        return $decoded;
    }

    /**
     * @param  array<string,mixed>  $options
     * @return array<int|string,mixed>
     */
    protected function json(string $method, string $path, array $options = []): array
    {
        $context = sprintf('%s %s', $method, $path);

        try {
            $response = $this->http->request($method, $path, array_merge_recursive(
                ['headers' => ['X-Parthenon-Internal-Token' => $this->internalToken, 'Accept' => 'application/json']],
                $options,
            ));
        } catch (ConnectException $e) {
            throw TemplateRegistryException::fromConnect($e, $context);
        } catch (RequestException $e) {
            throw $this->mapRequestException($e, $context);
        } catch (GuzzleException $e) {
            throw new TemplateRegistryException(sprintf('Template registry transport error on %s: %s', $context, $e->getMessage()), 0, null, $e);
        }

        return $this->decode($response, $context);
    }

    protected function mapRequestException(RequestException $e, string $context): TemplateRegistryException
    {
        $response = $e->getResponse();
        if ($response instanceof ResponseInterface) {
            return TemplateRegistryException::fromStatus(
                $response->getStatusCode(),
                (string) $response->getBody(),
                $context,
            );
        }

        return new TemplateRegistryException(sprintf('Template registry request error on %s: %s', $context, $e->getMessage()), 0, null, $e);
    }

    /**
     * @return array<int|string,mixed>
     */
    protected function decode(ResponseInterface $response, string $context): array
    {
        $body = (string) $response->getBody();
        if ($response->getStatusCode() >= 400) {
            throw TemplateRegistryException::fromStatus($response->getStatusCode(), $body, $context);
        }

        /** @var mixed $decoded */
        $decoded = json_decode($body, true);
        if (! is_array($decoded)) {
            throw new TemplateRegistryException(sprintf('Template registry returned non-JSON on %s', $context), $response->getStatusCode(), $body);
        }

        return $decoded;
    }
}
