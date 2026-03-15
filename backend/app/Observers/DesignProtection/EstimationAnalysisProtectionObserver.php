<?php

namespace App\Observers\DesignProtection;

class EstimationAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'estimation_analysis';
    }
}
