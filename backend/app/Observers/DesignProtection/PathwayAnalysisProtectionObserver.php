<?php

namespace App\Observers\DesignProtection;

class PathwayAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'pathway_analysis';
    }
}
