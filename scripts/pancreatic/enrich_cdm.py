#!/usr/bin/env python3
"""
Enrich the pancreas CDM schema with clinically realistic trajectories.

Reads 189 existing persons from pancreas.person, then generates:
  - Clinical subgroup assignments (resectable, borderline, metastatic)
  - Visit trajectories (5-8 visits per patient)
  - Lab measurements with realistic trends (CA 19-9, CEA, bilirubin, etc.)
  - Drug exposures (FOLFIRINOX, Gem/nab-pac, Gem mono + supportive)
  - Condition occurrences (PDAC + comorbidities)
  - Procedure occurrences (Whipple, distal pancreatectomy)
  - Specimens (biopsy, surgical)
  - Death records with subgroup-appropriate mortality
  - Condition era and drug era rollups

Idempotent: truncates all clinical tables before inserting.
Deterministic: seeded RNG for reproducibility.

Run: python3 scripts/pancreatic/enrich_cdm.py
"""

import random
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import psycopg2

# ── OMOP Concept IDs ────────────────────────────────────────────────────────

# Conditions
PDAC = 4180793  # Malignant tumor of pancreas
JAUNDICE = 137977
T2DM = 201826
CACHEXIA = 134765
EXOCRINE_INSUFFICIENCY = 4186463
DVT = 4133004
ABDOMINAL_PAIN = 200219

# Procedures
WHIPPLE = 4020329  # Pancreaticoduodenectomy
DISTAL_PANCREATECTOMY = 4144850  # 95% distal pancreatectomy

# Drugs (RxNorm ingredients)
FLUOROURACIL = 955632
OXALIPLATIN = 1318011
IRINOTECAN = 1367268
LEUCOVORIN = 1388796
GEMCITABINE = 1314924
PACLITAXEL = 1378382  # nab-paclitaxel
ONDANSETRON = 1000560
INSULIN_GLARGINE = 1502905

# Measurements (LOINC)
CA_19_9 = 3022914
CEA = 3013444
BILIRUBIN_TOTAL = 3024128
BILIRUBIN_DIRECT = 3027597
ALBUMIN = 3024561
ALT = 3006923
AST = 3013721
WBC = 3000905
HEMOGLOBIN = 3000963
PLATELETS = 3024929
HBA1C = 3004410

# Demographics & types
MALE = 8507
FEMALE = 8532
WHITE = 8527
BLACK = 8516
ASIAN = 8515
NOT_HISPANIC = 38003564
INPATIENT = 9201
OUTPATIENT = 9202
EHR_TYPE = 32817
PANCREAS_TISSUE = 4002886
PANCREAS_SITE = 4217585

# Unit concept IDs (UCUM)
UNIT_UL = 8645       # U/L
UNIT_NGML = 8842     # ng/mL
UNIT_MGDL = 8840     # mg/dL
UNIT_GDL = 8713      # g/dL
UNIT_K_UL = 8848     # 10*3/uL (thousands/uL)
UNIT_PERCENT = 8554  # %

# ── Clinical subgroups ──────────────────────────────────────────────────────

RESECTABLE = "resectable"
BORDERLINE = "borderline"
METASTATIC = "metastatic"

# ── Data structures ─────────────────────────────────────────────────────────


@dataclass
class Visit:
    visit_id: int
    person_id: int
    visit_concept_id: int
    start_date: date
    end_date: date
    source_value: str
    care_site_id: int
    preceding_visit_id: Optional[int] = None


@dataclass
class Measurement:
    measurement_id: int
    person_id: int
    concept_id: int
    meas_date: date
    value: float
    unit_concept_id: int
    range_low: Optional[float]
    range_high: Optional[float]
    visit_occurrence_id: int
    source_value: str
    unit_source_value: str


@dataclass
class DrugExposure:
    drug_exposure_id: int
    person_id: int
    drug_concept_id: int
    start_date: date
    end_date: date
    visit_occurrence_id: int
    source_value: str
    days_supply: int


@dataclass
class ConditionOccurrence:
    condition_occurrence_id: int
    person_id: int
    condition_concept_id: int
    start_date: date
    end_date: Optional[date]
    visit_occurrence_id: int
    source_value: str


@dataclass
class ProcedureOccurrence:
    procedure_occurrence_id: int
    person_id: int
    procedure_concept_id: int
    proc_date: date
    visit_occurrence_id: int
    source_value: str


@dataclass
class Specimen:
    specimen_id: int
    person_id: int
    specimen_date: date
    source_value: str
    specimen_type: str  # 'biopsy' or 'surgical'


@dataclass
class DeathRecord:
    person_id: int
    death_date: date


@dataclass
class PatientTrajectory:
    person_id: int
    person_source_value: str
    care_site_id: int
    year_of_birth: int
    subgroup: str
    tumor_location: str  # head, body, tail
    has_diabetes: bool
    has_jaundice: bool
    has_cachexia: bool
    has_exocrine_insufficiency: bool
    has_dvt: bool
    chemo_regimen: str  # FOLFIRINOX, gem_nabpac, gem_mono
    gets_surgery: bool
    gets_neoadjuvant: bool
    gets_second_line: bool
    dx_date: date = date(2020, 6, 1)
    death_date: Optional[date] = None
    visits: list[Visit] = field(default_factory=list)
    measurements: list[Measurement] = field(default_factory=list)
    drug_exposures: list[DrugExposure] = field(default_factory=list)
    conditions: list[ConditionOccurrence] = field(default_factory=list)
    procedures: list[ProcedureOccurrence] = field(default_factory=list)
    specimens: list[Specimen] = field(default_factory=list)


# ── ID counters ─────────────────────────────────────────────────────────────


class IdCounter:
    """Thread-safe monotonic ID generator."""

    def __init__(self, start: int = 1) -> None:
        self._current = start

    def next(self) -> int:
        val = self._current
        self._current += 1
        return val

    @property
    def current(self) -> int:
        return self._current


# Global counters
visit_counter = IdCounter()
measurement_counter = IdCounter()
drug_counter = IdCounter()
condition_counter = IdCounter()
procedure_counter = IdCounter()
specimen_counter = IdCounter()


# ── Helper functions ────────────────────────────────────────────────────────


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def date_str(d: date) -> str:
    return d.isoformat()


def datetime_str(d: date) -> str:
    return f"{d.isoformat()} 09:00:00"


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def find_closest_visit(visits: list[Visit], target_date: date) -> int:
    """Return the visit_occurrence_id of the visit closest to target_date."""
    if not visits:
        raise ValueError("No visits to match against")
    best = visits[0]
    best_diff = abs((target_date - best.start_date).days)
    for v in visits[1:]:
        diff = abs((target_date - v.start_date).days)
        if diff < best_diff:
            best = v
            best_diff = diff
    return best.visit_id


