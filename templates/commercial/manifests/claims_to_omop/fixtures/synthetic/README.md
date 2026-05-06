# Synthetic 837 Fixtures

Phase 3 Plan 1 Task 6 (T-021A). These files exercise the
`X12_837_Reader` against representative Professional / Institutional /
Dental shapes, plus a deterministic 100-claim corpus for the validation
E2E (Task 10).

## Files

| File | Purpose |
|------|---------|
| `cms_837p_example.txt` | Single 837 Professional claim, two SV1 lines |
| `cms_837i_example.txt` | Single 837 Institutional claim, two SV2 lines |
| `cms_837d_example.txt` | Single 837 Dental claim, two SV3 lines |
| `build_837_corpus.py`  | Deterministic builder (`seed=42`) producing N-claim mixed corpora |

## Attribution

Segment shapes follow the public CMS implementation-guide examples for
ASC X12N 005010X222A1 (Professional), 005010X223A2 (Institutional), and
005010X224A2 (Dental). Examples are public domain. NPIs use the public
CMS test value `1234567893` (and a small pool of similar test NPIs);
member IDs (`MEMBER01`, `MEMBER0001`, ...) are obviously fake.

No PHI is encoded in any fixture. HIGHSEC §7 still applies — the
reader's `_RedactingFilter` (Task 11) scrubs NM109 values from log
output as defense in depth.

## Usage

```python
from runtime.commercial.claims.readers.x12_837 import X12_837_Reader
import io

# Single claim:
text = open("cms_837p_example.txt").read()
claims, lines = X12_837_Reader().read(io.StringIO(text))
assert claims[0].claim_type == "P"

# 100-claim deterministic corpus (loaded via importlib in the E2E test):
import importlib.util, sys
spec = importlib.util.spec_from_file_location("build_837_corpus", "build_837_corpus.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["build_837_corpus"] = mod
spec.loader.exec_module(mod)
payload = mod.build_corpus(seed=42, n_claims=100)
claims, lines = X12_837_Reader().read(io.StringIO(payload))
assert len(claims) == 100
```
