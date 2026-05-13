# Lu et al. 2025 — Methodology Comparison

**Lu et al. citation:** Lu Y, Brush J Jr, Kim C, et al. Delayed Hypertension Diagnosis and Its Association With Cardiovascular Treatment and Outcomes. *JAMA Network Open* 2025;8(7):e2520498. doi:10.1001/jamanetworkopen.2025.20498

**Fetched:** 2026-05-12 via JAMA Network Open (open access)

---

## TL;DR

Our v3-protocol-derived design and Lu's published design **differ on 9 material methodology points**. A literal head-to-head replication of Lu's HR 1.29 [1.23–1.36] **cannot be claimed** unless we change parts of our cohort definition that Dr. Bock just confirmed. The strongest path forward is to **keep our enhanced design as primary** and add a **second, Lu-replication sub-design** (call it `T_lu`/`O_lu`) that mirrors Lu exactly for a head-to-head comparison.

---

## Side-by-side

| Topic | Lu 2025 | Our v2 design | Match? |
|---|---|---|---|
| **Data source** | Single integrated health system, VA + NE NC; ~311,743 adults; OMOP CDM v5.3 | Acumenus OMOP CDM v5.4; ~1.0M adults | Different scale; same standard ✓ partial |
| **Years** | 2010-01-01 to 2021-12-31 | All available | We're broader |
| **Age** | 18–85 | ≥18 | We're broader |
| **BP threshold operator** | `≥` (matches us) | `≥` | ✓ |
| **BP threshold values** | SBP ≥ **140** OR DBP ≥ **90** (JNC 7 / ACC/AHA pre-2017) | SBP ≥ **130** OR DBP ≥ **80** (ACC/AHA 2017, Dr. Bock Q1) | ❌ **MAJOR** |
| **Number of BPs required** | ≥ 2 consecutive elevated (within 2-year window) | ≥ 2 consecutive elevated, ≥ 3 BPs total in 24-mo window | ≈ Similar (we add a third) |
| **Min gap between BPs** | **≥ 30 days** (explicit) | not specified | ❌ Need to add `≥ 30d` |
| **Max gap between BPs** | ≤ 2 years (24 months) | ≤ 365 days (Dr. Bock Q2) | ❌ Ours is tighter (we cut at 365d, Lu allowed up to 730d) |
| **BP aggregation per visit** | "discard first reading, average the rest"; same-day multi-visit also averaged | not specified | ❌ Need to add |
| **BP setting** | **Outpatient only** (excludes inpatient, ED, surgery center) | not specified | ❌ Need to add |
| **Treatment-naive lookback** | -180 days to +30 days from 2nd BP (active prescription window) | **Ever-before-index** (Dr. Bock Q9) | ❌ **MAJOR** — Lu is much more permissive |
| **Antihypertensive scope** | First-line per ACC/AHA 2017 + second-line (β-blockers, α-blockers, other diuretics) | Broad ATC C02–C09 (Dr. Bock Q5) | ≈ Lu's is narrower; ours captures Lu's set |
| **Pregnancy exclusion** | Yes | not in our list | ❌ Need to add |
| **Dialysis exclusion** | Yes | Implicit via CKD/eGFR exclusion | ✓ partial |
| **Prior CVD exclusion** | Not explicit (covariates only) | Excluded entirely (our Q7-related) | ❌ Lu adjusts, we exclude |
| **Baseline kidney exclusion** | Not explicit | eGFR < 60 (Dr. Bock Q11) | ❌ Lu has no eGFR exclusion |
| **Thyroid exclusion** | Not explicit | Excluded entirely | ❌ Lu has none |
| **Secondary HTN exclusion** | Not explicit | Excluded entirely | ❌ Lu has none |
| **Latency categories** | 4 categories: diagnosed-pre-2nd-BP (ref), 1–90d, 91–365d, **>365d**, never-diagnosed-or->5y | Tertiles [6, 12] months primary + Lu 16-mo sensitivity (we set this before knowing Lu's exact cutoff) | ❌ Lu used >365d (12 months), not 16 months |
| **Reference group for delay analysis** | "Diagnosed between 1st and 2nd BP elevation" (within-cohort) | PSM-matched normotensive comparator (Dr. Bock Q6) | ❌ **MAJOR** — completely different comparator |
| **Matching method** | **None** (multivariable Cox adjustment instead) | PSM caliper 0.2 SD (Dr. Bock Q6) | ❌ Lu doesn't match at all |
| **Primary outcome** | Antihypertensive prescription within 30 days of diagnosis (binary) | MACE composite + incident CKD (time-to-event, co-equal) | ❌ **MAJOR** |
| **Secondary CV outcome** | Composite of inpatient/ED MI, HF, ischemic stroke | MACE composite (inpatient HF qualifier, includes all-cause death + hemorrhagic stroke) | ❌ Lu narrower (no death, no hemorrhagic stroke) |
| **HF outcome qualifier** | "hospitalization for HF" (inpatient/ED only) | Inpatient `visit_occurrence` required (Dr. Bock Q8) | ✓ (we're inpatient-only; Lu allows ED) |
| **All-cause death** | Not in MACE | In MACE | ❌ |
| **Hemorrhagic stroke** | Excluded (ischemic stroke only) | Included | ❌ |
| **Incident CKD outcome** | Not analyzed | Co-equal primary outcome | ❌ We added this |
| **Follow-up window** | 5 years from **diagnosis date** | 5 years from **index date (= 2nd elevated BP)** (Dr. Bock Q12) | ❌ Different anchor |
| **Statistical model** | Multivariable Cox PH (adjusted for age, race/ethnicity, sex, BP, comorbidities) | Cox PH on PSM-matched pairs + competing-risk for diagnosis event (Dr. Bock Q10) | ❌ Different approach |
| **"29% delta" interpretation** | HR 1.29 [1.23–1.36] for **delay > 365 days vs. diagnosed-between-BPs**, p < 0.001, adjusted Cox | Our Lu sensitivity at 16 months won't reproduce this exactly | ❌ |

---

## Material discrepancies (in order of severity)

1. **BP threshold 130/80 (us) vs. 140/90 (Lu).** Lu predates ACC/AHA 2017 thresholds for HTN; their cohort is substantially smaller and more "obviously hypertensive."

2. **Comparator: PSM normotensive (us) vs. within-cohort late-vs-early-diagnosed (Lu).** This is the single biggest difference. Lu's "29% HR" is a within-cohort comparison among hypertensives stratified by diagnostic delay. They didn't compare to non-hypertensives at all.

3. **Primary outcome: treatment-prescription (Lu) vs. MACE/CKD (us).** Lu's primary outcome is whether the patient got an Rx within 30 days of diagnosis. CV outcomes are secondary in Lu.

4. **Treatment-naive: 180d pre/30d post (Lu) vs. ever-before-index (us, per Dr. Bock).** Lu's is much more permissive — they don't actually exclude any "treatment-naive" subgroup; they classify by whether the patient had an active Rx near their second elevated BP.

5. **Exclusions: minimal (Lu) vs. extensive (us).** Lu only excludes pregnancy, dialysis, and inpatient/ED BPs. We exclude prior CVD, thyroid, secondary HTN, eGFR < 60.

6. **MACE composition.** Lu: inpatient/ED MI + HF + ischemic stroke. Us: MI + ischemic+hemorrhagic stroke + inpatient HF + all-cause death.

7. **Follow-up anchor: diagnosis date (Lu) vs. index date / 2nd elevated BP (us).** Different start time changes the at-risk denominator.

8. **Latency categorization.** Lu uses 4 discrete categories with diagnosed-pre-2nd-BP as reference. Our tertiles [6, 12] don't match.

9. **CKD outcome.** Lu didn't analyze CKD as an outcome. Our co-equal CKD is a v3 protocol extension.

---

## Recommendation

Don't tear up Dr. Bock's confirmed design. Keep it as the primary. **Add a separate replication sub-analysis** that mirrors Lu's methodology exactly, run on the same Acumenus source, so we have a defensible head-to-head:

### Sub-design `LU_REPLICATION` (new)

| Element | Spec |
|---|---|
| Cohort `T_lu` | adults 18–85 with ≥2 consecutive elevated outpatient BPs (SBP ≥140 OR DBP ≥90), ≥30d apart, within 2y; pregnant/dialysis excluded; BP-aggregation rule per Lu |
| Comparator | within-cohort: diagnosed-between-BPs vs. diagnosed-post-2nd-BP (no normotensive C) |
| Exposure | latency categories: 1–90d, 91–365d, >365d, never |
| Primary outcome | antihypertensive Rx within 30d of HTN dx (binary) |
| Secondary outcome | composite of inpatient/ED MI, HF, ischemic stroke; 5y from diagnosis date |
| Model | multivariable Cox PH; adjust for age, race/ethnicity, sex, BP, comorbidities |
| Reproduction target | HR for delay > 365d vs. diagnosed-pre-2nd-BP (Lu reports 1.29 [1.23–1.36]) |

### Our v3 primary design (UNCHANGED)

Stays exactly as Dr. Bock approved: AHA 2017 thresholds, PSM normotensive comparator, MACE + CKD co-equal, eGFR-based exclusion, 5y from index.

### What this gives us

- Faithful replication target: we can report "Lu reported 1.29 [1.23–1.36]; replicated on Acumenus we observed X.XX [Y-Z]."
- Methodologically stronger primary analysis: the AHA 2017 thresholds and PSM comparator give cleaner causal interpretation than Lu's design.
- Side-by-side reporting clarifies which findings are Lu-replication versus design-extension.

### Implementation cost

- **+1 cohort** (T_lu): same machinery as T, different parameters. Drafted by re-using build_concept_sets infrastructure with different exclusions.
- **+1 outcome variant** (Lu MACE, narrower): subset of our O1.
- **+1 analysis row** in the SAP (Lu replication analysis F): we already have analysis F slotted; now it has a concrete sub-cohort behind it.

Estimated additional effort: 4–6 cohort SQL changes, no new concept sets needed (Lu's antihypertensive scope is a subset of our broad ATC C02-C09).

---

## Decision needed from Dr. Bock + user

Pick one path:

**(A)** Adopt the two-design plan above (primary = ours; sub-design = Lu replication). [Recommended.]

**(B)** Reframe our primary to match Lu's exactly (drops PSM, drops co-equal CKD, narrows BP thresholds, broadens treatment-naive, etc.) and rebuild the cohort definitions. Significant rework; loses our enhancements.

**(C)** Drop the "Lu replication" framing entirely. Report our primary findings as a stand-alone outcomes study citing Lu as motivation but not as a head-to-head target. Removes analysis F.

---

— Acumenus Informatics Team