# ── Patient stratification ──────────────────────────────────────────────────


def assign_subgroup(rng: random.Random, is_cptac: bool) -> str:
    """Assign clinical subgroup. CPTAC skews toward resectable/borderline."""
    if is_cptac:
        r = rng.random()
        if r < 0.35:  # 35% resectable (vs 29% overall)
            return RESECTABLE
        elif r < 0.65:  # 30% borderline (vs 26% overall)
            return BORDERLINE
        else:
            return METASTATIC  # 35% (vs 45% overall)
    else:
        r = rng.random()
        if r < 0.29:
            return RESECTABLE
        elif r < 0.55:
            return BORDERLINE
        else:
            return METASTATIC


def assign_tumor_location(rng: random.Random) -> str:
    r = rng.random()
    if r < 0.65:
        return "head"
    elif r < 0.85:
        return "body"
    else:
        return "tail"


def assign_chemo_regimen(rng: random.Random) -> str:
    r = rng.random()
    if r < 0.40:
        return "FOLFIRINOX"
    elif r < 0.75:
        return "gem_nabpac"
    else:
        return "gem_mono"


def assign_comorbidities(rng: random.Random, tumor_location: str) -> tuple[bool, bool, bool, bool, bool]:
    """Returns (has_diabetes, has_jaundice, has_cachexia, has_exocrine_insufficiency, has_dvt)."""
    has_diabetes = rng.random() < 0.35  # ~35% have T2DM
    has_jaundice = tumor_location == "head" and rng.random() < 0.70  # 70% of head tumors
    has_cachexia = rng.random() < 0.50  # ~50%
    has_exocrine_insufficiency = rng.random() < 0.25
    has_dvt = rng.random() < 0.12  # ~12% VTE
    return has_diabetes, has_jaundice, has_cachexia, has_exocrine_insufficiency, has_dvt


def determine_surgery(rng: random.Random, subgroup: str) -> tuple[bool, bool]:
    """Returns (gets_surgery, gets_neoadjuvant)."""
    if subgroup == RESECTABLE:
        gets_neoadjuvant = rng.random() < 0.50
        return True, gets_neoadjuvant
    elif subgroup == BORDERLINE:
        gets_surgery = rng.random() < 0.40  # 40% downstaged
        return gets_surgery, True  # All borderline get induction chemo
    else:
        return False, False


def determine_death(rng: random.Random, subgroup: str, dx_date: date) -> Optional[date]:
    """Determine if/when patient dies."""
    mortality_rates = {RESECTABLE: 0.55, BORDERLINE: 0.70, METASTATIC: 0.90}
    os_medians = {RESECTABLE: 730, BORDERLINE: 540, METASTATIC: 330}
    os_sigmas = {RESECTABLE: 200, BORDERLINE: 180, METASTATIC: 120}

    if rng.random() < mortality_rates[subgroup]:
        survival_days = int(rng.gauss(os_medians[subgroup], os_sigmas[subgroup]))
        survival_days = int(clamp(survival_days, 60, 1095))
        return dx_date + timedelta(days=survival_days)
    return None


# ── Trajectory generation ───────────────────────────────────────────────────


def generate_visits(pt: PatientTrajectory, rng: random.Random) -> None:
    """Generate 5-8 visits along the clinical trajectory."""
    dx = pt.dx_date
    visits: list[Visit] = []

    def add_visit(offset_days: int, concept: int, source: str) -> Visit:
        d = dx + timedelta(days=offset_days)
        preceding = visits[-1].visit_id if visits else None
        v = Visit(
            visit_id=visit_counter.next(),
            person_id=pt.person_id,
            visit_concept_id=concept,
            start_date=d,
            end_date=d,
            source_value=source,
            care_site_id=pt.care_site_id,
            preceding_visit_id=preceding,
        )
        visits.append(v)
        return v

    # Visit 1: Diagnostic workup (day 0)
    add_visit(0, OUTPATIENT, "Diagnostic workup")

    # Visit 2: Staging (day 7-14)
    add_visit(rng.randint(7, 14), OUTPATIENT, "Staging")

    # Visit 3+: Chemo visits
    if pt.subgroup == RESECTABLE and not pt.gets_neoadjuvant:
        # Upfront surgery — skip to surgery visit
        surgery_day = rng.randint(21, 35)
        add_visit(surgery_day, INPATIENT, "Surgery")
        # Adjuvant chemo start
        adjuvant_start = surgery_day + rng.randint(28, 42)
        add_visit(adjuvant_start, OUTPATIENT, "Adjuvant chemo")
        # Mid-adjuvant check
        add_visit(adjuvant_start + rng.randint(42, 84), OUTPATIENT, "Chemo follow-up")
    elif pt.gets_surgery:
        # Neoadjuvant / induction → surgery path
        chemo_start = rng.randint(14, 28)
        add_visit(chemo_start, OUTPATIENT, "Neoadjuvant chemo")
        # Mid-chemo
        add_visit(chemo_start + rng.randint(42, 84), OUTPATIENT, "Chemo restaging")
        # Surgery
        surgery_day = chemo_start + rng.randint(100, 140)
        add_visit(surgery_day, INPATIENT, "Surgery")
        # Post-op follow-up
        add_visit(surgery_day + rng.randint(21, 35), OUTPATIENT, "Post-op follow-up")
    else:
        # Palliative chemo only (borderline no surgery, or metastatic)
        chemo_start = rng.randint(14, 28)
        add_visit(chemo_start, OUTPATIENT, "Palliative chemo")
        add_visit(chemo_start + rng.randint(42, 84), OUTPATIENT, "Chemo restaging")
        if pt.gets_second_line:
            add_visit(chemo_start + rng.randint(120, 180), OUTPATIENT, "2nd-line chemo")

    # Follow-up visits (1-2 additional)
    last_day = (visits[-1].start_date - dx).days
    for i in range(rng.randint(1, 2)):
        follow_day = last_day + rng.randint(60, 120) * (i + 1)
        # Don't add visits after death
        if pt.death_date and (dx + timedelta(days=follow_day)) > pt.death_date:
            break
        add_visit(follow_day, OUTPATIENT, "Follow-up")

    pt.visits = visits


