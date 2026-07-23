<?php

return [
    // Fail-closed evidence required by VocabularyImportService before it can
    // change a non-empty target. The directory must be a readable pg_dump
    // directory-format backup containing toc.dat.
    'import_backup_path' => env('VOCABULARY_IMPORT_BACKUP_PATH'),
];
