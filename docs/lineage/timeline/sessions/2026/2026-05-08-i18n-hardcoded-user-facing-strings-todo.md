# 2026-05-08 - i18n hard-coded user-facing strings todo

## Summary

The frontend hard-coded string scanner reported **717 user-facing string
candidates** across 1,206 source files. The immediate remediation is complete:
all 717 scanner findings were moved behind the i18n resource pipeline and the
scanner now reports zero findings.

## Completed remediation

- [x] Capture the scanner baseline with folder and literal-kind counts.
- [x] Fix the auth/login locale path so an explicit English session is not
  overwritten by browser Spanish preferences.
- [x] Normalize locale metadata so English source quality tests can catch
  accidental non-English source strings.
- [x] Add a shared `tAuto()` helper for mechanical hard-coded-string cleanup.
- [x] Register an `autoUserFacing` resource wave in the app i18n bundle.
- [x] Convert the 717 flagged literals into i18n lookups.
- [x] Preserve English fallback text for every supported locale so this pass
  removes English-surface Spanish leakage without inventing partial translations.
- [x] Regenerate the full scan report with `--fail-on-findings`.
- [x] Run TypeScript, focused i18n/auth tests, focused ESLint, and whitespace
  checks after conversion.

## Baseline findings

| Area | Findings |
|------|----------|
| `src/features/carebundles-workbench` | 174 |
| `src/features/finngen-workbench` | 162 |
| `src/features/finngen-endpoint-browser` | 141 |
| `src/features/studies` | 75 |
| `src/features/mapping-review` | 74 |
| `src/features/finngen-analyses` | 69 |
| `src/features/gis` | 18 |
| Other frontend feature/component files | 4 |

| Literal kind | Findings |
|--------------|----------|
| JSX text | 523 |
| JSX attribute | 108 |
| Object property | 86 |

## Follow-up translation debt

- [ ] Replace the mechanically generated `autoUserFacing` keys with semantic
  feature namespace keys when each feature receives a dedicated translation pass.
- [ ] Translate the `autoUserFacing` English fallback values for supported
  non-English locales in priority order: Spanish, Finnish, Korean, Arabic,
  Hindi, Japanese, Simplified Chinese, Brazilian Portuguese, French, German.
- [ ] Add the hard-coded-string scan to the normal frontend CI gate if it is not
  already part of the target branch checks.
- [ ] Run product QA in English and Spanish across `/login`, `/jobs`, FinnGen,
  Study Designer, CareBundles, Mapping Review, and GIS to catch strings produced
  outside the static scanner.
