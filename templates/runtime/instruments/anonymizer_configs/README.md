# Anonymizer config library

Reference configurations for the `fhir_anonymizer` template. Both configs
validate against the v1 anonymizer config schema
(`runtime/nodes/schemas/anonymizer_config.v1.json`) and are consumed
identically by `MsAnonymizerBackend` and `ParthenonNativeBackend`.

## hipaa_safe_harbor.json

Implements **HIPAA Safe Harbor** de-identification (45 CFR §164.514(b)(2)).
Redacts the 18 enumerated identifiers, hashes patient/practitioner IDs for
re-identification-only-by-keyholder workflows, and date-shifts datetime
fields by up to ±30 days.

**Use when:** the de-identified data leaves your covered-entity boundary
(e.g., research collaborator, public dataset).

**Verification obligation:** A "qualified statistician" review (§164.514(b)(1))
is the *other* HIPAA de-identification path. Safe Harbor is rule-based and
does not require statistician sign-off, but **does not guarantee**
re-identification risk is below the statistical-method threshold. Document
your downstream linkage controls.

## minimal_redaction.json

Research-friendly: redacts names, addresses, telecoms, and free-text notes;
date-shifts birthDate; **keeps gender, communication preferences, and most
clinical fields** for cohort selection.

**Use when:** the data stays inside the covered entity (e.g., honest-broker
workflows; an analytics team within the same hospital system that doesn't
need direct identifiers but does need clinical detail).

**NOT HIPAA Safe Harbor.** Don't ship `minimal_redaction` output outside
your covered-entity boundary without further review.

## How to use these configs

In your `fhir_anonymizer` template invocation:

```json
{
  "config_source": "library",
  "config_name": "hipaa_safe_harbor",
  "...": "..."
}
```

Or pass an inline config:

```json
{
  "config_source": "inline",
  "config": { "version": "1", "rules": [] },
  "...": "..."
}
```

Or point at a customer-supplied JSON file:

```json
{
  "config_source": "file",
  "config_path": "/srv/anonymizer/customer_config.json",
  "...": "..."
}
```

## Adding new configs

Drop a new `*.json` file in this directory. It will be validated by the
`anonymizer_config.v1.json` schema on next run. Update this README with a
short description.
