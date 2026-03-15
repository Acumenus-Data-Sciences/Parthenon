<!---
Group:condition
Name:C01 Find condition by concept ID
Author:Patrick Ryan
CDM Version: 5.3
-->
# C01: Find condition by concept ID

## Description
Find condition by condition ID is the lookup for obtaining condition or disease concept details associated with a concept identifier.

## Query
```sql
SELECT
  c.concept_id       AS condition_concept_id,
  c.concept_name     AS condition_concept_name
FROM @vocab.concept AS c
JOIN @cdm.condition_occurrence AS co
  ON co.condition_concept_id = c.concept_id
WHERE
  c.concept_id = 192671 AND
  c.invalid_reason IS NULL
;
```

## Input

|  Parameter |  Example |  Mandatory |  Notes |
| --- | --- | --- | ------------------------------------------- |
|  Concept ID |  192671 |  Yes | Concept Identifier for GI - Gastrointestinal haemorrhage |

## Output

|  Field |  Description |
| --- | ----------------------------------------------- |
|  Condition_Concept_ID |  Condition concept Identifier entered as input |
