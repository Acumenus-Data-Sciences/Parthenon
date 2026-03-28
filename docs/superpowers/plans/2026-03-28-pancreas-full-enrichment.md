# Pancreatic Cancer Corpus Full Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the pancreatic corpus to ~374 patients with DICOM linkage, genomic mutation profiles, and LLM-generated clinical notes — every patient fully multimodal.

**Architecture:** Four independent Python scripts, each idempotent: (1) extend `enrich_cdm.py` to add TCGA-PAAD patients, (2) `link_dicom.py` to connect Orthanc studies to CDM persons, (3) `enrich_genomics.py` to parse real MAF mutations + assign synthetic profiles, (4) `generate_notes.py` to produce MedGemma clinical notes. A Laravel command update adds the KRAS cohort.

**Tech Stack:** Python 3.12 (psycopg2, gzip, requests, json), Ollama/MedGemma 1.5 4B, PostgreSQL 17, Orthanc REST API, Laravel 11

**Spec:** `docs/superpowers/specs/2026-03-28-pancreas-full-enrichment-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `scripts/pancreatic/enrich_cdm.py` | Add TCGA-PAAD cohort expansion (new care_site, persons, trajectories) |
| Create | `scripts/pancreatic/link_dicom.py` | Map Orthanc patients → CDM persons, create imaging_studies records |
| Create | `scripts/pancreatic/enrich_genomics.py` | Parse MAF files + assign synthetic mutations → measurement records |
| Create | `scripts/pancreatic/generate_notes.py` | Generate clinical notes via MedGemma → note table |
| Modify | `scripts/pancreatic/create_schema.sql` | Ensure note table has correct columns |
| Modify | `backend/app/Console/Commands/SeedPancreasCohortDefinitionsCommand.php` | Add 5th cohort (KRAS Mutant PDAC), update membership for expanded corpus |

---

## Validated Concept Reference (Phase 2 additions)

### Genomic Measurements
| Concept ID | Name | Use |
|------------|------|-----|
| 3012200 | KRAS gene mutations found in Blood or Tissue | KRAS mutation status |
| 3009106 | TP53 gene mutations found in Blood or Tissue | TP53 mutation status |
| 1988360 | SMAD4 gene mutations found in Blood or Tissue | SMAD4 mutation status |
| 3026497 | CDKN2A gene deletion in Blood or Tissue | CDKN2A status |

### Genomic Value Concepts
| Concept ID | Name | Use |
|------------|------|-----|
| 4181412 | Present | Mutation detected (value_as_concept_id) |
| 4132135 | Absent | Wild-type (value_as_concept_id) |

### Note Types
| Concept ID | Name | Use |
|------------|------|-----|
| 32831 | EHR note | note_type for consultation/operative |
| 32834 | EHR outpatient note | note_type for progress notes |
| 32835 | EHR Pathology report | note_type for pathology reports |
| 44814639 | Inpatient note | note_class for operative notes |
| 44814640 | Outpatient note | note_class for consultations/progress |
| 44814642 | Pathology report | note_class for path reports |
| 4180186 | English language | language_concept_id |

### Orthanc
| Parameter | Value |
|-----------|-------|
| URL | http://localhost:8042 |
| Username | parthenon |
| Password | GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih |

### Data Paths
| Dataset | Path |
|---------|------|
| MAF files | /mnt/md0/pancreatic-corpus/genomics/TCGA-PAAD/\*/\*.wxs.aliquot_ensemble_masked.maf.gz |
| PANCREAS-CT DICOM | Already in Orthanc (PatientID: PANCREAS_XXXX) |
| CPTAC-PDA DICOM | Already in Orthanc (PatientID: C3L-XXXXX, C3N-XXXXX) |

---

## Task 1: Expand enrich_cdm.py for TCGA-PAAD Patients

**Files:**
- Modify: `scripts/pancreatic/enrich_cdm.py`

This task extends the existing enrichment script to add ~172 TCGA-PAAD patients as a third sub-cohort. The script already handles patient stratification and trajectory generation — we add a new patient source.

- [ ] **Step 1: Add TCGA-PAAD patient extraction function**

Add after the existing `load_existing_persons()` function:

```python
import gzip


def extract_tcga_patient_barcodes() -> list[str]:
    """Extract unique TCGA patient barcodes from MAF files."""
    maf_dir = Path("/mnt/md0/pancreatic-corpus/genomics/TCGA-PAAD")
    barcodes: set[str] = set()

    for maf_path in maf_dir.rglob("*.maf.gz"):
        try:
            with gzip.open(maf_path, "rt") as f:
                for line in f:
                    if line.startswith("#") or line.startswith("Hugo_Symbol"):
                        continue
                    fields = line.split("\t")
                    if len(fields) > 15:
                        # Tumor_Sample_Barcode column (index 15), first 12 chars = patient ID
                        barcode = fields[15][:12]
                        if barcode.startswith("TCGA-"):
                            barcodes.add(barcode)
        except Exception as e:
            print(f"  Warning: {maf_path.name}: {e}")

    return sorted(barcodes)
```

- [ ] **Step 2: Modify the main function to create TCGA-PAAD persons**

In `main()`, after loading existing persons and before stratification, add logic to insert new TCGA-PAAD persons if they don't already exist:

```python
def create_tcga_persons(barcodes: list[str], existing_max_id: int) -> list[dict[str, Any]]:
    """Create person records for TCGA-PAAD patients."""
    random.seed(RANDOM_SEED + 1000)  # Different seed space from original patients
    persons = []

    for i, barcode in enumerate(barcodes):
        person_id = existing_max_id + 1 + i
        r = random.Random(person_id * 5 + 97)

        gender = MALE if r.random() < 0.55 else FEMALE
        year_of_birth = 2020 - r.randint(50, 80)
        race = r.choice([WHITE, WHITE, WHITE, BLACK, ASIAN])  # weighted

        persons.append({
            "person_id": person_id,
            "gender_concept_id": gender,
            "year_of_birth": year_of_birth,
            "month_of_birth": r.randint(1, 12),
            "day_of_birth": r.randint(1, 28),
            "race_concept_id": race,
            "care_site_id": 3,  # TCGA-PAAD
            "person_source_value": barcode,
            "dataset": "TCGA-PAAD",
        })

    return persons
