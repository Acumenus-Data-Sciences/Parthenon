<?php

declare(strict_types=1);

namespace App\Services\Translation;

use App\Contracts\TranslationProviderInterface;
use App\Enums\TranslationDataClass;

final class TranslationPolicyService
{
    public function allowsProvider(TranslationProviderInterface $provider, TranslationDataClass $class): bool
    {
        return $this->allowsDataClass($class) && $provider->supportsDataClass($class);
    }

    public function allowsDataClass(TranslationDataClass $class): bool
    {
        if ($class === TranslationDataClass::Phi) {
            return (bool) config('translation.allow_phi', false);
        }

        return in_array($class->value, (array) config('translation.allowed_data_classes', []), true);
    }
}
