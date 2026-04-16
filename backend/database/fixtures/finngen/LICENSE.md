# FinnGen Endpoint Library — Attribution

The `FINNGEN_ENDPOINTS_*.xlsx` files in this directory are derived work
by Tuomo Kiiskinen, Sami Koskelainen, Susanna Lemmelä, Elisa Lahtela,
Aki S. Havulinna, clinical expert groups, and others at FIMM and THL.

FinnGen license statement (from the file banner):

> "Use freely but if used extensively please mention the source."

Canonical source:

- https://www.finngen.fi/en/researchers/clinical-endpoints
- https://www.finngen.fi/sites/default/files/inline-files/FINNGEN_ENDPOINTS_DF14_Final_2026-02-13_public.xlsx

Parthenon imports this library via `php artisan finngen:import-endpoints`.
Source URLs recorded in each imported row's `expression_json.provenance`.
The DF14 XLSX is committed directly (~878 KB). Older releases (DF12, DF13)
can be fetched on demand via `./fetch.sh df12` or `./fetch.sh df13`.
