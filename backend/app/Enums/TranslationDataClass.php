<?php

declare(strict_types=1);

namespace App\Enums;

enum TranslationDataClass: string
{
    case ProductCopy = 'product_copy';
    case Documentation = 'documentation';
    case ExportTemplate = 'export_template';
    case UserGenerated = 'user_generated';
    case RegulatedClinical = 'regulated_clinical';
    case Phi = 'phi';
}
