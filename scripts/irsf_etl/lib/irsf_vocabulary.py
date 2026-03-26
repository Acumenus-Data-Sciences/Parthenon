"""IRSF-NHS custom vocabulary registry for OMOP CDM.

Defines all ~117 custom concepts for the IRSF Natural History Study ETL:
- CSS (Clinical Severity Scale): 14 concepts (1 total + 13 items)
- MBA (Motor Behavioral Assessment): 41 concepts (1 grand total + 3 subtotals + 37 items)
- Mutations: 48 concepts (MECP2/CDKL5/FOXG1 boolean columns)
- Diagnoses: 14 concepts (Rett diagnostic categories)

All concept_ids are in the >= 2,000,000,000 range per OHDSI custom vocabulary convention.
"""

from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ConceptDefinition:
    """Immutable definition of a single OMOP custom concept."""

    concept_id: int
    concept_name: str
    domain_id: str
    vocabulary_id: str
    concept_class_id: str
    standard_concept: str
    concept_code: str
    source_column: str | None = None
    source_value: str | None = None


# ---------------------------------------------------------------------------
# Concept definitions
# ---------------------------------------------------------------------------

_CSS_CONCEPTS: tuple[ConceptDefinition, ...] = (
    ConceptDefinition(
        concept_id=2_000_001_000,
        concept_name="IRSF CSS Total Score",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-TOTAL",
        source_column="TotalScore",
    ),
    ConceptDefinition(
        concept_id=2_000_001_001,
        concept_name="IRSF CSS Age of Onset of Regression",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-001",
        source_column="AgeOfOnsetOfRegression",
    ),
    ConceptDefinition(
        concept_id=2_000_001_002,
        concept_name="IRSF CSS Onset of Stereotypes",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-002",
        source_column="OnsetOfStereotypes",
    ),
    ConceptDefinition(
        concept_id=2_000_001_003,
        concept_name="IRSF CSS Head Growth",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-003",
        source_column="HeadGrowth",
    ),
    ConceptDefinition(
        concept_id=2_000_001_004,
        concept_name="IRSF CSS Somatic Growth",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-004",
        source_column="SomaticGrowthAtThisVisit",
    ),
    ConceptDefinition(
        concept_id=2_000_001_005,
        concept_name="IRSF CSS Independent Sitting",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-005",
        source_column="IndependentSittingAtThisVisitB",
    ),
    ConceptDefinition(
        concept_id=2_000_001_006,
        concept_name="IRSF CSS Ambulation",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-006",
        source_column="AmbulationAtThisVisitByExam",
    ),
    ConceptDefinition(
        concept_id=2_000_001_007,
        concept_name="IRSF CSS Hand Use",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-007",
        source_column="HandUse",
    ),
    ConceptDefinition(
        concept_id=2_000_001_008,
        concept_name="IRSF CSS Scoliosis",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-008",
        source_column="Scoliosis",
    ),
    ConceptDefinition(
        concept_id=2_000_001_009,
        concept_name="IRSF CSS Language",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-009",
        source_column="LanguageAtThisVisitByExam",
    ),
    ConceptDefinition(
        concept_id=2_000_001_010,
        concept_name="IRSF CSS Nonverbal Communication",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-010",
        source_column="NonverbalCommunicationAtThisVi",
    ),
    ConceptDefinition(
        concept_id=2_000_001_011,
        concept_name="IRSF CSS Respiratory Dysfunction",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-011",
        source_column="RespiratoryDysfunctionAtThisVi",
    ),
    ConceptDefinition(
        concept_id=2_000_001_012,
        concept_name="IRSF CSS Autonomic Symptoms",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-012",
        source_column="AutonomicSymptomsAtThisVisitBy",
    ),
    ConceptDefinition(
        concept_id=2_000_001_013,
        concept_name="IRSF CSS Epilepsy/Seizures",
        domain_id="Measurement",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-CSS-013",
        source_column="EpilepsySeizuresAtThisVisit",
    ),
)

# MBA Section 1: Behavioral/Social (16 items + Subtotal1)
# MBA Section 2: Orofacial/Respiratory (7 items + SubTotal2)
# MBA Section 3: Motor/Physical (14 items + Subtotal3 + GrandTotal)
# Total: 37 individual items + 3 subtotals + 1 grand total = 41

