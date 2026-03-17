-- Combined result (source_to_standard + source_to_source)
WITH
{source_to_standard},
{source_to_source}

SELECT * FROM Source_to_Standard

UNION ALL

SELECT * FROM Source_to_Source
