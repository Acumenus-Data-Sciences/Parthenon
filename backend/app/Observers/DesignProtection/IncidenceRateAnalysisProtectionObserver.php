<?php

namespace App\Observers\DesignProtection;

class IncidenceRateAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'incidence_rate_analysis';
    }
}