_MBA_CONCEPTS: tuple[ConceptDefinition, ...] = (
    # Grand total
    ConceptDefinition(
        concept_id=2_000_002_000,
        concept_name="IRSF MBA Grand Total",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-GRAND",
        source_column="GrandTotal",
    ),
    # Subtotals
    ConceptDefinition(
        concept_id=2_000_002_001,
        concept_name="IRSF MBA Behavioral/Social Subtotal",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-SUB1",
        source_column="Subtotal1",
    ),
    ConceptDefinition(
        concept_id=2_000_002_002,
        concept_name="IRSF MBA Orofacial/Respiratory Subtotal",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-SUB2",
        source_column="SubTotal2",
    ),
    ConceptDefinition(
        concept_id=2_000_002_003,
        concept_name="IRSF MBA Motor/Physical Subtotal",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-SUB3",
        source_column="Subtotal3",
    ),
    # Section 1: Behavioral/Social (16 items)
    ConceptDefinition(
        concept_id=2_000_002_004,
        concept_name="IRSF MBA Motor Skills Regression",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-001",
        source_column="MotorSkillsRegression",
    ),
    ConceptDefinition(
        concept_id=2_000_002_005,
        concept_name="IRSF MBA Verbal Skills Regression",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-002",
        source_column="VerbalSkillsRegression",
    ),
    ConceptDefinition(
        concept_id=2_000_002_006,
        concept_name="IRSF MBA Poor Eye/Social Contact",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-003",
        source_column="PoorEyeSocialContact",
    ),
    ConceptDefinition(
        concept_id=2_000_002_007,
        concept_name="IRSF MBA Lack of Sustained Interest",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-004",
        source_column="LackOfSustainedInterest",
    ),
    ConceptDefinition(
        concept_id=2_000_002_008,
        concept_name="IRSF MBA Irritability/Crying/Tantrums",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-005",
        source_column="IrritabilityCryingTantrums",
    ),
    ConceptDefinition(
        concept_id=2_000_002_009,
        concept_name="IRSF MBA Over-active or Over-passive",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-006",
        source_column="OverActiveOverPassive",
    ),
    ConceptDefinition(
        concept_id=2_000_002_010,
        concept_name="IRSF MBA Does Not Reach for Objects/People",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-007",
        source_column="DoesNotReachObjectsPeople",
    ),
    ConceptDefinition(
        concept_id=2_000_002_011,
        concept_name="IRSF MBA Does Not Follow Verbal Acts/Appears Deaf",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-008",
        source_column="DoesNotFollowVerbalActsDeaf",
    ),
    ConceptDefinition(
        concept_id=2_000_002_012,
        concept_name="IRSF MBA Feeding Difficulties",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-009",
        source_column="FeedingDifficulties",
    ),
    ConceptDefinition(
        concept_id=2_000_002_013,
        concept_name="IRSF MBA Chewing Difficulties",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-010",
        source_column="ChewingDifficulties",
    ),
    ConceptDefinition(
        concept_id=2_000_002_014,
        concept_name="IRSF MBA Lack of Toilet Training",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-011",
        source_column="LackToiletTraining",
    ),
    ConceptDefinition(
        concept_id=2_000_002_015,
        concept_name="IRSF MBA Masturbation",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-012",
        source_column="Masturbation",
    ),
    ConceptDefinition(
        concept_id=2_000_002_016,
        concept_name="IRSF MBA Self-Mutilating/Scratching",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-013",
        source_column="SelfMutilatingScratching",
    ),
    ConceptDefinition(
        concept_id=2_000_002_017,
        concept_name="IRSF MBA Aggressive Behavior",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-014",
        source_column="AggressiveBehavior",
    ),
    ConceptDefinition(
        concept_id=2_000_002_018,
        concept_name="IRSF MBA Seizures",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-015",
        source_column="Seizures",
    ),
    ConceptDefinition(
        concept_id=2_000_002_019,
        concept_name="IRSF MBA Apparent Insensitivity to Pain",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-016",
        source_column="ApparentInsensitivityToPain",
    ),
    # Section 2: Orofacial/Respiratory (7 items)
    ConceptDefinition(
        concept_id=2_000_002_020,
        concept_name="IRSF MBA Speech Disturbance",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-017",
        source_column="SpeechDisturbance",
    ),
    ConceptDefinition(
        concept_id=2_000_002_021,
        concept_name="IRSF MBA Bruxism",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-018",
        source_column="Bruxism",
    ),
    ConceptDefinition(
        concept_id=2_000_002_022,
        concept_name="IRSF MBA Breath Holding",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-019",
        source_column="BreathHolding",
    ),
    ConceptDefinition(
        concept_id=2_000_002_023,
        concept_name="IRSF MBA Hyperventilation",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-020",
        source_column="Hyperventilation",
    ),
    ConceptDefinition(
        concept_id=2_000_002_024,
        concept_name="IRSF MBA Air/Saliva Expulsion",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-021",
        source_column="AirSalivaExpulsion",
    ),
    ConceptDefinition(
        concept_id=2_000_002_025,
        concept_name="IRSF MBA Mouthing Hands/Objects",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-022",
        source_column="MouthingHandsObjects",
    ),
    ConceptDefinition(
        concept_id=2_000_002_026,
        concept_name="IRSF MBA Biting Self/Others",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-023",
        source_column="BitingSelfOthers",
    ),
    # Section 3: Motor/Physical (14 items)
    ConceptDefinition(
        concept_id=2_000_002_027,
        concept_name="IRSF MBA Hand Clumsiness",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-024",
        source_column="HandClumsiness",
    ),
    ConceptDefinition(
        concept_id=2_000_002_028,
        concept_name="IRSF MBA Stereotypic Hand Activities",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-025",
        source_column="StereotypicHandActivities",
    ),
    ConceptDefinition(
        concept_id=2_000_002_029,
        concept_name="IRSF MBA Ataxia/Apraxia",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-026",
        source_column="AtaxiaApraxia",
    ),
    ConceptDefinition(
        concept_id=2_000_002_030,
        concept_name="IRSF MBA Truncal Rocking/Shifting Weight",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-027",
        source_column="TruncalRockingShiftingWeight",
    ),
    ConceptDefinition(
        concept_id=2_000_002_031,
        concept_name="IRSF MBA Oculogyric Movements",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-028",
        source_column="OculogyricMovements",
    ),
    ConceptDefinition(
        concept_id=2_000_002_032,
        concept_name="IRSF MBA Bradykinesia",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-029",
        source_column="Bradykinesia",
    ),
    ConceptDefinition(
        concept_id=2_000_002_033,
        concept_name="IRSF MBA Dystonia",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-030",
        source_column="Dystonia",
    ),
    ConceptDefinition(
        concept_id=2_000_002_034,
        concept_name="IRSF MBA Hypomimia",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-031",
        source_column="Hypomimia",
    ),
    ConceptDefinition(
        concept_id=2_000_002_035,
        concept_name="IRSF MBA Scoliosis",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-032",
        source_column="Scoliosis_MBA",
    ),
    ConceptDefinition(
        concept_id=2_000_002_036,
        concept_name="IRSF MBA Myoclonus",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-033",
        source_column="Myoclonus",
    ),
    ConceptDefinition(
        concept_id=2_000_002_037,
        concept_name="IRSF MBA Chorea/Athetosis",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-034",
        source_column="ChoreaAthetosis",
    ),
    ConceptDefinition(
        concept_id=2_000_002_038,
        concept_name="IRSF MBA Hypertonia/Rigidity",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-035",
        source_column="HypertoniaRigidity",
    ),
    ConceptDefinition(
        concept_id=2_000_002_039,
        concept_name="IRSF MBA Hyperreflexia",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-036",
        source_column="Hyperreflexia",
    ),
    ConceptDefinition(
        concept_id=2_000_002_040,
        concept_name="IRSF MBA Vasomotor Disturbance",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Observation",
        standard_concept="S",
        concept_code="IRSF-MBA-037",
        source_column="VasomotorDisturbance",
    ),
)