```

- [ ] **Step 3: Update SQL generation to include care_site 3**

In `generate_sql()`, update the care_site INSERT to add:
```sql
(3, 'NCI TCGA Pancreatic Adenocarcinoma', 8756, 'TCGA-PAAD', 'Research Consortium')
```

- [ ] **Step 4: Update main() to merge both patient lists**

Modify `main()` to:
1. Load existing 189 persons
2. Extract TCGA barcodes (172 patients)
3. Create new person records for TCGA-PAAD
4. Merge all persons into a single list
5. Run stratification and trajectory generation on the full ~361 patients
6. Generate and execute SQL

The key change in main():
```python
def main() -> None:
    print("Loading existing persons...")
    existing = load_existing_persons()
    print(f"  Found {len(existing)} existing persons")

    print("Extracting TCGA-PAAD patient barcodes...")
    barcodes = extract_tcga_patient_barcodes()
    print(f"  Found {len(barcodes)} TCGA-PAAD patients")

    max_id = max(p["person_id"] for p in existing)
    tcga_persons = create_tcga_persons(barcodes, max_id)

    # Merge: existing persons keep their attributes, TCGA-PAAD are new
    all_persons = existing + tcga_persons
    print(f"  Total: {len(all_persons)} patients")

    # ... rest of main unchanged
```

- [ ] **Step 5: Run the updated enrichment script**

Run:
```bash
python3 scripts/pancreatic/enrich_cdm.py
```

Expected: ~361 patients, ~2,200 visits, ~23,000 measurements, ~11,000 drug exposures.

- [ ] **Step 6: Verify and commit**

```bash
psql -h localhost -U claude_dev -d parthenon -c "SELECT count(*) FROM pancreas.person;"
# Expected: ~361

psql -h localhost -U claude_dev -d parthenon -c "
SELECT care_site_id, count(*) FROM pancreas.person GROUP BY care_site_id ORDER BY 1;"
# Expected: 1=21, 2=168, 3=172
```

```bash
git add scripts/pancreatic/enrich_cdm.py
git commit -m "feat(pancreas): expand corpus with ~172 TCGA-PAAD patients"
```

---

## Task 2: DICOM Imaging Linkage

**Files:**
- Create: `scripts/pancreatic/link_dicom.py`

- [ ] **Step 1: Create the DICOM linkage script**

```python
#!/usr/bin/env python3
"""
Link Orthanc DICOM studies to CDM persons in the pancreas schema.

Queries Orthanc REST API to find patients matching our CDM cohort,
then creates imaging_studies records in the app schema.

Run: python3 scripts/pancreatic/link_dicom.py
"""

import json
import sys
from datetime import datetime

import psycopg2
import requests

ORTHANC_URL = "http://localhost:8042"
ORTHANC_USER = "parthenon"
ORTHANC_PASS = "GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih"
SOURCE_ID = 58

DB_HOST = "localhost"
DB_NAME = "parthenon"
DB_USER = "claude_dev"


def get_cdm_persons() -> dict[str, int]:
    """Load person_source_value → person_id mapping from CDM."""
    conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER)
    cur = conn.cursor()
    cur.execute("SELECT person_source_value, person_id FROM pancreas.person")
    mapping = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    return mapping


def orthanc_find_patients(pattern: str) -> list[str]:
    """Find Orthanc patient IDs matching a PatientID pattern."""
    resp = requests.post(
        f"{ORTHANC_URL}/tools/find",
        auth=(ORTHANC_USER, ORTHANC_PASS),
        json={"Level": "Patient", "Query": {"PatientID": pattern}},
    )
    resp.raise_for_status()
    return resp.json()


def get_patient_details(orthanc_patient_id: str) -> dict:
    """Get patient details including studies from Orthanc."""
    resp = requests.get(
        f"{ORTHANC_URL}/patients/{orthanc_patient_id}",
        auth=(ORTHANC_USER, ORTHANC_PASS),
    )
    resp.raise_for_status()
    return resp.json()


def get_study_details(orthanc_study_id: str) -> dict:
    """Get study-level DICOM metadata from Orthanc."""
    resp = requests.get(
        f"{ORTHANC_URL}/studies/{orthanc_study_id}",
        auth=(ORTHANC_USER, ORTHANC_PASS),
    )
    resp.raise_for_status()
    return resp.json()


def link_studies() -> None:
    """Main linkage routine."""
    persons = get_cdm_persons()
    print(f"Loaded {len(persons)} CDM persons")

    conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER)
    cur = conn.cursor()

    # Clear existing imaging_studies for this source
    cur.execute("DELETE FROM app.imaging_studies WHERE source_id = %s", (SOURCE_ID,))
    conn.commit()
    print(f"Cleared existing imaging_studies for source {SOURCE_ID}")

    # Search patterns for our cohort patient IDs in Orthanc
    patterns = ["PANCREAS*", "C3L*", "C3N*"]
    linked = 0
    skipped = 0

    for pattern in patterns:
        orthanc_patients = orthanc_find_patients(pattern)
        print(f"\nPattern '{pattern}': {len(orthanc_patients)} Orthanc patients")

        for orth_pid in orthanc_patients:
            try:
                patient = get_patient_details(orth_pid)
                dicom_patient_id = patient.get("MainDicomTags", {}).get("PatientID", "")

                # Match to CDM person
                person_id = persons.get(dicom_patient_id)
                if not person_id:
                    skipped += 1
                    continue

                # Process each study
                for orthanc_study_id in patient.get("Studies", []):
                    study = get_study_details(orthanc_study_id)
                    tags = study.get("MainDicomTags", {})
                    series_list = study.get("Series", [])

                    study_uid = tags.get("StudyInstanceUID", "")
                    study_date_str = tags.get("StudyDate", "")
                    study_desc = tags.get("StudyDescription", "")
                    accession = tags.get("AccessionNumber", "")
                    referring = tags.get("ReferringPhysicianName", "")
                    institution = tags.get("InstitutionName", "")
                    patient_name = patient.get("MainDicomTags", {}).get("PatientName", "")

                    # Determine modality from first series
                    modality = ""
                    if series_list:
                        series_resp = requests.get(
                            f"{ORTHANC_URL}/series/{series_list[0]}",
                            auth=(ORTHANC_USER, ORTHANC_PASS),
                        )
                        if series_resp.ok:
                            modality = series_resp.json().get("MainDicomTags", {}).get("Modality", "")

                    # Parse study date
                    study_date = None
                    if study_date_str and len(study_date_str) == 8:
                        try:
                            study_date = datetime.strptime(study_date_str, "%Y%m%d").date()
                        except ValueError:
                            pass

                    # Count series and instances
                    num_series = len(series_list)
                    num_images = sum(
                        len(requests.get(
                            f"{ORTHANC_URL}/series/{sid}",
                            auth=(ORTHANC_USER, ORTHANC_PASS),
                        ).json().get("Instances", []))
                        for sid in series_list
                    ) if num_series <= 20 else 0  # Skip counting for huge studies

                    cur.execute("""
                        INSERT INTO app.imaging_studies
                        (source_id, person_id, study_instance_uid, accession_number,
                         modality, study_description, referring_physician, study_date,
                         num_series, num_images, orthanc_study_id, status,
                         patient_name_dicom, patient_id_dicom, institution_name,
                         created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    """, (
                        SOURCE_ID, person_id, study_uid, accession,
                        modality, study_desc, referring, study_date,
                        num_series, num_images, orthanc_study_id, "indexed",
                        patient_name, dicom_patient_id, institution,
                    ))
                    linked += 1

            except Exception as e:
                print(f"  Error processing {orth_pid}: {e}")
                continue

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone: {linked} studies linked, {skipped} patients skipped (no CDM match)")


