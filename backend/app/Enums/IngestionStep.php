<?php

namespace App\Enums;

enum IngestionStep: string
{
    case Profiling = 'profiling';
    case SchemaMapping = 'schema_mapping';
    case ConceptMapping = 'concept_mapping';
    case Review = 'review';
    case CdmWriting = 'cdm_writing';
    case Validation = 'validation';
}
