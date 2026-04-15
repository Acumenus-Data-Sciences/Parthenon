<?php

namespace App\Enums;

enum StudyDesignAssetStatus: string
{
    case NEEDS_REVIEW = 'needs_review';
    case ACCEPTED = 'accepted';
    case REJECTED = 'rejected';
    case DEFERRED = 'deferred';
    case MATERIALIZED = 'materialized';
}
