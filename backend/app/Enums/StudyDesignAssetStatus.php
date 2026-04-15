<?php

namespace App\Enums;

enum StudyDesignAssetStatus: string
{
    case NeedsReview = 'needs_review';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Deferred = 'deferred';
}
