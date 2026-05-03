<?php

declare(strict_types=1);

namespace App\Exceptions\Templates;

use GuzzleHttp\Exception\ConnectException;
use RuntimeException;
use Throwable;

class TemplateRegistryException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly int $statusCode = 0,
        private readonly ?string $responseBody = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $statusCode, $previous);
    }

    public static function fromStatus(int $status, string $body, string $context): self
    {
        return new self(
            sprintf('Template registry HTTP %d on %s: %s', $status, $context, $body),
            $status,
            $body,
        );
    }

    public static function fromConnect(ConnectException $e, string $context): self
    {
        return new self(
            sprintf('Template registry connect error on %s: %s', $context, $e->getMessage()),
            0,
            null,
            $e,
        );
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getResponseBody(): ?string
    {
        return $this->responseBody;
    }
}