# Mutation concepts: 48 boolean columns from Person_Characteristics
# Block: 2,000,003,000 - 2,000,003,099

_MUTATION_CONCEPTS: tuple[ConceptDefinition, ...] = (
    # MECP2 Missense mutations (11)
    ConceptDefinition(
        concept_id=2_000_003_000,
        concept_name="IRSF MECP2 Mutation R106W (c.C316T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-001",
        source_column="CommonMECP2Mutations_C316TR106W",
    ),
    ConceptDefinition(
        concept_id=2_000_003_001,
        concept_name="IRSF MECP2 Mutation R133C (c.C397T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-002",
        source_column="CommonMECP2Mutations_C397TR133C",
    ),
    ConceptDefinition(
        concept_id=2_000_003_002,
        concept_name="IRSF MECP2 Mutation T158M (c.C473T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-003",
        source_column="CommonMECP2Mutations_C473TT158M",
    ),
    ConceptDefinition(
        concept_id=2_000_003_003,
        concept_name="IRSF MECP2 Mutation L100V (c.C298G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-004",
        source_column="CommonMECP2Mutations_C298GL100V",
    ),
    ConceptDefinition(
        concept_id=2_000_003_004,
        concept_name="IRSF MECP2 Mutation R106Q (c.G317A)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-005",
        source_column="CommonMECP2Mutations_G317AR106Q",
    ),
    ConceptDefinition(
        concept_id=2_000_003_005,
        concept_name="IRSF MECP2 Mutation P152R (c.C455G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-006",
        source_column="CommonMECP2Mutations_C455GP152R",
    ),
    ConceptDefinition(
        concept_id=2_000_003_006,
        concept_name="IRSF MECP2 Mutation P101R (c.C302G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-007",
        source_column="CommonMECP2Mutations_C302GP101R",
    ),
    ConceptDefinition(
        concept_id=2_000_003_007,
        concept_name="IRSF MECP2 Mutation S134C (c.C401G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-008",
        source_column="CommonMECP2Mutations_C401GS134C",
    ),
    ConceptDefinition(
        concept_id=2_000_003_008,
        concept_name="IRSF MECP2 Mutation D156E (c.C468G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-009",
        source_column="CommonMECP2Mutations_C468GD156E",
    ),
    ConceptDefinition(
        concept_id=2_000_003_009,
        concept_name="IRSF MECP2 Mutation P225R (c.C674G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-010",
        source_column="CommonMECP2Mutations_C674GP225R",
    ),
    ConceptDefinition(
        concept_id=2_000_003_010,
        concept_name="IRSF MECP2 Mutation P322L (c.C965T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-011",
        source_column="CommonMECP2Mutations_C965TP322L",
    ),
    # MECP2 Nonsense/Truncating mutations (6)
    ConceptDefinition(
        concept_id=2_000_003_011,
        concept_name="IRSF MECP2 Mutation R168X (c.C502T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-012",
        source_column="CommonMECP2Mutations_C502TR168X",
    ),
    ConceptDefinition(
        concept_id=2_000_003_012,
        concept_name="IRSF MECP2 Mutation R255X (c.C763T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-013",
        source_column="CommonMECP2Mutations_C763TR255X",
    ),
    ConceptDefinition(
        concept_id=2_000_003_013,
        concept_name="IRSF MECP2 Mutation R270X (c.C808T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-014",
        source_column="CommonMECP2Mutations_C808TR270X",
    ),
    ConceptDefinition(
        concept_id=2_000_003_014,
        concept_name="IRSF MECP2 Mutation R294X (c.C880T)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-015",
        source_column="CommonMECP2Mutations_C880TR294X",
    ),
    ConceptDefinition(
        concept_id=2_000_003_015,
        concept_name="IRSF MECP2 Mutation Y141X (c.C421G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-016",
        source_column="CommonMECP2Mutations_C421GY141X",
    ),
    ConceptDefinition(
        concept_id=2_000_003_016,
        concept_name="IRSF MECP2 Mutation Y141X (c.C423G)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-017",
        source_column="CommonMECP2Mutations_C423GY141X",
    ),
    # MECP2 Small Deletions (9)
    ConceptDefinition(
        concept_id=2_000_003_017,
        concept_name="IRSF MECP2 Deletion 710del1",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-001",
        source_column="CommonMECP2Deletions_710del1",
    ),
    ConceptDefinition(
        concept_id=2_000_003_018,
        concept_name="IRSF MECP2 Deletion 1157del41",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-002",
        source_column="CommonMECP2Deletions_1157del41",
    ),
    ConceptDefinition(
        concept_id=2_000_003_019,
        concept_name="IRSF MECP2 Deletion 1163del35",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-003",
        source_column="CommonMECP2Deletions_1163del35",
    ),
    ConceptDefinition(
        concept_id=2_000_003_020,
        concept_name="IRSF MECP2 Deletion 806del1",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-004",
        source_column="CommonMECP2Deletions_806del1",
    ),
    ConceptDefinition(
        concept_id=2_000_003_021,
        concept_name="IRSF MECP2 Deletion 1157del44",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-005",
        source_column="CommonMECP2Deletions_1157del44",
    ),
    ConceptDefinition(
        concept_id=2_000_003_022,
        concept_name="IRSF MECP2 Deletion 1164del44",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-006",
        source_column="CommonMECP2Deletions_1164del44",
    ),
    ConceptDefinition(
        concept_id=2_000_003_023,
        concept_name="IRSF MECP2 Deletion 807del1",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-007",
        source_column="CommonMECP2Deletions_807del1",
    ),
    ConceptDefinition(
        concept_id=2_000_003_024,
        concept_name="IRSF MECP2 Deletion 1163del26",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-008",
        source_column="CommonMECP2Deletions_1163del26",
    ),
    ConceptDefinition(
        concept_id=2_000_003_025,
        concept_name="IRSF MECP2 Deletion 1168del6",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DEL-009",
        source_column="CommonMECP2Deletions_1168del6",
    ),
    # MECP2 Large Deletions (5)
    ConceptDefinition(
        concept_id=2_000_003_026,
        concept_name="IRSF MECP2 Large Deletion Exon 1-2",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-LDEL-001",
        source_column="MECP2LargeDeletions_Exon12",
    ),
    ConceptDefinition(
        concept_id=2_000_003_027,
        concept_name="IRSF MECP2 Large Deletion Exon 3",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-LDEL-002",
        source_column="MECP2LargeDeletions_Exon3",
    ),
    ConceptDefinition(
        concept_id=2_000_003_028,
        concept_name="IRSF MECP2 Large Deletion Exon 3-4",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-LDEL-003",
        source_column="MECP2LargeDeletions_Exon34",
    ),
    ConceptDefinition(
        concept_id=2_000_003_029,
        concept_name="IRSF MECP2 Large Deletion Exon 4",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-LDEL-004",
        source_column="MECP2LargeDeletions_Exon4",
    ),
    ConceptDefinition(
        concept_id=2_000_003_030,
        concept_name="IRSF MECP2 Large Deletion Exon 1-4",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-LDEL-005",
        source_column="MECP2LargeDeletions_Exon14",
    ),
    # Other MECP2 (3)
    ConceptDefinition(
        concept_id=2_000_003_031,
        concept_name="IRSF Other MCP2 Mutations (legacy column)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-OTHER-001",
        source_column="OtherMCP2Mutations",
    ),
    ConceptDefinition(
        concept_id=2_000_003_032,
        concept_name="IRSF Other MECP2 Mutations",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-OTHER-002",
        source_column="OtherMECP2Mutations",
    ),
    ConceptDefinition(
        concept_id=2_000_003_033,
        concept_name="IRSF MCP2 Duplications",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DUP-001",
        source_column="MCP2Duplications",
    ),
    # MECP2 Duplication-Associated Genes (3)
    ConceptDefinition(
        concept_id=2_000_003_034,
        concept_name="IRSF MECP2 Duplication-Associated FLNA",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DUPA-001",
        source_column="OtherMCP2Duplication_FLNA",
    ),
    ConceptDefinition(
        concept_id=2_000_003_035,
        concept_name="IRSF MECP2 Duplication-Associated L1CAM",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DUPA-002",
        source_column="OtherMCP2Duplication_L1CAM",
    ),
    ConceptDefinition(
        concept_id=2_000_003_036,
        concept_name="IRSF MECP2 Duplication-Associated IRAK1",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-MECP2-DUPA-003",
        source_column="OtherMCP2Duplication_IRAK1",
    ),
    # CDKL5 Mutations (5)
    ConceptDefinition(
        concept_id=2_000_003_037,
        concept_name="IRSF CDKL5 Mutation A40V",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-CDKL5-001",
        source_column="CDKL5Mutations_A40V",
    ),
    ConceptDefinition(
        concept_id=2_000_003_038,
        concept_name="IRSF CDKL5 Mutation R59X",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-CDKL5-002",
        source_column="CDKL5Mutations_R59X",
    ),
    ConceptDefinition(
        concept_id=2_000_003_039,
        concept_name="IRSF CDKL5 Polymorphism Q791P",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-CDKL5-003",
        source_column="CDKL5Mutations_Q791Ppolymorphism",
    ),
    ConceptDefinition(
        concept_id=2_000_003_040,
        concept_name="IRSF CDKL5 Polymorphism R952X",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-CDKL5-004",
        source_column="CDKL5Mutations_R952Xpolymorphism",
    ),
    ConceptDefinition(
        concept_id=2_000_003_041,
        concept_name="IRSF CDKL5 Other Mutation",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-CDKL5-OTHER",
        source_column="CDKL5Mutations_Other",
    ),
    # FOXG1 Mutations (4)
    ConceptDefinition(
        concept_id=2_000_003_042,
        concept_name="IRSF FOXG1 Mutation N253D",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-FOXG1-001",
        source_column="FOXG1Mutations_N253D",
    ),
    ConceptDefinition(
        concept_id=2_000_003_043,
        concept_name="IRSF FOXG1 Mutation 560dupG",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-FOXG1-002",
        source_column="FOXG1Mutations_560dupG",
    ),
    ConceptDefinition(
        concept_id=2_000_003_044,
        concept_name="IRSF FOXG1 Other Mutation (underscore variant)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-FOXG1-OTHER-001",
        source_column="FOXG1Mutations_Other",
    ),
    ConceptDefinition(
        concept_id=2_000_003_045,
        concept_name="IRSF FOXG1 Other Mutation (no underscore variant)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-FOXG1-OTHER-002",
        source_column="FOXG1MutationsOther",
    ),
    # CDKL5 Other (no underscore variant) and FOXG1 Other (no underscore) are
    # text description fields per research doc, but we still need boolean columns.
    # Research doc says 48 total. Let's reconcile:
    # MECP2 missense: 11, nonsense: 6, small del: 9, large del: 5, other: 3, dup-assoc: 3 = 37
    # CDKL5: 5, FOXG1: 4 = 9
    # 37 + 9 = 46. Need 2 more.
    # The research doc mentions CDKL5MutationsOther and FOXG1MutationsOther as text fields,
    # but also counts them in the 48. These are the no-underscore boolean variants:
    ConceptDefinition(
        concept_id=2_000_003_046,
        concept_name="IRSF CDKL5 Other Mutation (no underscore variant)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-CDKL5-OTHER-002",
        source_column="CDKL5MutationsOther",
    ),
    ConceptDefinition(
        concept_id=2_000_003_047,
        concept_name="IRSF FOXG1 Mutations Other (text description)",
        domain_id="Observation",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Observable Entity",
        standard_concept="S",
        concept_code="IRSF-MUT-FOXG1-OTHER-003",
        source_column="FOXG1MutationsOther_text",
    ),
)