def generate_measurements(pt: PatientTrajectory, rng: random.Random) -> None:
    """Generate lab measurements at each visit with clinically realistic trends."""
    dx = pt.dx_date
    is_metastatic = pt.subgroup == METASTATIC

    # Baseline values
    base_ca199 = rng.gauss(500.0 if is_metastatic else 200.0, 80.0)
    base_cea = rng.gauss(12.0 if is_metastatic else 5.0, 2.0)
    base_bilirubin = rng.gauss(4.5 if pt.has_jaundice else 0.8, 0.5) if pt.has_jaundice else rng.gauss(0.8, 0.2)
    base_bili_direct = base_bilirubin * rng.uniform(0.5, 0.7) if pt.has_jaundice else rng.gauss(0.2, 0.05)
    base_albumin = rng.gauss(3.8, 0.3)
    base_alt = rng.gauss(80.0 if pt.has_jaundice else 25.0, 10.0)
    base_ast = rng.gauss(70.0 if pt.has_jaundice else 22.0, 8.0)
    base_wbc = rng.gauss(7.5, 1.5)
    base_hgb = rng.gauss(13.0, 1.0)
    base_plt = rng.gauss(250.0, 40.0)
    base_hba1c = rng.gauss(8.0, 0.8) if pt.has_diabetes else None

    had_surgery = False
    in_chemo = False

    for v in pt.visits:
        visit_day = (v.start_date - dx).days
        is_post_surgery = had_surgery
        is_chemo_visit = "chemo" in v.source_value.lower()
        if is_chemo_visit:
            in_chemo = True
        if "surgery" in v.source_value.lower():
            had_surgery = True

        # Time-based trend adjustments
        jaundice_resolved = pt.has_jaundice and visit_day > 30
        chemo_nadir = in_chemo and not is_post_surgery

        # CA 19-9: drops post-surgery, rises on progression
        if is_post_surgery and not is_metastatic:
            ca199 = clamp(base_ca199 * rng.uniform(0.05, 0.20), 2.0, 9999.0)
            # Late visits: possible rise (recurrence)
            if visit_day > 365:
                ca199 = clamp(ca199 * rng.uniform(1.5, 5.0), 2.0, 9999.0)
        elif in_chemo:
            ca199 = clamp(base_ca199 * rng.uniform(0.3, 0.8), 2.0, 9999.0)
        else:
            ca199 = clamp(base_ca199 * rng.uniform(0.8, 1.3), 2.0, 9999.0)

        # CEA
        cea = clamp(base_cea * rng.uniform(0.6, 1.4), 0.5, 200.0)

        # Bilirubin — normalizes after 30 days (stent/surgery)
        if jaundice_resolved:
            bili = clamp(rng.gauss(0.9, 0.3), 0.2, 3.0)
            bili_direct = clamp(bili * rng.uniform(0.2, 0.4), 0.05, 1.5)
        else:
            bili = clamp(base_bilirubin * rng.uniform(0.8, 1.2), 0.2, 20.0)
            bili_direct = clamp(base_bili_direct * rng.uniform(0.8, 1.2), 0.05, 15.0)

        # Albumin — declines with cachexia
        alb_decline = 0.002 * visit_day if pt.has_cachexia else 0.0005 * visit_day
        albumin = clamp(base_albumin - alb_decline + rng.gauss(0, 0.15), 1.5, 5.0)

        # ALT/AST — elevated with biliary obstruction, normalizes
        if jaundice_resolved:
            alt = clamp(rng.gauss(28.0, 8.0), 5.0, 200.0)
            ast = clamp(rng.gauss(25.0, 7.0), 5.0, 200.0)
        else:
            alt = clamp(base_alt * rng.uniform(0.7, 1.3), 5.0, 500.0)
            ast = clamp(base_ast * rng.uniform(0.7, 1.3), 5.0, 500.0)

        # CBC — drops during chemo
        chemo_factor = 0.75 if chemo_nadir else 1.0
        wbc = clamp(base_wbc * chemo_factor * rng.uniform(0.8, 1.2), 1.0, 25.0)
        hgb = clamp(base_hgb * chemo_factor * rng.uniform(0.85, 1.1), 6.0, 18.0)
        plt = clamp(base_plt * chemo_factor * rng.uniform(0.7, 1.2), 50.0, 600.0)

        # Build measurement list for this visit
        labs: list[tuple[int, float, int, Optional[float], Optional[float], str, str]] = [
            (CA_19_9, round(ca199, 1), UNIT_UL, 0.0, 37.0, "CA 19-9", "U/mL"),
            (CEA, round(cea, 1), UNIT_NGML, 0.0, 5.0, "CEA", "ng/mL"),
            (BILIRUBIN_TOTAL, round(bili, 1), UNIT_MGDL, 0.1, 1.2, "Total Bilirubin", "mg/dL"),
            (BILIRUBIN_DIRECT, round(bili_direct, 2), UNIT_MGDL, 0.0, 0.3, "Direct Bilirubin", "mg/dL"),
            (ALBUMIN, round(albumin, 1), UNIT_GDL, 3.5, 5.0, "Albumin", "g/dL"),
            (ALT, round(alt, 0), UNIT_UL, 7.0, 56.0, "ALT", "U/L"),
            (AST, round(ast, 0), UNIT_UL, 10.0, 40.0, "AST", "U/L"),
            (WBC, round(wbc, 1), UNIT_K_UL, 4.5, 11.0, "WBC", "10*3/uL"),
            (HEMOGLOBIN, round(hgb, 1), UNIT_GDL, 12.0, 17.5, "Hemoglobin", "g/dL"),
            (PLATELETS, round(plt, 0), UNIT_K_UL, 150.0, 400.0, "Platelets", "10*3/uL"),
        ]

        # HbA1c only for diabetic patients, at dx and ~q3 months
        if pt.has_diabetes and (visit_day == 0 or visit_day % 90 < 30):
            hba1c = clamp(base_hba1c + rng.gauss(0, 0.3), 5.5, 14.0) if base_hba1c else 7.0
            labs.append((HBA1C, round(hba1c, 1), UNIT_PERCENT, 4.0, 5.6, "HbA1c", "%"))

        for concept_id, value, unit_id, rng_lo, rng_hi, src_val, unit_src in labs:
            pt.measurements.append(Measurement(
                measurement_id=measurement_counter.next(),
                person_id=pt.person_id,
                concept_id=concept_id,
                meas_date=v.start_date,
                value=value,
                unit_concept_id=unit_id,
                range_low=rng_lo,
                range_high=rng_hi,
                visit_occurrence_id=v.visit_id,
                source_value=src_val,
                unit_source_value=unit_src,
            ))


