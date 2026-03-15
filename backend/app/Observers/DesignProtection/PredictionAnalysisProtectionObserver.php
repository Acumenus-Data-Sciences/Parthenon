<?php

namespace App\Observers\DesignProtection;

class PredictionAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'prediction_analysis';
    }
}