# Diagnosis concepts: 14 diagnostic categories
# Block: 2,000,004,000 - 2,000,004,099

_DIAGNOSIS_CONCEPTS: tuple[ConceptDefinition, ...] = (
    ConceptDefinition(
        concept_id=2_000_004_000,
        concept_name="IRSF Classic Rett Syndrome",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-001",
        source_value="Classic",
    ),
    ConceptDefinition(
        concept_id=2_000_004_001,
        concept_name="IRSF Variant Rett Syndrome",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-002",
        source_value="Variant",
    ),
    ConceptDefinition(
        concept_id=2_000_004_002,
        concept_name="IRSF MECP2 Duplication Syndrome",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-003",
        source_value="MECP2 duplication",
    ),
    ConceptDefinition(
        concept_id=2_000_004_003,
        concept_name="IRSF CDKL5 Deficiency Disorder",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-004",
        source_value="CDKL5 disorder",
    ),
    ConceptDefinition(
        concept_id=2_000_004_004,
        concept_name="IRSF Other Non-Rett Diagnosis",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-005",
        source_value="Other Non-Rett",
    ),
    ConceptDefinition(
        concept_id=2_000_004_005,
        concept_name="IRSF MECP2 Mutation-Positive Non-Rett",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-006",
        source_value="Other MECP2 mutation-positive Non-Rett",
    ),
    ConceptDefinition(
        concept_id=2_000_004_006,
        concept_name="IRSF FOXG1 Syndrome",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-007",
        source_value="FOXG1 disorder",
    ),
    ConceptDefinition(
        concept_id=2_000_004_007,
        concept_name="IRSF Atypical Rett Syndrome - Unspecified",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-008",
        source_value="Atypical/variant unspecified Rett syndrome",
    ),
    ConceptDefinition(
        concept_id=2_000_004_008,
        concept_name="IRSF Atypical Rett - Preserved Speech Variant (Zapella)",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-009",
        source_value="Atypical Preserved Speech (Zapella) Variant",
    ),
    ConceptDefinition(
        concept_id=2_000_004_009,
        concept_name="IRSF Atypical Rett - Congenital Variant (Rolando)",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-010",
        source_value="Atypical Congenital (Rolando) Variant",
    ),
    ConceptDefinition(
        concept_id=2_000_004_010,
        concept_name="IRSF FOXG1 Duplication Syndrome",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-011",
        source_value="FOXG1 duplication",
    ),
    ConceptDefinition(
        concept_id=2_000_004_011,
        concept_name="IRSF Atypical Rett - Delayed Onset Variant",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-012",
        source_value="Atypical Delayed Onset Variant",
    ),
    ConceptDefinition(
        concept_id=2_000_004_012,
        concept_name="IRSF Atypical Rett - Early Seizure Variant (Hanefeld)",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-013",
        source_value="Atypical Early Seizure (Handfeld) Variant",
    ),
    ConceptDefinition(
        concept_id=2_000_004_013,
        concept_name="IRSF Other Mutation Diagnosis",
        domain_id="Condition",
        vocabulary_id="IRSF-NHS",
        concept_class_id="Clinical Finding",
        standard_concept="S",
        concept_code="IRSF-DX-014",
        source_value="Other (other mutations)",
    ),
)


