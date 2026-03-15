<?php

namespace App\Observers\DesignProtection;

class ConceptSetProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'concept_set';
    }
}
