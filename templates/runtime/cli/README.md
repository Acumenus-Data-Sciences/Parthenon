# parthenon-vocab CLI

Differential analysis between OHDSI Athena vocabulary bundles.

Wired as the `parthenon-vocab` console script (see `[project.scripts]` in
`templates/pyproject.toml`). Implementation lives at
`runtime/cli/vocab_diff.py`.

## Subcommands

### `diff`

```bash
parthenon-vocab diff <bundle_a> <bundle_b> [--output diff.json]
```

Compares two Athena bundle directories and emits JSON listing concepts that
were added, removed, or changed (any column value differs) between them.

Output schema:

```json
{
  "added":   [{"concept_id": 3, "concept_name": "Naproxen", "...": "..."}],
  "removed": [{"concept_id": 2, "concept_name": "Ibuprofen", "...": "..."}],
  "changed": [{"concept_id": 1, "before": {"...": "..."}, "after": {"...": "..."}}]
}
```

`added` and `removed` rows are sorted ascending by `concept_id`. `changed`
rows include both `before` and `after` snapshots for audit-trail use.

If `--output` (or `-o`) is omitted, the JSON is written to stdout.

## Use cases

- Quarterly review when a new Athena bundle is released, before running
  `load_athena_vocabulary` against production.
- Audit trail when a vocabulary change is suspected to have caused a
  downstream concept-mapping regression.
- CI fixtures: snapshot a small Athena slice, regenerate, and assert the
  diff is empty before allowing a vocabulary refresh PR to merge.

## Limitations

- Compares `CONCEPT.csv` only. `CONCEPT_ANCESTOR`, `CONCEPT_RELATIONSHIP`,
  `CONCEPT_SYNONYM`, and other tables are not currently diffed (out of
  scope for Phase 0).
- Memory-bound: full Athena bundles can have ~10M concept rows. The CLI
  loads both bundles fully into memory. For bundles >2M concepts, use a
  database-backed diff (out of scope for Phase 0).
- Tab-delimited UTF-8 input only — matches Athena's distribution format.
  Other delimiters/encodings are not auto-detected.

## Exit codes

| Code | Meaning                                                    |
|------|------------------------------------------------------------|
| 0    | Diff produced successfully (regardless of whether the diff is empty). |
| 2    | A bundle is missing `CONCEPT.csv` or another input error.  |