# ---------------------------------------------------------------------------
# IrsfVocabulary registry class
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# SNOMED dual-mapping for diagnostic categories with standard equivalents
# ---------------------------------------------------------------------------

SNOMED_MAPPINGS: dict[str, int] = {
    "Classic": 4288480,  # Rett syndrome
    "Atypical/variant unspecified Rett syndrome": 37397680,  # Atypical Rett syndrome
    "MECP2 duplication": 45765797,  # MECP2 duplication syndrome
    "FOXG1 disorder": 45765499,  # FOXG1 syndrome
}


class IrsfVocabulary:
    """Authoritative registry of all IRSF-NHS custom concepts.

    All concepts are defined as module-level frozen dataclasses. This class
    provides class methods for lookup and enumeration. No instantiation needed.
    """

    VOCABULARY_ID: str = "IRSF-NHS"
    VOCABULARY_NAME: str = "IRSF Natural History Study Custom Vocabulary"
    VOCABULARY_REFERENCE: str = "https://www.rettsyndrome.org"
    VOCABULARY_VERSION: str = "1.0"
    vocabulary_concept_id: int = 2_000_000_000

    # Pre-built lookup indexes (computed once at import time)
    _source_column_index: dict[str, ConceptDefinition] = {}
    _source_value_index: dict[str, ConceptDefinition] = {}
    _concept_id_index: dict[int, ConceptDefinition] = {}

    @classmethod
    def all_concepts(cls) -> tuple[ConceptDefinition, ...]:
        """Return all 117 custom concepts as an immutable tuple."""
        return _CSS_CONCEPTS + _MBA_CONCEPTS + _MUTATION_CONCEPTS + _DIAGNOSIS_CONCEPTS

    @classmethod
    def css_concepts(cls) -> tuple[ConceptDefinition, ...]:
        """Return the 14 CSS (Clinical Severity Scale) concepts."""
        return _CSS_CONCEPTS

    @classmethod
    def mba_concepts(cls) -> tuple[ConceptDefinition, ...]:
        """Return the 41 MBA (Motor Behavioral Assessment) concepts."""
        return _MBA_CONCEPTS

    @classmethod
    def mutation_concepts(cls) -> tuple[ConceptDefinition, ...]:
        """Return the 48 mutation boolean column concepts."""
        return _MUTATION_CONCEPTS

    @classmethod
    def diagnosis_concepts(cls) -> tuple[ConceptDefinition, ...]:
        """Return the 14 Rett diagnostic category concepts."""
        return _DIAGNOSIS_CONCEPTS

    @classmethod
    def get_concept_by_source_column(cls, column_name: str) -> ConceptDefinition | None:
        """Look up a concept by its original CSV source column name."""
        if not cls._source_column_index:
            cls._build_indexes()
        return cls._source_column_index.get(column_name)

    @classmethod
    def get_diagnosis_concept(cls, diagnosis_value: str) -> ConceptDefinition | None:
        """Look up a diagnosis concept by its source value string."""
        if not cls._source_value_index:
            cls._build_indexes()
        return cls._source_value_index.get(diagnosis_value)

    @classmethod
    def get_concept_by_id(cls, concept_id: int) -> ConceptDefinition | None:
        """Look up a concept by its concept_id."""
        if not cls._concept_id_index:
            cls._build_indexes()
        return cls._concept_id_index.get(concept_id)

    @classmethod
    def _build_indexes(cls) -> None:
        """Build lookup indexes from concept tuples."""
        for concept in cls.all_concepts():
            if concept.source_column is not None:
                cls._source_column_index[concept.source_column] = concept
            if concept.source_value is not None:
                cls._source_value_index[concept.source_value] = concept
            cls._concept_id_index[concept.concept_id] = concept


