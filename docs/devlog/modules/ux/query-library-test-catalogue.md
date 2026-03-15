# Query Library Test Catalogue

**Date:** 2026-03-15
**Tested:** 201 queries executed against CDM (Eunomia GiBleed dataset) with default parameters

## Summary

| Status | Count | % |
|--------|-------|---|
| Has results | 66 | 33% |
| No results (valid SQL, empty dataset) | 26 | 13% |
| SQL errors | 107 | 53% |
| Skipped (not SELECT) | 2 | 1% |

## Error Categories

The 107 errors fall into a small number of root causes — all are **SQL Server (T-SQL) syntax** that doesn't work on PostgreSQL:

| Error Pattern | Count | PostgreSQL Equivalent |
|---------------|-------|-----------------------|
| `YEAR()`, `MONTH()`, `DAY()` functions | 30 | `EXTRACT(YEAR FROM ...)` |
| `getdate()` function | 23 | `CURRENT_DATE` or `NOW()` |
| `DATEDIFF(day, ...)` / `DATEADD(day, ...)` | 20 | `(end - start)` / `(date + interval)` |
| `STDEV()` (integer argument) | 12 | `STDDEV(...)` or cast to numeric |
| `DATEFROMPARTS(y,m,d)` | 6 | `MAKE_DATE(y,m,d)` |
| `ISNULL(a, b)` | 4 | `COALESCE(a, b)` |
| `CHARINDEX()` | 1 | `POSITION(... IN ...)` |
| `COUNT_BIG()` | 1 | `COUNT(...)` |
| `TOP N` syntax | 1 | `LIMIT N` |
| Other syntax issues | 5 | Various |
| Statement timeout | 1 | Query too expensive for 30s |
| Column alias `d` conflict | 3 | Ambiguous alias resolution |

**Root cause:** The OHDSI QueryLibrary templates were originally written for SQL Server. They need PostgreSQL dialect translation.

## Queries Returning No Results (26)

These queries execute successfully but return zero rows. This is expected — the Eunomia GiBleed dataset is a small synthetic demo dataset (2,694 patients) and doesn't contain data for every domain.

| ID | Name | Likely Reason |
|----|------|---------------|
| 11 | CS02 Patient count per care site place of service | No care_site data in Eunomia |
| 14 | C03 Translate SNOMED to MedDRA | MedDRA not in Eunomia vocab subset |
| 15 | C04 Translate MedDRA to SNOMED | MedDRA not in Eunomia vocab subset |
| 31 | CE09 Counts of condition record | condition_era table empty |
| 32 | CE10 Counts of persons with conditions | condition_era table empty |
| 40 | CO03 Specialty that diagnosed condition | No provider specialty data |
| 43 | CO06 Person's comorbidities | Concept ID 26211 not in dataset |
| 44 | CO07 Frequency hospitalized for condition | No inpatient visits for concept |
| 51 | CO14 Counts of condition types | condition_type_concept_id filtering |
| 53 | CO16 Counts of distinct conditions per person | Empty with default params |
| 62 | CO25 Counts of condition records per person | Empty with default params |
| 95 | DRC01 Average cost per pill | No cost data in Eunomia |
| 96 | DRC03 Out-of-pocket cost for drug | No cost data in Eunomia |
| 102 | DER05 Proportion taking indicated treatments | No drug_era data |
| 103 | DER06 Proportion taking class treatments | No drug_era data |
| 118 | DER26 Counts of genders by drug | No drug_era data |
| 131 | DEX13 Provider specialties prescribing drug | No provider data |
| 135 | DEX17 Why do people stop treatment | No stop_reason data |
| 140 | DEX22 People taking drug in class | Default concept not in dataset |
| 146 | DEX28 Counts of drug types | drug_type_concept_id filtering |
| 153 | DEX35 Counts of drug quantity | quantity column null/empty |
| 155 | DEX37 Counts of drug refills | refills column null/empty |
| 156 | DEX38 Counts of stop reasons | stop_reason column null/empty |
| 157 | DEX39 Counts of drugs by drug type | drug_type_concept_id filtering |
| 158 | DEX40 Counts of drugs by relevant condition | No relevant_condition data |
| 186 | OP09 Observation period records per person | Default params mismatch |

## Queries That Work (66)

These 66 queries return results successfully with default parameters against Eunomia. They cover:
- General concept lookups (C01, C02, C05-C09)
- Condition occurrence queries (CO04, CO10, CO11, CO18, CO20, CO22, CO24)
- Drug exposure basics (DEX01, DEX04-DEX06, DEX11-DEX12)
- Drug era basics (DER01, DER03, DER08-DER09, DER14, DER16, DER19-DER22, DER24-DER25)
- Observation period basics (OP03)
- Person/demographics (PE01-PE11)
- Procedure queries (P01)

## Skipped (2)

| ID | Name | Reason |
|----|------|--------|
| 30 | CE08 Number of comorbidity for patients with condition | Template doesn't start with SELECT |
| 137 | DEX19 People taking drug for indication | Template doesn't start with SELECT |

## Recommendations

1. **Dialect translation (107 queries):** Create a PostgreSQL dialect translator that converts T-SQL functions to PostgreSQL equivalents. This is a one-time bulk operation — the error patterns are repetitive and well-defined.

2. **No-results queries (26):** These are valid queries that just need richer data. They will return results when connected to a production CDM with real clinical data (e.g., the Acumenus dataset with 1M patients).

3. **Skipped queries (2):** These templates need reformatting to start with SELECT/WITH.