def generate_drug_exposures(pt: PatientTrajectory, rng: random.Random) -> None:
    """Generate chemo drug exposures with cycle-level granularity."""
    dx = pt.dx_date

    # Determine chemo timing
    if pt.subgroup == RESECTABLE and not pt.gets_neoadjuvant:
        # Adjuvant only — starts after surgery
        surgery_visit = next((v for v in pt.visits if "surgery" in v.source_value.lower()), None)
        if surgery_visit:
            chemo_start = surgery_visit.start_date + timedelta(days=rng.randint(28, 42))
        else:
            chemo_start = dx + timedelta(days=rng.randint(50, 70))
        num_cycles = rng.randint(6, 12)
    elif pt.gets_surgery:
        # Neoadjuvant then adjuvant
        chemo_start = dx + timedelta(days=rng.randint(14, 28))
        num_cycles = rng.randint(6, 12)
    else:
        # Palliative
        chemo_start = dx + timedelta(days=rng.randint(14, 28))
        num_cycles = rng.randint(6, 12)

    # Determine cycle length
    if pt.chemo_regimen == "FOLFIRINOX":
        cycle_days = 14
        drug_concepts = [
            (FLUOROURACIL, "fluorouracil"),
            (OXALIPLATIN, "oxaliplatin"),
            (IRINOTECAN, "irinotecan"),
            (LEUCOVORIN, "leucovorin"),
        ]
    elif pt.chemo_regimen == "gem_nabpac":
        cycle_days = 21
        drug_concepts = [
            (GEMCITABINE, "gemcitabine"),
            (PACLITAXEL, "nab-paclitaxel"),
        ]
    else:  # gem_mono
        cycle_days = 21
        drug_concepts = [
            (GEMCITABINE, "gemcitabine"),
        ]

    # Chemo end date (might be cut short by death or surgery gap)
    end_limit = pt.death_date - timedelta(days=14) if pt.death_date else dx + timedelta(days=1095)

    chemo_end_date = chemo_start  # Track last chemo date

    for cycle in range(num_cycles):
        cycle_start = chemo_start + timedelta(days=cycle * cycle_days)
        cycle_end = cycle_start + timedelta(days=min(cycle_days - 1, 2))  # Drug admin is 1-3 days

        if cycle_start > end_limit:
            break

        # If surgery happened during neoadjuvant, pause chemo
        if pt.gets_surgery and pt.gets_neoadjuvant:
            surgery_visit = next((v for v in pt.visits if "surgery" in v.source_value.lower()), None)
            if surgery_visit:
                if surgery_visit.start_date - timedelta(days=7) < cycle_start < surgery_visit.start_date + timedelta(days=42):
                    continue  # Skip cycles around surgery

        visit_id = find_closest_visit(pt.visits, cycle_start)

        for concept_id, source_val in drug_concepts:
            pt.drug_exposures.append(DrugExposure(
                drug_exposure_id=drug_counter.next(),
                person_id=pt.person_id,
                drug_concept_id=concept_id,
                start_date=cycle_start,
                end_date=cycle_end,
                visit_occurrence_id=visit_id,
                source_value=source_val,
                days_supply=(cycle_end - cycle_start).days + 1,
            ))

        # Ondansetron with every cycle
        pt.drug_exposures.append(DrugExposure(
            drug_exposure_id=drug_counter.next(),
            person_id=pt.person_id,
            drug_concept_id=ONDANSETRON,
            start_date=cycle_start,
            end_date=cycle_start,  # Single dose
            visit_occurrence_id=visit_id,
            source_value="ondansetron",
            days_supply=1,
        ))

        chemo_end_date = max(chemo_end_date, cycle_end)

    # Second-line chemo for metastatic patients
    if pt.gets_second_line:
        second_line_start = chemo_end_date + timedelta(days=rng.randint(14, 28))
        # Switch regimen
        if pt.chemo_regimen == "FOLFIRINOX":
            second_concepts = [(GEMCITABINE, "gemcitabine"), (PACLITAXEL, "nab-paclitaxel")]
            second_cycle_days = 21
        else:
            second_concepts = [(FLUOROURACIL, "fluorouracil"), (LEUCOVORIN, "leucovorin")]
            second_cycle_days = 14

        second_cycles = rng.randint(4, 8)
        for cycle in range(second_cycles):
            cycle_start = second_line_start + timedelta(days=cycle * second_cycle_days)
            cycle_end = cycle_start + timedelta(days=min(second_cycle_days - 1, 2))
            if cycle_start > end_limit:
                break
            visit_id = find_closest_visit(pt.visits, cycle_start)
            for concept_id, source_val in second_concepts:
                pt.drug_exposures.append(DrugExposure(
                    drug_exposure_id=drug_counter.next(),
                    person_id=pt.person_id,
                    drug_concept_id=concept_id,
                    start_date=cycle_start,
                    end_date=cycle_end,
                    visit_occurrence_id=visit_id,
                    source_value=source_val,
                    days_supply=(cycle_end - cycle_start).days + 1,
                ))
            # Ondansetron
            pt.drug_exposures.append(DrugExposure(
                drug_exposure_id=drug_counter.next(),
                person_id=pt.person_id,
                drug_concept_id=ONDANSETRON,
                start_date=cycle_start,
                end_date=cycle_start,
                visit_occurrence_id=visit_id,
                source_value="ondansetron",
                days_supply=1,
            ))

    # Insulin glargine for T2DM patients — continuous from chemo start to end/death
    if pt.has_diabetes:
        insulin_end = pt.death_date if pt.death_date else chemo_end_date + timedelta(days=180)
        visit_id = find_closest_visit(pt.visits, chemo_start)
        pt.drug_exposures.append(DrugExposure(
            drug_exposure_id=drug_counter.next(),
            person_id=pt.person_id,
            drug_concept_id=INSULIN_GLARGINE,
            start_date=chemo_start,
            end_date=insulin_end,
            visit_occurrence_id=visit_id,
            source_value="insulin glargine",
            days_supply=(insulin_end - chemo_start).days,
        ))


