# LZZT (CDISC Pilot 01) Reference Dataset

This directory holds the CDISC Pilot 01 ("LZZT") SDTM XPT files used by
`tests/e2e/test_sdtm_to_omop_v54.py`. The files are **not committed** to
the repo (Phase 2 spec decision Q10) — fetch them on demand:

```bash
make fetch-fixtures
```

## Offline / mirrored fallback

If the upstream URL is unreachable (CDISC migrations, network egress
blocked), set `LZZT_BASE_URL` to a local mirror or copy a
`cdiscpilot01.zip` directly into this directory:

```bash
LZZT_BASE_URL=file:///path/to/cdiscpilot01.zip make fetch-fixtures
# or
cp /path/to/cdiscpilot01.zip templates/tests/fixtures/lzzt/
cd templates/tests/fixtures/lzzt && unzip cdiscpilot01.zip '*.xpt' && touch .fetched
```

## Files expected after fetch

The pilot dataset includes ~30 XPT files; the v1 SDTM bridge consumes
five domains:

- `dm.xpt` — Demographics
- `ae.xpt` — Adverse Events
- `cm.xpt` — Concomitant Medications
- `vs.xpt` — Vital Signs
- `lb.xpt` — Laboratory Results

Other domains (DS, EX, PE, SU, MH, etc.) are present but are out of
scope for v1 per Phase 2 spec Q9.

## License

The CDISC SDTMIG Pilot 01 datasets are CDISC-published reference data,
freely available for testing implementations of the SDTM standard.
