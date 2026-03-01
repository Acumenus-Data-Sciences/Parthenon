<?php

namespace App\Enums;

enum ReviewTier: string
{
    case AutoAccepted = 'auto_accepted';
    case QuickReview = 'quick_review';
    case FullReview = 'full_review';
    case Unmappable = 'unmappable';
}
