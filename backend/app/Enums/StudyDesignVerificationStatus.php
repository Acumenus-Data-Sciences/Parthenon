<?php

namespace App\Enums;

enum StudyDesignVerificationStatus: string
{
    case Unverified = 'unverified';
    case Verified = 'verified';
    case Blocked = 'blocked';
}