def generate_conditions(pt: PatientTrajectory, rng: random.Random) -> None:
    """Generate condition occurrences: primary PDAC + comorbidities."""
    dx = pt.dx_date
    obs_end = pt.death_date if pt.death_date else dx + timedelta(days=rng.randint(700, 1095))
    visit_id = find_closest_visit(pt.visits, dx)

    # Primary PDAC — ongoing
    pt.conditions.append(ConditionOccurrence(
        condition_occurrence_id=condition_counter.next(),
        person_id=pt.person_id,
        condition_concept_id=PDAC,
        start_date=dx,
        end_date=obs_end,
        visit_occurrence_id=visit_id,
        source_value="C25.9",
    ))

    # Abdominal pain — at diagnosis
    pt.conditions.append(ConditionOccurrence(
        condition_occurrence_id=condition_counter.next(),
        person_id=pt.person_id,
        condition_concept_id=ABDOMINAL_PAIN,
        start_date=dx,
        end_date=dx + timedelta(days=rng.randint(30, 90)),
        visit_occurrence_id=visit_id,
        source_value="R10.9",
    ))

    if pt.has_jaundice:
        # Jaundice — resolves after ~30 days (stent placement)
        pt.conditions.append(ConditionOccurrence(
            condition_occurrence_id=condition_counter.next(),
            person_id=pt.person_id,
            condition_concept_id=JAUNDICE,
            start_date=dx,
            end_date=dx + timedelta(days=rng.randint(21, 45)),
            visit_occurrence_id=visit_id,
            source_value="R17",
        ))

    if pt.has_diabetes:
        pt.conditions.append(ConditionOccurrence(
            condition_occurrence_id=condition_counter.next(),
            person_id=pt.person_id,
            condition_concept_id=T2DM,
            start_date=dx - timedelta(days=rng.randint(180, 1800)),  # Pre-existing
            end_date=obs_end,
            visit_occurrence_id=visit_id,
            source_value="E11.9",
        ))

    if pt.has_cachexia:
        # Cachexia develops during treatment
        onset = dx + timedelta(days=rng.randint(30, 120))
        pt.conditions.append(ConditionOccurrence(
            condition_occurrence_id=condition_counter.next(),
            person_id=pt.person_id,
            condition_concept_id=CACHEXIA,
            start_date=onset,
            end_date=obs_end,
            visit_occurrence_id=find_closest_visit(pt.visits, onset),
            source_value="R64",
        ))

    if pt.has_exocrine_insufficiency:
        onset = dx + timedelta(days=rng.randint(0, 60))
        pt.conditions.append(ConditionOccurrence(
            condition_occurrence_id=condition_counter.next(),
            person_id=pt.person_id,
            condition_concept_id=EXOCRINE_INSUFFICIENCY,
            start_date=onset,
            end_date=obs_end,
            visit_occurrence_id=find_closest_visit(pt.visits, onset),
            source_value="K86.81",
        ))

    if pt.has_dvt:
        # DVT typically during chemo
        onset = dx + timedelta(days=rng.randint(30, 180))
        pt.conditions.append(ConditionOccurrence(
            condition_occurrence_id=condition_counter.next(),
            person_id=pt.person_id,
            condition_concept_id=DVT,
            start_date=onset,
            end_date=onset + timedelta(days=rng.randint(90, 180)),
            visit_occurrence_id=find_closest_visit(pt.visits, onset),
            source_value="I82.40",
        ))


def generate_procedures(pt: PatientTrajectory, rng: random.Random) -> None:
    """Generate surgical procedures if applicable."""
    if not pt.gets_surgery:
        return

    surgery_visit = next((v for v in pt.visits if "surgery" in v.source_value.lower()), None)
    if not surgery_visit:
        return

    if pt.tumor_location == "head":
        concept = WHIPPLE
        source = "Pancreaticoduodenectomy (Whipple)"
    else:
        concept = DISTAL_PANCREATECTOMY
        source = "Distal pancreatectomy"

    pt.procedures.append(ProcedureOccurrence(
        procedure_occurrence_id=procedure_counter.next(),
        person_id=pt.person_id,
        procedure_concept_id=concept,
        proc_date=surgery_visit.start_date,
        visit_occurrence_id=surgery_visit.visit_id,
        source_value=source[:50],  # varchar(50) limit
    ))


def generate_specimens(pt: PatientTrajectory, rng: random.Random) -> None:
    """Generate biopsy at dx for all, surgical specimen for resected patients."""
    dx = pt.dx_date
    visit_id = find_closest_visit(pt.visits, dx)

    # Biopsy at diagnosis — all patients
    pt.specimens.append(Specimen(
        specimen_id=specimen_counter.next(),
        person_id=pt.person_id,
        specimen_date=dx + timedelta(days=rng.randint(0, 7)),
        source_value=f"{pt.person_source_value}-biopsy",
        specimen_type="biopsy",
    ))

    # Surgical specimen for resected patients
    if pt.gets_surgery:
        surgery_visit = next((v for v in pt.visits if "surgery" in v.source_value.lower()), None)
        if surgery_visit:
            pt.specimens.append(Specimen(
                specimen_id=specimen_counter.next(),
                person_id=pt.person_id,
                specimen_date=surgery_visit.start_date,
                source_value=f"{pt.person_source_value}-surgical",
                specimen_type="surgical",
            ))


# ── SQL generation ──────────────────────────────────────────────────────────


