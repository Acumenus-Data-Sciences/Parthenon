<?php

namespace App\Services\DesignProtection;

class DesignFixtureExporter
{
    public function exportEntity(string $entityType, int $entityId): void {}

    public function deleteEntityFile(string $entityType, int $entityId): void {}

    public function exportAll(): ExportSummary
    {
        return ExportSummary::empty();
    }
}