if __name__ == "__main__":
    link_studies()
```

- [ ] **Step 2: Run the linkage script**

Run:
```bash
python3 scripts/pancreatic/link_dicom.py
```

Expected: ~200+ studies linked (23 PANCREAS-CT + ~192 CPTAC-PDA patients with studies).

- [ ] **Step 3: Verify imaging_studies populated**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT modality, count(*) FROM app.imaging_studies WHERE source_id = 58 GROUP BY modality;"
```

Expected: CT studies from PANCREAS-CT, SM (slide microscopy) from CPTAC-PDA.

- [ ] **Step 4: Commit**

```bash
git add scripts/pancreatic/link_dicom.py
git commit -m "feat(pancreas): DICOM imaging linkage from Orthanc to CDM persons"
```

---

## Task 3: Genomic Mutation Profiles

**Files:**
- Create: `scripts/pancreatic/enrich_genomics.py`

- [ ] **Step 1: Create the genomics enrichment script**

```python
#!/usr/bin/env python3
"""
Enrich the pancreas CDM with genomic mutation profiles.

For TCGA-PAAD patients: Parse real somatic mutations from MAF files.
For original 189 patients: Assign synthetic mutations based on published PDAC frequencies.

Stores mutations as measurement records in pancreas.measurement.

Run: python3 scripts/pancreatic/enrich_genomics.py
"""

import gzip
import random
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import psycopg2

DB_HOST = "localhost"
DB_NAME = "parthenon"
DB_USER = "claude_dev"

RANDOM_SEED = 42

# Gene → OMOP measurement concept
GENE_CONCEPTS = {
    "KRAS": 3012200,
    "TP53": 3009106,
    "SMAD4": 1988360,
    "CDKN2A": 3026497,
}

# Value concepts
PRESENT = 4181412
ABSENT = 4132135
EHR_TYPE = 32817

# Published PDAC mutation frequencies
PDAC_FREQUENCIES = {
    "KRAS": 0.93,
    "TP53": 0.72,
    "SMAD4": 0.32,
    "CDKN2A": 0.30,
}

# Common KRAS variants with relative frequencies (sum to 1.0)
KRAS_VARIANTS = [
    ("p.G12D", 0.41),
    ("p.G12V", 0.32),
    ("p.G12R", 0.16),
    ("p.Q61H", 0.05),
    ("p.G12C", 0.03),
    ("p.G12A", 0.03),
]

TP53_VARIANTS = [
    ("p.R175H", 0.10),
    ("p.R248W", 0.08),
    ("p.R273H", 0.07),
    ("p.G245S", 0.05),
    ("p.R282W", 0.05),
    ("p.V157F", 0.04),
    ("p.Y220C", 0.04),
    ("p.R248Q", 0.04),
    ("p.C176Y", 0.03),
    ("p.other_missense", 0.50),
]

SMAD4_VARIANTS = [
    ("p.R361H", 0.15),
    ("p.R361C", 0.10),
    ("deletion", 0.40),
    ("p.other_LOF", 0.35),
]

CDKN2A_VARIANTS = [
    ("deletion", 0.70),
    ("p.R58*", 0.10),
    ("p.other", 0.20),
]

VARIANT_TABLES = {
    "KRAS": KRAS_VARIANTS,
    "TP53": TP53_VARIANTS,
    "SMAD4": SMAD4_VARIANTS,
    "CDKN2A": CDKN2A_VARIANTS,
}


@dataclass
class GenomicResult:
    person_id: int
    gene: str
    concept_id: int
    is_mutated: bool
    variant: str  # HGVS notation or "wild-type"
    measurement_date: date
    visit_occurrence_id: int | None


def pick_variant(gene: str, rng: random.Random) -> str:
    """Pick a specific variant based on published frequency distribution."""
    variants = VARIANT_TABLES[gene]
    roll = rng.random()
    cumulative = 0.0
    for variant, freq in variants:
        cumulative += freq
        if roll < cumulative:
            return variant
    return variants[-1][0]


def parse_maf_mutations() -> dict[str, dict[str, str]]:
    """Parse MAF files to get real mutations per TCGA patient.

    Returns: {patient_barcode: {gene: hgvsp_short}}
    """
    maf_dir = Path("/mnt/md0/pancreatic-corpus/genomics/TCGA-PAAD")
    patient_mutations: dict[str, dict[str, str]] = {}

    target_genes = set(GENE_CONCEPTS.keys())

    for maf_path in sorted(maf_dir.rglob("*.maf.gz")):
        try:
            with gzip.open(maf_path, "rt") as f:
                header_idx: dict[str, int] = {}
                for line in f:
                    if line.startswith("#"):
                        continue
                    if line.startswith("Hugo_Symbol"):
                        cols = line.strip().split("\t")
                        header_idx = {c: i for i, c in enumerate(cols)}
                        continue

                    fields = line.strip().split("\t")
                    gene = fields[header_idx.get("Hugo_Symbol", 0)]
                    if gene not in target_genes:
                        continue

                    barcode = fields[header_idx.get("Tumor_Sample_Barcode", 15)][:12]
                    hgvsp = fields[header_idx.get("HGVSp_Short", 36)] if len(fields) > 36 else ""
                    variant_class = fields[header_idx.get("Variant_Classification", 8)]

                    # Skip silent/intronic/UTR mutations
                    if variant_class in ("Silent", "Intron", "3'UTR", "5'UTR", "3'Flank", "5'Flank"):
                        continue

                    if barcode not in patient_mutations:
                        patient_mutations[barcode] = {}

                    # Keep the most impactful variant per gene
                    if gene not in patient_mutations[barcode] or hgvsp:
                        patient_mutations[barcode][gene] = hgvsp or variant_class

        except Exception as e:
            print(f"  Warning: {maf_path.name}: {e}")

    return patient_mutations


def generate_genomics() -> None:
    """Main genomics enrichment routine."""
    conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER)
    cur = conn.cursor()

    # Load all persons with their first visit and biopsy date
    cur.execute("""
        SELECT p.person_id, p.person_source_value, p.care_site_id,
               (SELECT MIN(v.visit_start_date) FROM pancreas.visit_occurrence v
                WHERE v.person_id = p.person_id) AS first_visit_date,
               (SELECT v.visit_occurrence_id FROM pancreas.visit_occurrence v
                WHERE v.person_id = p.person_id
                ORDER BY v.visit_start_date LIMIT 1) AS first_visit_id,
               (SELECT s.specimen_date FROM pancreas.specimen s
                WHERE s.person_id = p.person_id
                ORDER BY s.specimen_date LIMIT 1) AS biopsy_date
        FROM pancreas.person p
        ORDER BY p.person_id
    """)
    persons = cur.fetchall()
    print(f"Loaded {len(persons)} persons")

    # Parse real MAF mutations
    print("Parsing MAF files...")
    real_mutations = parse_maf_mutations()
    print(f"  Found mutations for {len(real_mutations)} TCGA patients")

    # Get current max measurement_id
    cur.execute("SELECT COALESCE(MAX(measurement_id), 0) FROM pancreas.measurement")
    meas_id = cur.fetchone()[0] + 1

    # Clear existing genomic measurements (by concept_id)
    genomic_concepts = list(GENE_CONCEPTS.values())
    cur.execute(
        "DELETE FROM pancreas.measurement WHERE measurement_concept_id = ANY(%s)",
        (genomic_concepts,),
    )
    conn.commit()
    print("Cleared existing genomic measurements")

    results: list[GenomicResult] = []

    for person_id, source_value, care_site_id, first_visit_date, first_visit_id, biopsy_date in persons:
        meas_date = biopsy_date or first_visit_date
        if not meas_date:
            continue

        rng = random.Random(person_id * 61 + 103)

        if care_site_id == 3 and source_value in real_mutations:
            # TCGA-PAAD patient with real MAF data
            patient_muts = real_mutations[source_value]
            for gene, concept_id in GENE_CONCEPTS.items():
                if gene in patient_muts:
                    results.append(GenomicResult(
                        person_id=person_id,
                        gene=gene,
                        concept_id=concept_id,
                        is_mutated=True,
                        variant=patient_muts[gene],
                        measurement_date=meas_date,
                        visit_occurrence_id=first_visit_id,
                    ))
                else:
                    results.append(GenomicResult(
                        person_id=person_id,
                        gene=gene,
                        concept_id=concept_id,
                        is_mutated=False,
                        variant="wild-type",
                        measurement_date=meas_date,
                        visit_occurrence_id=first_visit_id,
                    ))
        else:
            # Original 189 patients or TCGA-PAAD without MAF: synthetic assignment
            for gene, concept_id in GENE_CONCEPTS.items():
                freq = PDAC_FREQUENCIES[gene]
                is_mutated = rng.random() < freq
                variant = pick_variant(gene, rng) if is_mutated else "wild-type"

                results.append(GenomicResult(
                    person_id=person_id,
                    gene=gene,
                    concept_id=concept_id,
                    is_mutated=is_mutated,
                    variant=variant,
                    measurement_date=meas_date,
                    visit_occurrence_id=first_visit_id,
                ))

    # Insert measurements
    print(f"Inserting {len(results)} genomic measurements...")
    for r in results:
        value_concept = PRESENT if r.is_mutated else ABSENT
        variant_escaped = r.variant.replace("'", "''")

        cur.execute("""
            INSERT INTO pancreas.measurement
            (measurement_id, person_id, measurement_concept_id, measurement_date,
             measurement_datetime, measurement_time, measurement_type_concept_id,
             operator_concept_id, value_as_number, value_as_concept_id,
             unit_concept_id, range_low, range_high, provider_id,
             visit_occurrence_id, visit_detail_id, unit_source_value,
             measurement_source_value, measurement_source_concept_id,
             value_source_value, measurement_event_id, meas_event_field_concept_id)
            VALUES (%s, %s, %s, %s, %s, NULL, %s, NULL, NULL, %s, NULL, NULL, NULL, NULL,
                    %s, NULL, NULL, %s, NULL, %s, NULL, NULL)
        """, (
            meas_id, r.person_id, r.concept_id, r.measurement_date,
            f"{r.measurement_date} 10:00:00", EHR_TYPE, value_concept,
            r.visit_occurrence_id, f"{r.gene} somatic mutation analysis",
            variant_escaped,
        ))
        meas_id += 1

    conn.commit()

    # Summary
    mutated_counts = {}
    for r in results:
        if r.is_mutated:
            mutated_counts[r.gene] = mutated_counts.get(r.gene, 0) + 1
    total_patients = len(persons)

    print(f"\n── Genomic Summary ({total_patients} patients) ──")
    for gene in ["KRAS", "TP53", "SMAD4", "CDKN2A"]:
        n = mutated_counts.get(gene, 0)
        print(f"  {gene:8s}: {n:4d} mutated ({n/total_patients*100:.0f}%)")
    print(f"  Total measurements: {len(results)}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    generate_genomics()
```

