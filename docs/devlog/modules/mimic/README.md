# MIMIC — Clinical Database Integration

This directory documents integration of the MIMIC-IV ICU dataset into Parthenon, including ingestion procedures, data dictionaries, and augmentation strategies.

## Documentation

| Document | Subject |
|----------|---------|
| [MIMIC Ingest Handoff](DEVLOG_MIMIC_INGEST_HANDOFF.md) | Ingestion workflow, ETL procedures, deployment notes |
| [MIMIC Export Data Dictionary](MIMIC_EXPORT_DATA_DICTIONARY.md) | Field mappings, data types, validation rules |
| [Synthetic Augmentation Plan](SYNTHETIC_AUGMENTATION_PLAN.md) | Data synthesis strategy, privacy preservation techniques |

## Related Resources

SQL scripts and ETL tools for MIMIC data processing have been relocated to:
- `scripts/importers/` — Data import and ingestion scripts

See the main [scripts/importers README](../../../../scripts/importers/README.md) for execution procedures and integration with the data pipeline.

## MIMIC-IV References

- **Dataset**: MIMIC-IV v2.2 (PhysioNet)
- **ICU records**: Carevue & MetaVision systems
- **Coverage**: ~380K hospital admissions, ~53K ICU stays
