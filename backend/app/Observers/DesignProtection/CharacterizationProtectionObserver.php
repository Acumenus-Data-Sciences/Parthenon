<?php

namespace App\Observers\DesignProtection;

class CharacterizationProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'characterization';
    }
}