- [ ] **Step 2: Run the genomics enrichment**

Run:
```bash
python3 scripts/pancreatic/enrich_genomics.py
```

Expected output:
```
Loaded ~361 persons
Parsing MAF files...
  Found mutations for ~172 TCGA patients
Cleared existing genomic measurements
Inserting ~1444 genomic measurements...

── Genomic Summary (361 patients) ──
  KRAS    : ~335 mutated (93%)
  TP53    : ~260 mutated (72%)
  SMAD4   : ~115 mutated (32%)
  CDKN2A  : ~108 mutated (30%)
  Total measurements: ~1444
```

- [ ] **Step 3: Verify**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT c.concept_name, count(*) as total,
       sum(CASE WHEN m.value_as_concept_id = 4181412 THEN 1 ELSE 0 END) as mutated,
       sum(CASE WHEN m.value_as_concept_id = 4132135 THEN 1 ELSE 0 END) as wild_type
FROM pancreas.measurement m
JOIN vocab.concept c ON m.measurement_concept_id = c.concept_id
WHERE m.measurement_concept_id IN (3012200, 3009106, 1988360, 3026497)
GROUP BY c.concept_name ORDER BY 1;"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/pancreatic/enrich_genomics.py
git commit -m "feat(pancreas): genomic mutation profiles from real MAF data and synthetic assignment"
```

---

## Task 4: LLM-Generated Clinical Notes

**Files:**
- Create: `scripts/pancreatic/generate_notes.py`

- [ ] **Step 1: Create the note generation script**

```python
#!/usr/bin/env python3
"""
Generate clinical notes for pancreas CDM patients using MedGemma via Ollama.

Note types: Initial consultation, Pathology report, Operative note, Progress note.
Each note is contextualized with patient-specific CDM data.

Idempotent: skips patients who already have notes (use --force to regenerate).

Run: python3 scripts/pancreatic/generate_notes.py [--force]
"""

