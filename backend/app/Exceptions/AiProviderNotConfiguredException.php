<?php

namespace App\Exceptions;

use RuntimeException;

class AiProviderNotConfiguredException extends RuntimeException
{
    public function __construct(string $message = 'No AI provider is active or configured. Set an API key and activate a provider in System Health > AI Providers.')
    {
        parent::__construct($message);
    }
}