def generate_sql(patients: list[PatientTrajectory]) -> str:
    """Generate the complete SQL file."""
    parts: list[str] = []

    parts.append("-- Pancreas CDM Enrichment SQL")
    parts.append("-- Generated by enrich_cdm.py")
    parts.append("-- Idempotent: truncates clinical tables before inserting")
    parts.append("")
    parts.append("BEGIN;")
    parts.append("")

    # Truncate clinical tables (NOT person, care_site, location)
    parts.append("-- Truncate clinical tables (preserving person and care_site)")
    for tbl in [
        "observation_period", "visit_occurrence", "condition_occurrence",
        "procedure_occurrence", "measurement", "drug_exposure", "specimen",
        "death", "observation", "condition_era", "drug_era", "cohort",
    ]:
        parts.append(f"TRUNCATE pancreas.{tbl} CASCADE;")
    parts.append("")

    # ── Visits ──
    parts.append("-- Visit occurrences")
    visit_rows: list[str] = []
    for pt in patients:
        for v in pt.visits:
            visit_rows.append(
                f"({v.visit_id}, {v.person_id}, {v.visit_concept_id}, "
                f"'{date_str(v.start_date)}', '{datetime_str(v.start_date)}', "
                f"'{date_str(v.end_date)}', '{datetime_str(v.end_date)}', "
                f"{EHR_TYPE}, NULL, {v.care_site_id}, "
                f"'{sql_escape(v.source_value)}', NULL, NULL, NULL, NULL, NULL, "
                f"{'NULL' if v.preceding_visit_id is None else v.preceding_visit_id})"
            )
    parts.append("INSERT INTO pancreas.visit_occurrence (visit_occurrence_id, person_id, visit_concept_id, visit_start_date, visit_start_datetime, visit_end_date, visit_end_datetime, visit_type_concept_id, provider_id, care_site_id, visit_source_value, visit_source_concept_id, admitted_from_concept_id, admitted_from_source_value, discharged_to_concept_id, discharged_to_source_value, preceding_visit_occurrence_id) VALUES")
    parts.append(",\n".join(visit_rows) + ";")
    parts.append("")

    # ── Conditions ──
    parts.append("-- Condition occurrences")
    cond_rows: list[str] = []
    for pt in patients:
        for c in pt.conditions:
            end_date_sql = f"'{date_str(c.end_date)}'" if c.end_date else "NULL"
            end_datetime_sql = f"'{datetime_str(c.end_date)}'" if c.end_date else "NULL"
            cond_rows.append(
                f"({c.condition_occurrence_id}, {c.person_id}, {c.condition_concept_id}, "
                f"'{date_str(c.start_date)}', '{datetime_str(c.start_date)}', "
                f"{end_date_sql}, {end_datetime_sql}, "
                f"{EHR_TYPE}, NULL, NULL, NULL, {c.visit_occurrence_id}, NULL, "
                f"'{sql_escape(c.source_value)}', NULL, NULL)"
            )
    parts.append("INSERT INTO pancreas.condition_occurrence (condition_occurrence_id, person_id, condition_concept_id, condition_start_date, condition_start_datetime, condition_end_date, condition_end_datetime, condition_type_concept_id, condition_status_concept_id, stop_reason, provider_id, visit_occurrence_id, visit_detail_id, condition_source_value, condition_source_concept_id, condition_status_source_value) VALUES")
    parts.append(",\n".join(cond_rows) + ";")
    parts.append("")

    # ── Procedures ──
    proc_rows: list[str] = []
    for pt in patients:
        for p in pt.procedures:
            proc_rows.append(
                f"({p.procedure_occurrence_id}, {p.person_id}, {p.procedure_concept_id}, "
                f"'{date_str(p.proc_date)}', '{datetime_str(p.proc_date)}', "
                f"'{date_str(p.proc_date)}', '{datetime_str(p.proc_date)}', "
                f"{EHR_TYPE}, NULL, 1, NULL, {p.visit_occurrence_id}, NULL, "
                f"'{sql_escape(p.source_value)}', NULL, NULL)"
            )
    if proc_rows:
        parts.append("-- Procedure occurrences")
        parts.append("INSERT INTO pancreas.procedure_occurrence (procedure_occurrence_id, person_id, procedure_concept_id, procedure_date, procedure_datetime, procedure_end_date, procedure_end_datetime, procedure_type_concept_id, modifier_concept_id, quantity, provider_id, visit_occurrence_id, visit_detail_id, procedure_source_value, procedure_source_concept_id, modifier_source_value) VALUES")
        parts.append(",\n".join(proc_rows) + ";")
        parts.append("")

    # ── Measurements (batched) ──
    all_measurements: list[Measurement] = []
    for pt in patients:
        all_measurements.extend(pt.measurements)

    BATCH_SIZE = 500
    for batch_idx in range(0, len(all_measurements), BATCH_SIZE):
        batch = all_measurements[batch_idx:batch_idx + BATCH_SIZE]
        parts.append(f"-- Measurements batch {batch_idx // BATCH_SIZE + 1}")
        meas_rows: list[str] = []
        for m in batch:
            rng_lo_sql = str(m.range_low) if m.range_low is not None else "NULL"
            rng_hi_sql = str(m.range_high) if m.range_high is not None else "NULL"
            meas_rows.append(
                f"({m.measurement_id}, {m.person_id}, {m.concept_id}, "
                f"'{date_str(m.meas_date)}', '{datetime_str(m.meas_date)}', NULL, "
                f"{EHR_TYPE}, NULL, {m.value}, NULL, {m.unit_concept_id}, "
                f"{rng_lo_sql}, {rng_hi_sql}, NULL, {m.visit_occurrence_id}, NULL, "
                f"'{sql_escape(m.source_value)}', NULL, '{sql_escape(m.unit_source_value)}', NULL, NULL, NULL, NULL)"
            )
        parts.append("INSERT INTO pancreas.measurement (measurement_id, person_id, measurement_concept_id, measurement_date, measurement_datetime, measurement_time, measurement_type_concept_id, operator_concept_id, value_as_number, value_as_concept_id, unit_concept_id, range_low, range_high, provider_id, visit_occurrence_id, visit_detail_id, measurement_source_value, measurement_source_concept_id, unit_source_value, unit_source_concept_id, value_source_value, measurement_event_id, meas_event_field_concept_id) VALUES")
        parts.append(",\n".join(meas_rows) + ";")
        parts.append("")

    # ── Drug exposures (batched) ──
    all_drugs: list[DrugExposure] = []
    for pt in patients:
        all_drugs.extend(pt.drug_exposures)

    for batch_idx in range(0, len(all_drugs), BATCH_SIZE):
        batch = all_drugs[batch_idx:batch_idx + BATCH_SIZE]
        parts.append(f"-- Drug exposures batch {batch_idx // BATCH_SIZE + 1}")
        drug_rows: list[str] = []
        for d in batch:
            drug_rows.append(
                f"({d.drug_exposure_id}, {d.person_id}, {d.drug_concept_id}, "
                f"'{date_str(d.start_date)}', '{datetime_str(d.start_date)}', "
                f"'{date_str(d.end_date)}', '{datetime_str(d.end_date)}', "
                f"NULL, {EHR_TYPE}, NULL, NULL, NULL, {d.days_supply}, NULL, NULL, NULL, NULL, "
                f"{d.visit_occurrence_id}, NULL, "
                f"'{sql_escape(d.source_value)}', NULL, NULL, NULL)"
            )
        parts.append("INSERT INTO pancreas.drug_exposure (drug_exposure_id, person_id, drug_concept_id, drug_exposure_start_date, drug_exposure_start_datetime, drug_exposure_end_date, drug_exposure_end_datetime, verbatim_end_date, drug_type_concept_id, stop_reason, refills, quantity, days_supply, sig, route_concept_id, lot_number, provider_id, visit_occurrence_id, visit_detail_id, drug_source_value, drug_source_concept_id, route_source_value, dose_unit_source_value) VALUES")
        parts.append(",\n".join(drug_rows) + ";")
        parts.append("")

    # ── Specimens ──
    spec_rows: list[str] = []
    for pt in patients:
        for s in pt.specimens:
            spec_rows.append(
                f"({s.specimen_id}, {s.person_id}, {PANCREAS_TISSUE}, "
                f"{EHR_TYPE}, '{date_str(s.specimen_date)}', '{datetime_str(s.specimen_date)}', "
                f"1, NULL, {PANCREAS_SITE}, NULL, "
                f"'{sql_escape(s.source_value)}', '{sql_escape(s.source_value)}-tissue', NULL, 'Pancreas', NULL)"
            )
    if spec_rows:
        parts.append("-- Specimens")
        parts.append("INSERT INTO pancreas.specimen (specimen_id, person_id, specimen_concept_id, specimen_type_concept_id, specimen_date, specimen_datetime, quantity, unit_concept_id, anatomic_site_concept_id, disease_status_concept_id, specimen_source_id, specimen_source_value, unit_source_value, anatomic_site_source_value, disease_status_source_value) VALUES")
        parts.append(",\n".join(spec_rows) + ";")
        parts.append("")

    # ── Death ──
    death_rows: list[str] = []
    for pt in patients:
        if pt.death_date:
            death_rows.append(
                f"({pt.person_id}, '{date_str(pt.death_date)}', '{datetime_str(pt.death_date)}', "
                f"{EHR_TYPE}, {PDAC}, 'C25.9', NULL)"
            )
    if death_rows:
        parts.append("-- Death records")
        parts.append("INSERT INTO pancreas.death (person_id, death_date, death_datetime, death_type_concept_id, cause_concept_id, cause_source_value, cause_source_concept_id) VALUES")
        parts.append(",\n".join(death_rows) + ";")
        parts.append("")

    # ── Observation periods ──
    # Must cover ALL events for each person
    parts.append("-- Observation periods (computed to cover all events)")
    obs_rows: list[str] = []
    for i, pt in enumerate(patients):
        all_dates: list[date] = []
        for v in pt.visits:
            all_dates.append(v.start_date)
            all_dates.append(v.end_date)
        for m in pt.measurements:
            all_dates.append(m.meas_date)
        for d in pt.drug_exposures:
            all_dates.append(d.start_date)
            all_dates.append(d.end_date)
        for c in pt.conditions:
            all_dates.append(c.start_date)
            if c.end_date:
                all_dates.append(c.end_date)
        for p in pt.procedures:
            all_dates.append(p.proc_date)
        for s in pt.specimens:
            all_dates.append(s.specimen_date)
        if pt.death_date:
            all_dates.append(pt.death_date)

        if not all_dates:
            continue

        obs_start = min(all_dates) - timedelta(days=30)
        obs_end = max(all_dates) + timedelta(days=30)

        obs_rows.append(
            f"({i + 1}, {pt.person_id}, '{date_str(obs_start)}', '{date_str(obs_end)}', {EHR_TYPE})"
        )
    parts.append("INSERT INTO pancreas.observation_period (observation_period_id, person_id, observation_period_start_date, observation_period_end_date, period_type_concept_id) VALUES")
    parts.append(",\n".join(obs_rows) + ";")
    parts.append("")

    # ── Condition Era rollup (SQL-based, 30-day persistence window) ──
    parts.append("-- Condition era rollup (30-day persistence window)")
    parts.append("""
INSERT INTO pancreas.condition_era (condition_era_id, person_id, condition_concept_id, condition_era_start_date, condition_era_end_date, condition_occurrence_count)
WITH cte AS (
    SELECT
        person_id,
        condition_concept_id,
        condition_start_date,
        COALESCE(condition_end_date, condition_start_date + INTERVAL '30 days') AS condition_end_date,
        ROW_NUMBER() OVER (PARTITION BY person_id, condition_concept_id ORDER BY condition_start_date) AS rn
    FROM pancreas.condition_occurrence
),
grouped AS (
    SELECT
        person_id,
        condition_concept_id,
        MIN(condition_start_date) AS era_start,
        MAX(condition_end_date)::date AS era_end,
        COUNT(*) AS occurrence_count
    FROM cte
    GROUP BY person_id, condition_concept_id
)
SELECT
    ROW_NUMBER() OVER (ORDER BY person_id, condition_concept_id)::int AS condition_era_id,
    person_id,
    condition_concept_id,
    era_start,
    era_end,
    occurrence_count::int
FROM grouped
ORDER BY person_id, condition_concept_id;
""")
    parts.append("")

    # ── Drug Era rollup (SQL-based, one era per ingredient across all cycles) ──
    parts.append("-- Drug era rollup (one era per ingredient)")
    parts.append("""
INSERT INTO pancreas.drug_era (drug_era_id, person_id, drug_concept_id, drug_era_start_date, drug_era_end_date, drug_exposure_count, gap_days)
WITH drug_agg AS (
    SELECT
        person_id,
        drug_concept_id,
        MIN(drug_exposure_start_date) AS era_start,
        MAX(drug_exposure_end_date) AS era_end,
        COUNT(*) AS exposure_count,
        (MAX(drug_exposure_end_date) - MIN(drug_exposure_start_date))::int
            - SUM((drug_exposure_end_date - drug_exposure_start_date)::int) AS gap_days
    FROM pancreas.drug_exposure
    GROUP BY person_id, drug_concept_id
)
SELECT
    ROW_NUMBER() OVER (ORDER BY person_id, drug_concept_id)::int AS drug_era_id,
    person_id,
    drug_concept_id,
    era_start,
    era_end,
    exposure_count::int,
    GREATEST(gap_days, 0)::int
FROM drug_agg
ORDER BY person_id, drug_concept_id;
""")
    parts.append("")

    parts.append("COMMIT;")
    return "\n".join(parts)


