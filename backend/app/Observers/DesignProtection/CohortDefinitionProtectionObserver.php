<?php

namespace App\Observers\DesignProtection;

class CohortDefinitionProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'cohort_definition';
    }
}