import json
import sys
import time
from dataclasses import dataclass
from datetime import date

import psycopg2
import requests

DB_HOST = "localhost"
DB_NAME = "parthenon"
DB_USER = "claude_dev"

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "MedAIBase/MedGemma1.5:4b"

# Note type concepts
EHR_NOTE = 32831
EHR_OUTPATIENT_NOTE = 32834
EHR_PATHOLOGY_REPORT = 32835

# Note class concepts
OUTPATIENT_NOTE_CLASS = 44814640
INPATIENT_NOTE_CLASS = 44814639
PATHOLOGY_REPORT_CLASS = 44814642

# Language
ENGLISH = 4180186
EHR_TYPE = 32817

# Gene concepts for context
GENE_CONCEPTS = {3012200: "KRAS", 3009106: "TP53", 1988360: "SMAD4", 3026497: "CDKN2A"}
PRESENT = 4181412


@dataclass
class PatientContext:
    person_id: int
    age: int
    sex: str
    source_value: str
    diagnosis_date: date
    conditions: list[str]
    medications: list[str]
    procedures: list[str]
    mutations: dict[str, str]  # gene → variant or "wild-type"
    labs_at_dx: dict[str, float]  # concept_name → value
    subgroup: str  # inferred from procedures/visits
    tumor_location: str  # inferred from procedure type
    is_dead: bool
    survival_days: int
    visits: list[dict]


def load_patient_contexts() -> list[PatientContext]:
    """Load full clinical context for each patient from the CDM."""
    conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER)
    cur = conn.cursor()

    # Get all persons
    cur.execute("""
        SELECT p.person_id, p.year_of_birth, p.gender_concept_id, p.person_source_value
        FROM pancreas.person p ORDER BY p.person_id
    """)
    persons = cur.fetchall()

    contexts = []
    for person_id, yob, gender_concept, source_val in persons:
        age = 2023 - yob
        sex = "Male" if gender_concept == 8507 else "Female"

        # Diagnosis date
        cur.execute("""
            SELECT MIN(condition_start_date) FROM pancreas.condition_occurrence
            WHERE person_id = %s AND condition_concept_id = 4180793
        """, (person_id,))
        dx_date = cur.fetchone()[0]
        if not dx_date:
            continue

        # Conditions
        cur.execute("""
            SELECT DISTINCT c.concept_name FROM pancreas.condition_occurrence co
            JOIN vocab.concept c ON co.condition_concept_id = c.concept_id
            WHERE co.person_id = %s
        """, (person_id,))
        conditions = [r[0] for r in cur.fetchall()]

        # Medications (unique drug names)
        cur.execute("""
            SELECT DISTINCT de.drug_source_value FROM pancreas.drug_exposure de
            WHERE de.person_id = %s AND de.drug_source_value NOT IN ('Ondansetron')
        """, (person_id,))
        medications = [r[0] for r in cur.fetchall()]

        # Procedures
        cur.execute("""
            SELECT c.concept_name FROM pancreas.procedure_occurrence po
            JOIN vocab.concept c ON po.procedure_concept_id = c.concept_id
            WHERE po.person_id = %s
        """, (person_id,))
        procedures = [r[0] for r in cur.fetchall()]

        # Genomic mutations
        cur.execute("""
            SELECT m.measurement_concept_id, m.value_as_concept_id, m.value_source_value
            FROM pancreas.measurement m
            WHERE m.person_id = %s AND m.measurement_concept_id IN (3012200, 3009106, 1988360, 3026497)
        """, (person_id,))
        mutations = {}
        for concept_id, value_concept, value_source in cur.fetchall():
            gene = GENE_CONCEPTS.get(concept_id, "Unknown")
            if value_concept == PRESENT:
                mutations[gene] = value_source or "mutated"
            else:
                mutations[gene] = "wild-type"

        # Labs at diagnosis (closest to dx_date)
        cur.execute("""
            SELECT c.concept_name, m.value_as_number
            FROM pancreas.measurement m
            JOIN vocab.concept c ON m.measurement_concept_id = c.concept_id
            WHERE m.person_id = %s
              AND m.measurement_concept_id NOT IN (3012200, 3009106, 1988360, 3026497)
              AND m.measurement_date = (
                  SELECT MIN(m2.measurement_date) FROM pancreas.measurement m2
                  WHERE m2.person_id = %s AND m2.measurement_concept_id = m.measurement_concept_id
              )
        """, (person_id, person_id))
        labs = {r[0]: r[1] for r in cur.fetchall()}

        # Death
        cur.execute("SELECT death_date FROM pancreas.death WHERE person_id = %s", (person_id,))
        death_row = cur.fetchone()
        is_dead = death_row is not None
        survival_days = (death_row[0] - dx_date).days if death_row else 730

        # Visits
        cur.execute("""
            SELECT visit_occurrence_id, visit_start_date, visit_concept_id, visit_source_value
            FROM pancreas.visit_occurrence WHERE person_id = %s ORDER BY visit_start_date
        """, (person_id,))
        visits = [{"id": r[0], "date": r[1], "concept": r[2], "source": r[3]} for r in cur.fetchall()]

        # Infer subgroup and tumor location
        has_surgery = any("pancreatectomy" in p.lower() or "pancreaticoduodenectomy" in p.lower() for p in procedures)
        has_neoadj = any("Neoadjuvant" in v["source"] or "Induction" in v["source"] for v in visits)
        has_2nd_line = any("2nd-line" in v["source"] for v in visits)

        if has_surgery and not has_neoadj:
            subgroup = "resectable (upfront surgery)"
        elif has_surgery and has_neoadj:
            subgroup = "borderline resectable (neoadjuvant then surgery)"
        elif has_neoadj and not has_surgery:
            subgroup = "locally advanced (induction chemo, not resected)"
        elif has_2nd_line:
            subgroup = "metastatic (multi-line chemotherapy)"
        else:
            subgroup = "metastatic"

        tumor_loc = "head" if any("Pancreaticoduodenectomy" in p for p in procedures) else "body/tail" if procedures else "head"

        contexts.append(PatientContext(
            person_id=person_id, age=age, sex=sex, source_value=source_val,
            diagnosis_date=dx_date, conditions=conditions, medications=medications,
            procedures=procedures, mutations=mutations, labs_at_dx=labs,
            subgroup=subgroup, tumor_location=tumor_loc, is_dead=is_dead,
            survival_days=survival_days, visits=visits,
        ))

    cur.close()
    conn.close()
    return contexts