# ── Main ────────────────────────────────────────────────────────────────────


def load_persons() -> list[dict]:
    """Read existing persons from pancreas.person."""
    conn = psycopg2.connect(
        host="localhost",
        dbname="parthenon",
        user="claude_dev",
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT person_id, person_source_value, gender_concept_id, "
                "year_of_birth, care_site_id "
                "FROM pancreas.person ORDER BY person_id"
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "person_id": r[0],
            "person_source_value": r[1],
            "gender_concept_id": r[2],
            "year_of_birth": r[3],
            "care_site_id": r[4],
        }
        for r in rows
    ]


def build_trajectories(persons: list[dict]) -> list[PatientTrajectory]:
    """Build clinical trajectories for all patients."""
    random.seed(42)
    trajectories: list[PatientTrajectory] = []

    for person in persons:
        pid = person["person_id"]
        # Deterministic per-patient RNG
        rng = random.Random(pid * 7919 + 104729)

        is_cptac = person["care_site_id"] == 2
        subgroup = assign_subgroup(rng, is_cptac)
        tumor_location = assign_tumor_location(rng)
        has_diabetes, has_jaundice, has_cachexia, has_exocrine, has_dvt = assign_comorbidities(rng, tumor_location)
        chemo_regimen = assign_chemo_regimen(rng)
        gets_surgery, gets_neoadjuvant = determine_surgery(rng, subgroup)
        gets_second_line = subgroup == METASTATIC and rng.random() < 0.40

        # Diagnosis date: spread across 2019-2022
        base = date(2019, 1, 1)
        dx_date = base + timedelta(days=rng.randint(0, 1095))

        death_date = determine_death(rng, subgroup, dx_date)

        pt = PatientTrajectory(
            person_id=pid,
            person_source_value=person["person_source_value"],
            care_site_id=person["care_site_id"],
            year_of_birth=person["year_of_birth"],
            subgroup=subgroup,
            tumor_location=tumor_location,
            has_diabetes=has_diabetes,
            has_jaundice=has_jaundice,
            has_cachexia=has_cachexia,
            has_exocrine_insufficiency=has_exocrine,
            has_dvt=has_dvt,
            chemo_regimen=chemo_regimen,
            gets_surgery=gets_surgery,
            gets_neoadjuvant=gets_neoadjuvant,
            gets_second_line=gets_second_line,
            dx_date=dx_date,
            death_date=death_date,
        )

        # Generate each domain
        generate_visits(pt, rng)
        generate_measurements(pt, rng)
        generate_drug_exposures(pt, rng)
        generate_conditions(pt, rng)
        generate_procedures(pt, rng)
        generate_specimens(pt, rng)

        trajectories.append(pt)

    return trajectories


