<?php

namespace App\Observers\DesignProtection;

class EvidenceSynthesisAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'evidence_synthesis_analysis';
    }
}
