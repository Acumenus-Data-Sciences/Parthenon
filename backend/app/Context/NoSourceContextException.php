<?php

namespace App\Context;

use Symfony\Component\HttpKernel\Exception\HttpException;

class NoSourceContextException extends HttpException
{
    public function __construct(string $message = '')
    {
        parent::__construct(
            statusCode: 500,
            message: $message ?: 'Source context required but not set. '
                .'Ensure this route uses ResolveSourceContext middleware '
                .'or pass --source to the command.',
        );
    }
}
