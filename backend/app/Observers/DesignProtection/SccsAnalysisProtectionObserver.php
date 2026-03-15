<?php

namespace App\Observers\DesignProtection;

class SccsAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'sccs_analysis';
    }
}