# ---------------------------------------------------------------------------
# CSV generation functions
# ---------------------------------------------------------------------------


def generate_vocabulary_csv(output_dir: Path) -> Path:
    """Generate vocabulary.csv matching the omop.vocabulary table schema.

    Writes a single row for the IRSF-NHS vocabulary registration.

    Args:
        output_dir: Directory to write vocabulary.csv into.

    Returns:
        Path to the generated vocabulary.csv file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "vocabulary.csv"

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        writer.writerow([
            "vocabulary_id",
            "vocabulary_name",
            "vocabulary_reference",
            "vocabulary_version",
            "vocabulary_concept_id",
        ])
        writer.writerow([
            IrsfVocabulary.VOCABULARY_ID,
            IrsfVocabulary.VOCABULARY_NAME,
            IrsfVocabulary.VOCABULARY_REFERENCE,
            IrsfVocabulary.VOCABULARY_VERSION,
            IrsfVocabulary.vocabulary_concept_id,
        ])

    logger.info("Generated %s (1 row)", path)
    return path


def generate_concept_csv(output_dir: Path) -> Path:
    """Generate concept.csv matching the omop.concept table schema.

    Writes one row per custom concept (117 total) with OMOP CDM v5.4 columns.

    Args:
        output_dir: Directory to write concept.csv into.

    Returns:
        Path to the generated concept.csv file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "concept.csv"

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        writer.writerow([
            "concept_id",
            "concept_name",
            "domain_id",
            "vocabulary_id",
            "concept_class_id",
            "standard_concept",
            "concept_code",
            "valid_start_date",
            "valid_end_date",
            "invalid_reason",
        ])
        for concept in IrsfVocabulary.all_concepts():
            writer.writerow([
                concept.concept_id,
                concept.concept_name,
                concept.domain_id,
                concept.vocabulary_id,
                concept.concept_class_id,
                concept.standard_concept,
                concept.concept_code,
                "1970-01-01",
                "2099-12-31",
                "",  # NULL represented as empty
            ])

    logger.info("Generated %s (%d rows)", path, len(IrsfVocabulary.all_concepts()))
    return path


