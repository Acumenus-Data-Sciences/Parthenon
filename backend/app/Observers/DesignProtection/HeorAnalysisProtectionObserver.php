<?php

namespace App\Observers\DesignProtection;

class HeorAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'heor_analysis';
    }
}