def print_subgroup_stats(trajectories: list[PatientTrajectory]) -> None:
    """Print clinical subgroup distribution."""
    counts: dict[str, int] = {}
    surgery_counts: dict[str, int] = {}
    death_counts: dict[str, int] = {}
    for pt in trajectories:
        counts[pt.subgroup] = counts.get(pt.subgroup, 0) + 1
        if pt.gets_surgery:
            surgery_counts[pt.subgroup] = surgery_counts.get(pt.subgroup, 0) + 1
        if pt.death_date:
            death_counts[pt.subgroup] = death_counts.get(pt.subgroup, 0) + 1

    total = len(trajectories)
    print(f"\n  Subgroup distribution (n={total}):")
    for sg in [RESECTABLE, BORDERLINE, METASTATIC]:
        n = counts.get(sg, 0)
        surg = surgery_counts.get(sg, 0)
        died = death_counts.get(sg, 0)
        print(f"    {sg:15s}: {n:3d} ({100*n/total:4.1f}%)  surgery={surg}  died={died} ({100*died/max(n,1):.0f}%)")


def main() -> None:
    print("=" * 60)
    print("Pancreas CDM Enrichment")
    print("=" * 60)

    # Step 1: Load existing persons
    print("\n[1/5] Loading persons from pancreas.person...")
    persons = load_persons()
    print(f"  Loaded {len(persons)} persons")

    if len(persons) == 0:
        print("  ERROR: No persons found. Run populate_cdm.py first.")
        sys.exit(1)

    # Step 2: Build trajectories
    print("\n[2/5] Building clinical trajectories...")
    trajectories = build_trajectories(persons)
    print_subgroup_stats(trajectories)

    # Count totals
    total_visits = sum(len(pt.visits) for pt in trajectories)
    total_measurements = sum(len(pt.measurements) for pt in trajectories)
    total_drugs = sum(len(pt.drug_exposures) for pt in trajectories)
    total_conditions = sum(len(pt.conditions) for pt in trajectories)
    total_procedures = sum(len(pt.procedures) for pt in trajectories)
    total_specimens = sum(len(pt.specimens) for pt in trajectories)
    total_deaths = sum(1 for pt in trajectories if pt.death_date)

    print(f"\n  Generated records:")
    print(f"    Visits:           {total_visits:,}")
    print(f"    Measurements:     {total_measurements:,}")
    print(f"    Drug exposures:   {total_drugs:,}")
    print(f"    Conditions:       {total_conditions:,}")
    print(f"    Procedures:       {total_procedures:,}")
    print(f"    Specimens:        {total_specimens:,}")
    print(f"    Deaths:           {total_deaths:,}")

    # Step 3: Generate SQL
    print("\n[3/5] Generating SQL...")
    sql = generate_sql(trajectories)
    sql_file = Path(__file__).parent / "enrich_cdm.sql"
    sql_file.write_text(sql)
    print(f"  Written to {sql_file} ({len(sql):,} bytes)")

    # Step 4: Execute SQL
    print("\n[4/5] Executing SQL via psql...")
    result = subprocess.run(
        [
            "psql", "-h", "localhost", "-U", "claude_dev", "-d", "parthenon",
            "-v", "ON_ERROR_STOP=1",
            "-f", str(sql_file),
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"  ERROR: psql returned {result.returncode}")
        print(f"  STDERR: {result.stderr[:2000]}")
        # Print last few lines of stdout for context
        stdout_lines = result.stdout.strip().split("\n")
        if stdout_lines:
            print(f"  Last stdout lines:")
            for line in stdout_lines[-10:]:
                print(f"    {line}")
        sys.exit(1)

    print("  SQL executed successfully")

    # Step 5: Verify
    print("\n[5/5] Verification counts:")
    verify_sql = """
SELECT 'person' as tbl, count(*) FROM pancreas.person
UNION ALL SELECT 'observation_period', count(*) FROM pancreas.observation_period
UNION ALL SELECT 'visit_occurrence', count(*) FROM pancreas.visit_occurrence
UNION ALL SELECT 'condition_occurrence', count(*) FROM pancreas.condition_occurrence
UNION ALL SELECT 'procedure_occurrence', count(*) FROM pancreas.procedure_occurrence
UNION ALL SELECT 'measurement', count(*) FROM pancreas.measurement
UNION ALL SELECT 'drug_exposure', count(*) FROM pancreas.drug_exposure
UNION ALL SELECT 'specimen', count(*) FROM pancreas.specimen
UNION ALL SELECT 'death', count(*) FROM pancreas.death
UNION ALL SELECT 'condition_era', count(*) FROM pancreas.condition_era
UNION ALL SELECT 'drug_era', count(*) FROM pancreas.drug_era
ORDER BY 1;
"""
    result = subprocess.run(
        ["psql", "-h", "localhost", "-U", "claude_dev", "-d", "parthenon", "-c", verify_sql],
        capture_output=True,
        text=True,
    )
    print(result.stdout)

    print("Done!")


if __name__ == "__main__":
    main()
