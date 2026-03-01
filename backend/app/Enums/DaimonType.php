<?php

namespace App\Enums;

enum DaimonType: string
{
    case CDM = 'cdm';
    case Vocabulary = 'vocabulary';
    case Results = 'results';
    case Temp = 'temp';
}
