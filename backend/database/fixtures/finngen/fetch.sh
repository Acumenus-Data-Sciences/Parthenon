#!/usr/bin/env bash
# Usage: ./fetch.sh df12 | df13 | df14
# Downloads the requested FinnGen curated endpoint library XLSX into this
# directory. DF14 is already committed; this script is for on-demand df12
# and df13 retrieval when supporting older releases.
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-df14}" in
  df12)
    URL='https://www.finngen.fi/sites/default/files/inline-files/FINNGEN_ENDPOINTS_DF12_Final_2023-05-17_public.xlsx'
    OUT='FINNGEN_ENDPOINTS_DF12_Final_2023-05-17_public.xlsx'
    ;;
  df13)
    URL='https://www.finngen.fi/sites/default/files/inline-files/FINNGEN_ENDPOINTS_DF13_Final_2025-08-14_public.xlsx'
    OUT='FINNGEN_ENDPOINTS_DF13_Final_2025-08-14_public.xlsx'
    ;;
  df14)
    URL='https://www.finngen.fi/sites/default/files/inline-files/FINNGEN_ENDPOINTS_DF14_Final_2026-02-13_public.xlsx'
    OUT='FINNGEN_ENDPOINTS_DF14_Final_2026-02-13_public.xlsx'
    ;;
  *)
    echo "unknown release: $1 (expected df12|df13|df14)" >&2
    exit 2
    ;;
esac
curl -sSfL -o "$OUT" "$URL"
echo "fetched $OUT ($(stat -c %s "$OUT") bytes)"