def generate_note(system_prompt: str, patient_data: str) -> str:
    """Call MedGemma to generate a clinical note."""
    prompt = f"{system_prompt}\n\nPatient Data:\n{patient_data}\n\nWrite the clinical note now:"

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.7, "num_predict": 1024},
        }, timeout=60)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except Exception as e:
        print(f"    MedGemma error: {e}")
        return ""


SYSTEM_PROMPTS = {
    "consultation": (
        "You are a medical oncologist writing an initial consultation note for a patient "
        "newly diagnosed with pancreatic ductal adenocarcinoma. Write a realistic clinical note with sections: "
        "CHIEF COMPLAINT, HISTORY OF PRESENT ILLNESS, PAST MEDICAL HISTORY, MEDICATIONS, "
        "REVIEW OF SYSTEMS, PHYSICAL EXAMINATION, ASSESSMENT AND PLAN. "
        "Use the provided patient data. Write in standard clinical documentation style — "
        "concise, professional, use medical abbreviations where appropriate. "
        "Do not include patient name or MRN. Do not add disclaimers."
    ),
    "pathology": (
        "You are a pathologist writing a surgical pathology report for a pancreatic specimen. "
        "Write a realistic pathology report with sections: SPECIMEN, GROSS DESCRIPTION, "
        "MICROSCOPIC DESCRIPTION, DIAGNOSIS, PATHOLOGIC STAGING (if surgical specimen). "
        "Use the provided patient data. Be specific about margins, lymph nodes, "
        "differentiation grade. Write in standard pathology report style."
    ),
    "operative": (
        "You are a hepatobiliary surgeon writing an operative note. "
        "Write a realistic operative note with sections: PREOPERATIVE DIAGNOSIS, "
        "POSTOPERATIVE DIAGNOSIS, PROCEDURE PERFORMED, SURGEON, ANESTHESIA, "
        "FINDINGS, TECHNIQUE, ESTIMATED BLOOD LOSS, SPECIMENS, COMPLICATIONS, DISPOSITION. "
        "Use the provided patient data. Be specific about anatomy and technique."
    ),
    "progress": (
        "You are a medical oncologist writing a progress note during chemotherapy treatment. "
        "Write a realistic progress note with sections: INTERVAL HISTORY, "
        "CURRENT REGIMEN AND CYCLE, TOXICITIES, LABORATORY REVIEW, "
        "PHYSICAL EXAMINATION, ASSESSMENT AND PLAN. "
        "Use the provided patient data. Include specific lab values and toxicity grading."
    ),
}


def build_patient_data_str(ctx: PatientContext) -> str:
    """Build structured patient data string for the LLM prompt."""
    labs_str = ", ".join(f"{k}: {v}" for k, v in sorted(ctx.labs_at_dx.items())) or "pending"
    muts_str = ", ".join(f"{g}: {v}" for g, v in sorted(ctx.mutations.items())) or "pending"
    meds_str = ", ".join(ctx.medications) or "none"
    conds_str = ", ".join(c for c in ctx.conditions if c != "Malignant tumor of pancreas") or "none"

    return (
        f"Age: {ctx.age}, Sex: {ctx.sex}\n"
        f"Diagnosis: Pancreatic ductal adenocarcinoma, {ctx.tumor_location} of pancreas\n"
        f"Clinical stage: {ctx.subgroup}\n"
        f"Diagnosis date: {ctx.diagnosis_date}\n"
        f"Comorbidities: {conds_str}\n"
        f"Medications: {meds_str}\n"
        f"Laboratory values: {labs_str}\n"
        f"Molecular profile: {muts_str}\n"
        f"Procedures: {', '.join(ctx.procedures) or 'none yet'}\n"
        f"Outcome: {'Deceased at {0} days'.format(ctx.survival_days) if ctx.is_dead else 'Alive at last follow-up'}"
    )


