<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class NotOwnedRunException extends RuntimeException
{
    public function __construct(
        public readonly int $existingTrackingId,
        public readonly int $ownerUserId,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Cannot overwrite tracking row #{$existingTrackingId} — owned by user #{$ownerUserId}. Only the owner or an admin may overwrite."
        );
    }
}