def generate_source_to_concept_map_csv(output_dir: Path) -> Path:
    """Generate source_to_concept_map.csv matching the OMOP table schema.

    Creates one mapping row per custom concept:
    - CSS/MBA/Mutation concepts: source_code = source_column name
    - Diagnosis concepts: source_code = source_value string
    - Diagnoses with SNOMED equivalents get an additional row targeting the
      standard SNOMED concept_id.

    Args:
        output_dir: Directory to write source_to_concept_map.csv into.

    Returns:
        Path to the generated source_to_concept_map.csv file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "source_to_concept_map.csv"

    header = [
        "source_code",
        "source_concept_id",
        "source_vocabulary_id",
        "source_code_description",
        "target_concept_id",
        "target_vocabulary_id",
        "valid_start_date",
        "valid_end_date",
        "invalid_reason",
    ]

    row_count = 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(header)

        for concept in IrsfVocabulary.all_concepts():
            # Determine source_code: column name for CSS/MBA/Mutation, value for Diagnosis
            if concept.source_column is not None:
                source_code = concept.source_column
            elif concept.source_value is not None:
                source_code = concept.source_value
            else:
                logger.warning(
                    "Concept %s has neither source_column nor source_value, skipping",
                    concept.concept_code,
                )
                continue

            # Primary mapping: source -> custom concept
            writer.writerow([
                source_code,
                0,  # source_concept_id
                "IRSF-NHS",  # source_vocabulary_id
                concept.concept_name,  # source_code_description
                concept.concept_id,  # target_concept_id
                concept.vocabulary_id,  # target_vocabulary_id (IRSF-NHS)
                "1970-01-01",
                "2099-12-31",
                "",  # invalid_reason
            ])
            row_count += 1

            # Dual mapping: diagnoses with SNOMED equivalents
            if concept.source_value is not None and concept.source_value in SNOMED_MAPPINGS:
                snomed_concept_id = SNOMED_MAPPINGS[concept.source_value]
                writer.writerow([
                    source_code,
                    0,  # source_concept_id
                    "IRSF-NHS",  # source_vocabulary_id
                    concept.concept_name,  # source_code_description
                    snomed_concept_id,  # target_concept_id (standard SNOMED)
                    "SNOMED",  # target_vocabulary_id
                    "1970-01-01",
                    "2099-12-31",
                    "",  # invalid_reason
                ])
                row_count += 1

    logger.info("Generated %s (%d rows)", path, row_count)
    return path
