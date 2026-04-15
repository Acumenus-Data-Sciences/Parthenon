<?php

namespace App\Enums;

enum StudyDesignVerificationStatus: string
{
    case UNVERIFIED = 'unverified';
    case VERIFIED = 'verified';
    case BLOCKED = 'blocked';
    case PARTIAL = 'partial';
}