def main() -> None:
    force = "--force" in sys.argv

    print("Loading patient contexts...")
    contexts = load_patient_contexts()
    print(f"  {len(contexts)} patients loaded")

    conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER)
    cur = conn.cursor()

    if force:
        cur.execute("DELETE FROM pancreas.note WHERE note_source_value = 'medgemma-generated'")
        conn.commit()
        print("  Cleared existing generated notes (--force)")

    # Get current max note_id
    cur.execute("SELECT COALESCE(MAX(note_id), 0) FROM pancreas.note")
    note_id = cur.fetchone()[0] + 1

    # Check existing notes for resume
    cur.execute("""
        SELECT person_id, note_class_concept_id FROM pancreas.note
        WHERE note_source_value = 'medgemma-generated'
    """)
    existing = {(r[0], r[1]) for r in cur.fetchall()}

    total_generated = 0
    total_skipped = 0
    start_time = time.time()

    for i, ctx in enumerate(contexts):
        patient_data = build_patient_data_str(ctx)

        # Define which notes to generate for this patient
        notes_to_generate = [
            {
                "title": "Initial Oncology Consultation",
                "type_concept": EHR_NOTE,
                "class_concept": OUTPATIENT_NOTE_CLASS,
                "system": SYSTEM_PROMPTS["consultation"],
                "visit_idx": 0,  # First visit (diagnostic workup)
            },
            {
                "title": "Surgical Pathology Report",
                "type_concept": EHR_PATHOLOGY_REPORT,
                "class_concept": PATHOLOGY_REPORT_CLASS,
                "system": SYSTEM_PROMPTS["pathology"],
                "visit_idx": 0,
            },
            {
                "title": "Treatment Progress Note",
                "type_concept": EHR_OUTPATIENT_NOTE,
                "class_concept": OUTPATIENT_NOTE_CLASS,
                "system": SYSTEM_PROMPTS["progress"],
                "visit_idx": next(
                    (j for j, v in enumerate(ctx.visits) if "chemo" in v["source"].lower() or "1st-line" in v["source"].lower()),
                    2,  # default to 3rd visit
                ),
            },
        ]

        # Add operative note for surgical patients
        surgery_idx = next(
            (j for j, v in enumerate(ctx.visits) if v["concept"] == 9201),  # Inpatient = surgery
            None,
        )
        if surgery_idx is not None:
            notes_to_generate.append({
                "title": "Operative Note",
                "type_concept": EHR_NOTE,
                "class_concept": INPATIENT_NOTE_CLASS,
                "system": SYSTEM_PROMPTS["operative"],
                "visit_idx": surgery_idx,
            })

        for note_def in notes_to_generate:
            class_concept = note_def["class_concept"]

            # Skip if already exists
            if (ctx.person_id, class_concept) in existing:
                total_skipped += 1
                continue

            visit_idx = min(note_def["visit_idx"], len(ctx.visits) - 1)
            if visit_idx < 0 or not ctx.visits:
                continue

            visit = ctx.visits[visit_idx]

            # Generate note text
            note_text = generate_note(note_def["system"], patient_data)
            if not note_text or len(note_text.split()) < 50:
                print(f"    Warning: Short/empty note for person {ctx.person_id} ({note_def['title']}), retrying...")
                note_text = generate_note(note_def["system"], patient_data)

            if not note_text:
                continue

            cur.execute("""
                INSERT INTO pancreas.note
                (note_id, person_id, note_date, note_datetime,
                 note_type_concept_id, note_class_concept_id, note_title, note_text,
                 encoding_concept_id, language_concept_id, provider_id,
                 visit_occurrence_id, visit_detail_id, note_source_value,
                 note_event_id, note_event_field_concept_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, %s, NULL, %s, NULL, %s, NULL, NULL)
            """, (
                note_id, ctx.person_id, visit["date"],
                f"{visit['date']} 12:00:00",
                note_def["type_concept"], class_concept,
                note_def["title"], note_text,
                ENGLISH, visit["id"], "medgemma-generated",
            ))
            note_id += 1
            total_generated += 1

            # Commit every 10 notes
            if total_generated % 10 == 0:
                conn.commit()

        # Progress
        elapsed = time.time() - start_time
        if (i + 1) % 20 == 0 or i == 0:
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(contexts) - i - 1) / rate if rate > 0 else 0
            print(f"  [{i+1}/{len(contexts)}] {total_generated} generated, {total_skipped} skipped, "
                  f"ETA: {remaining/60:.0f}min")

    conn.commit()
    cur.close()
    conn.close()

    elapsed = time.time() - start_time
    print(f"\nDone: {total_generated} notes generated, {total_skipped} skipped in {elapsed/60:.1f}min")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the note generation**

Run:
```bash
python3 scripts/pancreatic/generate_notes.py
```

This will take ~40-100 minutes. Progress is printed every 20 patients. The script is resumable — if interrupted, re-run and it skips existing notes.

Expected: ~1,260 notes generated.

