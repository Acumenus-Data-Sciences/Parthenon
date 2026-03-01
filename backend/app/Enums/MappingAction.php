<?php

namespace App\Enums;

enum MappingAction: string
{
    case Approve = 'approve';
    case Reject = 'reject';
    case Remap = 'remap';
}
