<?php

declare(strict_types=1);

namespace App\Enums;

enum LabStatus: string
{
    case Low = 'low';
    case Normal = 'normal';
    case High = 'high';
    case Critical = 'critical';
    case Unknown = 'unknown';
}