- [ ] **Step 3: Verify notes**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT note_title, count(*), avg(length(note_text))::int as avg_chars
FROM pancreas.note
WHERE note_source_value = 'medgemma-generated'
GROUP BY note_title ORDER BY 1;"
```

Expected: 4 note types, average 1,500-4,000 chars each.

Spot-check a note:
```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT note_title, LEFT(note_text, 500)
FROM pancreas.note WHERE person_id = 1 AND note_title = 'Initial Oncology Consultation';"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/pancreatic/generate_notes.py
git commit -m "feat(pancreas): LLM-generated clinical notes via MedGemma"
```

---

## Task 5: Update Cohort Definitions and Re-run Achilles

**Files:**
- Modify: `backend/app/Console/Commands/SeedPancreasCohortDefinitionsCommand.php`

- [ ] **Step 1: Add 5th cohort definition — KRAS Mutant PDAC**

Add to the `getCohortDefinitions()` array:

```php
[
    'name' => 'KRAS Mutant PDAC',
    'description' => 'PDAC patients with detected KRAS somatic mutation. Demonstrates genomic measurement-based phenotyping.',
    'author_id' => $adminId,
    'is_public' => true,
    'version' => 1,
    'tags' => ['pancreatic-cancer', 'pdac', 'kras', 'genomics', 'corpus'],
    'expression_json' => [
        'ConceptSets' => [
            [
                'id' => 0,
                'name' => 'Pancreatic Cancer',
                'expression' => [
                    'items' => [
                        $this->conceptItem(4180793, 'Malignant tumor of pancreas', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                    ],
                ],
            ],
            [
                'id' => 1,
                'name' => 'KRAS Mutation Analysis',
                'expression' => ['items' => [
                    $this->conceptItem(3012200, 'KRAS gene mutations found [Identifier] in Blood or Tissue by Molecular genetics method', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                ]],
            ],
        ],
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
            ],
            'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
        ],
        'AdditionalCriteria' => [
            'Type' => 'ALL',
            'CriteriaList' => [
                [
                    'Criteria' => [
                        'Measurement' => [
                            'CodesetId' => 1,
                            'ValueAsConcept' => [['CONCEPT_ID' => 4181412, 'CONCEPT_NAME' => 'Present']],
                        ],
                    ],
                    'StartWindow' => [
                        'Start' => ['Days' => 365, 'Coeff' => -1],
                        'End' => ['Days' => 365, 'Coeff' => 1],
                    ],
                    'Occurrence' => ['Type' => 2, 'Count' => 1],
                ],
            ],
            'Groups' => [],
        ],
        'QualifiedLimit' => ['Type' => 'First'],
        'ExpressionLimit' => ['Type' => 'First'],
        'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
    ],
    '_membership_key' => 'kras_mutant',
],
```

Add the membership SQL in `getMembershipSql()`:

```php
'kras_mutant' => "
    INSERT INTO pancreas_results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
    SELECT DISTINCT
        {$cohortId},
        co.person_id,
        MIN(co.condition_start_date) OVER (PARTITION BY co.person_id),
        COALESCE(
            MAX(co.condition_end_date) OVER (PARTITION BY co.person_id),
            MIN(co.condition_start_date) OVER (PARTITION BY co.person_id) + INTERVAL '365 days'
        )
    FROM pancreas.condition_occurrence co
    JOIN pancreas.measurement m ON co.person_id = m.person_id
        AND m.measurement_concept_id = 3012200
        AND m.value_as_concept_id = 4181412
    WHERE co.condition_concept_id = 4180793
",
```

- [ ] **Step 2: Run Pint and re-run the seeder**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/SeedPancreasCohortDefinitionsCommand.php"
docker compose exec php php artisan pancreas:seed-cohorts
```

Expected: 5 cohorts, KRAS Mutant with ~93% of corpus.

- [ ] **Step 3: Re-index Solr**

```bash
docker compose exec php php artisan solr:index-cohorts
```

- [ ] **Step 4: Re-run Achilles**

```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acumenus.net","password":"superuser"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s -X POST "http://localhost:8082/api/v1/sources/58/achilles/run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

Wait ~60s, then verify:
```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT status, completed_analyses, failed_analyses
FROM app.achilles_runs WHERE source_id = 58
ORDER BY started_at DESC LIMIT 1;"
```

Expected: `completed | 128 | 0`

- [ ] **Step 5: Commit and push**

```bash
git add \
  backend/app/Console/Commands/SeedPancreasCohortDefinitionsCommand.php \
  scripts/pancreatic/enrich_genomics.py \
  scripts/pancreatic/link_dicom.py \
  scripts/pancreatic/generate_notes.py \
  scripts/pancreatic/enrich_cdm.py \
  scripts/pancreatic/create_schema.sql \
  docs/superpowers/specs/2026-03-28-pancreas-full-enrichment-design.md \
  docs/superpowers/plans/2026-03-28-pancreas-full-enrichment.md

git commit -m "feat(pancreas): full multimodal enrichment — TCGA-PAAD, DICOM linkage, genomics, clinical notes, KRAS cohort"
git push
```

---

## Task 6: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify complete patient coverage**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
-- Every patient should have: visits, conditions, measurements, drugs, specimens, obs_period
SELECT
  (SELECT count(*) FROM pancreas.person) as persons,
  (SELECT count(DISTINCT person_id) FROM pancreas.visit_occurrence) as with_visits,
  (SELECT count(DISTINCT person_id) FROM pancreas.condition_occurrence) as with_conditions,
  (SELECT count(DISTINCT person_id) FROM pancreas.measurement) as with_measurements,
  (SELECT count(DISTINCT person_id) FROM pancreas.drug_exposure) as with_drugs,
  (SELECT count(DISTINCT person_id) FROM pancreas.specimen) as with_specimens,
  (SELECT count(DISTINCT person_id) FROM pancreas.observation_period) as with_obs_period,
  (SELECT count(DISTINCT person_id) FROM pancreas.note WHERE note_source_value = 'medgemma-generated') as with_notes,
  (SELECT count(DISTINCT person_id) FROM pancreas.measurement WHERE measurement_concept_id IN (3012200, 3009106, 1988360, 3026497)) as with_genomics;"
```

Expected: All columns should equal the total person count (~361).

- [ ] **Step 2: Verify DICOM linkage**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT modality, count(*) as studies, count(DISTINCT person_id) as patients
FROM app.imaging_studies WHERE source_id = 58
GROUP BY modality;"
```

- [ ] **Step 3: Verify cohort membership**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT cd.name, count(c.subject_id) as enrolled
FROM app.cohort_definitions cd
LEFT JOIN pancreas_results.cohort c ON cd.id = c.cohort_definition_id
WHERE cd.tags::jsonb @> '[\"corpus\"]'::jsonb
GROUP BY cd.name ORDER BY cd.name;"
```

Expected: 5 cohorts, all with enrollment counts proportional to ~361 patients.

- [ ] **Step 4: Verify data quality**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT 'visits_outside_obs' as chk, count(*) FROM pancreas.visit_occurrence v
LEFT JOIN pancreas.observation_period op ON v.person_id = op.person_id
  AND v.visit_start_date BETWEEN op.observation_period_start_date AND op.observation_period_end_date
WHERE op.person_id IS NULL

UNION ALL SELECT 'invalid_concepts', count(*) FROM pancreas.condition_occurrence co
LEFT JOIN vocab.concept c ON co.condition_concept_id = c.concept_id AND c.standard_concept = 'S'
WHERE c.concept_id IS NULL AND co.condition_concept_id != 0

UNION ALL SELECT 'notes_without_visit', count(*) FROM pancreas.note
WHERE visit_occurrence_id IS NULL AND note_source_value = 'medgemma-generated'

UNION ALL SELECT 'genomics_without_visit', count(*) FROM pancreas.measurement
WHERE measurement_concept_id IN (3012200, 3009106, 1988360, 3026497) AND visit_occurrence_id IS NULL;"
```

Expected: All zeros.
