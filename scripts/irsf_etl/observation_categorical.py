"""Categorical clinical observation transformers.

Transforms six source files (Rett Features, Developmental History,
Clinical Assessment, Allergies, Nutrition, Abnormal Movements) into
OMOP observation rows. Each source has distinct structure requiring
tailored extraction logic, but all output to the same observation table format.

Exports:
    transform_categorical_observations: Main orchestrator merging all sub-transformers.
    transform_rett_features: Rett features Everoccurred + timepoint observations.
    transform_devhx: Developmental history milestone observations.
    transform_clinical_assessment: Clinical assessment categorical observations.
    transform_allergies: Allergy observations with SNOMED mapping.
    transform_nutrition: Nutrition log observations.
    transform_abnormal_movements: Abnormal movement observations.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import pandas as pd

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.csv_utils import read_csv_safe
from scripts.irsf_etl.lib.date_assembler import assemble_date
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.schemas.observation import observation_schema

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OMOP constants
# ---------------------------------------------------------------------------

_OBS_TYPE_SURVEY = 32883  # Survey
_OBS_TYPE_EHR = 32817  # EHR
_VALUE_AS_CONCEPT_PRESENT = 4181412  # Present

# ---------------------------------------------------------------------------
# Rett Features SNOMED mapping
# ---------------------------------------------------------------------------

RETT_FEATURE_SNOMED_MAP: dict[str, int] = {
    "Bruxism": 4133756,
    "Hyperventilation": 4178523,
    "Constipation": 4145508,
    "Scoliosis": 4141678,
    "GEReflux": 4185710,
    "Anxiety": 441542,
    "SleepDifficulty": 4196636,
    "BreathHolding": 4071869,
    "Drooling": 4275942,
    "Hyperactivity": 4167950,
}

# All Rett features in the Everoccurred pattern
_RETT_FEATURES: tuple[str, ...] = (
    "HandStreotypies",
    "Hyperventilation",
    "BreathHolding",
    "ColHotHand",
    "Drooling",
    "Aerophagia",
    "PuffingAir",
    "Spiting",
    "Bruxism",
    "ChewingProb",
    "GEReflux",
    "Constipation",
    "GallBladderDysf",
    "SleepDifficulty",
    "WakingAtNight",
    "HardToWakeUp",
    "DaySleeping",
    "ScreamingSpell",
    "SelfAbusiveBehavior",
    "Hyperactivity",
    "LowActivity",
    "Anxiety",
    "Scoliosis",
)

# Timepoint suffixes for follow-up visit tracking
_TIMEPOINTS: tuple[str, ...] = (
    "AtBaseline",
    "At1Y",
    "At2Y",
    "At3Y",
    "At4Y",
    "At5Y",
)

# ---------------------------------------------------------------------------
# DevHx milestone definitions
# ---------------------------------------------------------------------------

# Gross motor milestones
_DEVHX_MILESTONES_GROSS_MOTOR: tuple[str, ...] = (
    "LiftHead",
    "RolledFrTummy",
    "SatWithSupport",
    "SatWithoutSupt",
    "Cometositting",
    "Crawled",
    "StoodWhileHoldingOn",
    "PulledToStanding",
    "CruisedFurnHoldSomeone",
    "StoodIndependently",
    "WalkedIndependently",
    "Ran10FeetWithoutFalling",
    "ClimbedUpStairsWithHelp",
    "ClimbedUpStairsWithoutHelp",
    "ClimbedDownStairsWithHelp",
    "ClimbedDownStairsWithoutHelp",
)

# Fine motor milestones
_DEVHX_MILESTONES_FINE_MOTOR: tuple[str, ...] = (
    "HeldBottleUnProp",
    "ReachForToy",
    "RakingGraspRetrieve",
    "TransObjHandtoOther",
    "PincerGrasp",
    "FingerFed",
    "TurnPagesBook",
)

# Receptive language milestones
_DEVHX_MILESTONES_RECEPTIVE: tuple[str, ...] = (
    "QuietSoothAdultVoice",
    "RespondToSounds",
    "PlayedPeekaboo",
    "RespondFamiliarWords",
    "RespondOwnName",
    "InhibitNoDiffTones",
    "FollowCommandWithGesture",
    "CommandWithoutGesture",
    "IdentifiedBodyParts",
    "Pointed1ColorAsked",
)

# Expressive language milestones
_DEVHX_MILESTONES_EXPRESSIVE: tuple[str, ...] = (
    "SocialSmile",
    "Cooed",
    "Babbled",
    "WordsWithMeaning",
    "SpokenPhrases",
    "WavedBye",
    "PointedWhenWant",
    "SharedStories",
)

# Adaptive milestones
_DEVHX_MILESTONES_ADAPTIVE: tuple[str, ...] = (
    "LikeBeingHeld",
    "AttentionLoudPrSound",
    "EyesFixedFollowObject",
    "PlayPatACake",
    "DesireSocialAtten",
    "ImitatePeersActivities",
    "BeenIndependent",
    "TakeDrinkWithoutAssist",
    "SpoonForkWithAssist",
    "SpoonForkWithoutAssist",
)

ALL_DEVHX_MILESTONES: tuple[str, ...] = (
    _DEVHX_MILESTONES_GROSS_MOTOR
    + _DEVHX_MILESTONES_FINE_MOTOR
    + _DEVHX_MILESTONES_RECEPTIVE
    + _DEVHX_MILESTONES_EXPRESSIVE
    + _DEVHX_MILESTONES_ADAPTIVE
)

# HowSudden regression rating columns
_HOWSUDDEN_COLUMNS: tuple[str, ...] = (
    "HowSuddenGRMotorFuncLoss",
    "HowSuddenMotorDev",
    "HowSuddenReceptDev",
    "HowSuddenExpressiveDev",
    "HowSuddenAdaptDev",
)

# ---------------------------------------------------------------------------
# Clinical Assessment boolean groups
# ---------------------------------------------------------------------------

_DYSMORPHIC_CB_PREFIX = "DysmorphicCB_"
_DYSM_EXTREM_PREFIX = "DysmExtrem_"
_CONTRACTURES_PREFIX = "Contractures_"
_GAIT_PATTERN_PREFIX = "GaitPattern_"
_DESCRIPT_ABNORMAL_PREFIX = "DescriptAbnormal_"

# Ordinal/categorical clinical assessment columns
_CLINICAL_ORDINAL_COLUMNS: tuple[str, ...] = (
    "Alertness",
    "Interaction",
    "CranialNerves",
    "Sitting",
    "Standing",
    "Walking",
    "AtaxiaApraxia",
    "AxialTone",
    "AppendicTone",
    "OverallHypertonia",
    "Dystonia",
    "Bradykinesia",
    "Chorea",
    "Bruxism",
    "TruncalRocking",
    "VerbLangOutput",
    "RespToSpoken",
    "DurationEyeCont",
    "NonverbChoice",
    "HandDominance",
    "HandUseImpression",
    "SelfAbusive",
    "AggressiveBehaviors",
    "OverallReflexes",
    "DegreeHyperreflexia",
    "Hyperactivity",
    "Hypoactivity",
)

# Measurement columns to EXCLUDE (Phase 9 handles these)
_MEASUREMENT_COLUMNS: frozenset[str] = frozenset({
    "WeightTextBox",
    "HeightTextBox",
    "BMIbyCalc",
    "HeadCircumference",
    "HeadCircumPercent",
    "MotherHeadCircum",
    "FatherHeadCircum",
    "WaistCircum",
    "WristCircum",
    "MidUpperArmCircum",
    "TricepFoldCircum",
})

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _safe_int(value: object) -> int | None:
    """Coerce a value to int, returning None for non-numeric values."""
    if value is None or value is pd.NA:
        return None
    s = str(value).strip()
    if s == "" or s.lower() in ("nan", "none"):
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def _is_truthy(value: object) -> bool:
    """Return True if value represents a truthy indicator (1, Y, Yes, etc.)."""
    if value is None or value is pd.NA:
        return False
    s = str(value).strip().lower()
    return s in ("1", "1.0", "y", "yes", "true")


def _resolve_person_ids(
    raw: pd.DataFrame,
    registry: PersonIdRegistry,
    rejection_log: RejectionLog,
    source_name: str,
) -> pd.DataFrame:
    """Resolve participant_id to person_id, adding person_id and _valid columns.

    Returns a copy of the input with person_id and _valid columns added.
    """
    df = raw.copy()
    person_ids: list[int | None] = []
    valid_mask: list[bool] = []

    for idx, row in df.iterrows():
        raw_pid = row.get("participant_id")
        if pd.isna(raw_pid):
            rejection_log.log(
                int(idx),
                "participant_id",
                str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                f"NULL participant_id in {source_name} row",
            )
            person_ids.append(None)
            valid_mask.append(False)
            continue

        resolved = registry.resolve(int(float(str(raw_pid))))
        if resolved is None:
            rejection_log.log(
                int(idx),
                "participant_id",
                str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                f"Unresolvable participant_id: {raw_pid} in {source_name}",
            )
            person_ids.append(None)
            valid_mask.append(False)
            continue

        person_ids.append(resolved)
        valid_mask.append(True)

    df["person_id"] = person_ids
    df["_valid"] = valid_mask
    return df


def _parse_visit_date(raw_date: object) -> str | None:
    """Parse a visit_date to ISO YYYY-MM-DD string. Returns None on failure."""
    if raw_date is None or pd.isna(raw_date):
        return None
    try:
        parsed = pd.to_datetime(str(raw_date), format="mixed", dayfirst=False)
        return parsed.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _build_observation_row(
    *,
    person_id: int,
    observation_concept_id: int,
    observation_date: str,
    observation_type_concept_id: int,
    value_as_number: float | None = None,
    value_as_string: str | None = None,
    value_as_concept_id: int | None = None,
    observation_source_value: str,
    observation_source_concept_id: int = 0,
    visit_occurrence_id: int | None = None,
    qualifier_source_value: str | None = None,
) -> dict:
    """Build a single observation row dict."""
    return {
        "person_id": person_id,
        "observation_concept_id": observation_concept_id,
        "observation_date": observation_date,
        "observation_type_concept_id": observation_type_concept_id,
        "value_as_number": value_as_number,
        "value_as_string": value_as_string,
        "value_as_concept_id": value_as_concept_id,
        "observation_source_value": observation_source_value,
        "observation_source_concept_id": observation_source_concept_id,
        "visit_occurrence_id": visit_occurrence_id,
        "qualifier_source_value": qualifier_source_value,
    }


# ---------------------------------------------------------------------------
# Rett Features transformer (Task 1)
# ---------------------------------------------------------------------------


def transform_rett_features(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Transform Rett features Everoccurred + timepoint columns to observations.

    Emits one observation per feature where Everoccurred=1, with onset date from
    split date columns. Also emits timepoint observations (AtBaseline through At5Y)
    where the value is 1, for longitudinal tracking.
    """
    source_path = config.source_custom_extracts / "csv" / "Rett_Features_5211.csv"
    logger.info("Loading Rett Features from %s", source_path)
    raw = read_csv_safe(source_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d Rett Features rows", len(raw))

    # Resolve person_ids
    df = _resolve_person_ids(raw, registry, rejection_log, "Rett_Features")
    df_valid = df[df["_valid"]].copy()

    if df_valid.empty:
        logger.warning("No valid Rett Features rows after person resolution")
        return pd.DataFrame()

    # Parse visit_date as fallback date
    df_valid["_visit_date"] = df_valid["visit_date"].apply(_parse_visit_date)

    rows: list[dict] = []

    for idx, record in df_valid.iterrows():
        person_id = int(record["person_id"])
        fallback_date = record["_visit_date"]

        for feature in _RETT_FEATURES:
            # Check Everoccurred column
            # Note: SelfAbusiveBehavior Everoccurred column is truncated to "SelfAbusiveBehaviorEveroccurre"
            everoccurred_col = f"{feature}Everoccurred"
            # Handle truncated column names (CSV column limit)
            if everoccurred_col not in df_valid.columns:
                # Try truncated version
                truncated = everoccurred_col[:30]
                if truncated in df_valid.columns:
                    everoccurred_col = truncated
                else:
                    continue

            val = record.get(everoccurred_col)
            if not _is_truthy(val):
                continue

            # Assemble onset date from split columns
            mm_col = f"{feature}StartDtMM"
            dd_col = f"{feature}StartDtDD"
            yy_col = f"{feature}StartDtYY"
            unkn_col = f"{feature}StartDtUnkn"

            onset_date = None
            if mm_col in df_valid.columns and dd_col in df_valid.columns and yy_col in df_valid.columns:
                assembled = assemble_date(
                    record.get(mm_col),
                    record.get(dd_col),
                    record.get(yy_col),
                    max_year=2026,
                )
                if assembled is not None:
                    onset_date = assembled.strftime("%Y-%m-%d")

            # Fallback: if date unknown or unparseable, use visit_date
            if onset_date is None:
                if fallback_date is not None:
                    onset_date = fallback_date
                else:
                    rejection_log.log(
                        int(idx),
                        everoccurred_col,
                        "1",
                        RejectionCategory.DATE_ASSEMBLY_FAILED,
                        f"No onset or visit date for {feature} Everoccurred",
                    )
                    continue

            concept_id = RETT_FEATURE_SNOMED_MAP.get(feature, 0)
            visit_id = visit_resolver.resolve(person_id, onset_date)

            rows.append(
                _build_observation_row(
                    person_id=person_id,
                    observation_concept_id=concept_id,
                    observation_date=onset_date,
                    observation_type_concept_id=_OBS_TYPE_SURVEY,
                    value_as_concept_id=_VALUE_AS_CONCEPT_PRESENT,
                    observation_source_value=f"{feature}Everoccurred",
                    observation_source_concept_id=concept_id,
                    visit_occurrence_id=visit_id,
                )
            )

            # Emit timepoint observations
            for tp in _TIMEPOINTS:
                tp_col = f"{feature}{tp}"
                if tp_col not in df_valid.columns:
                    continue
                tp_val = record.get(tp_col)
                if not _is_truthy(tp_val):
                    continue

                # Timepoints use visit_date (not onset date)
                tp_date = fallback_date if fallback_date else onset_date
                rows.append(
                    _build_observation_row(
                        person_id=person_id,
                        observation_concept_id=concept_id,
                        observation_date=tp_date,
                        observation_type_concept_id=_OBS_TYPE_SURVEY,
                        value_as_concept_id=_VALUE_AS_CONCEPT_PRESENT,
                        observation_source_value=f"{feature}{tp}",
                        observation_source_concept_id=concept_id,
                        visit_occurrence_id=visit_resolver.resolve(person_id, tp_date) if tp_date else None,
                    )
                )

    logger.info("Rett Features: emitted %d observation rows", len(rows))
    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ---------------------------------------------------------------------------
# Developmental History transformer (Task 2)
# ---------------------------------------------------------------------------


def transform_devhx(
    config: ETLConfig,
    registry: PersonIdRegistry,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Transform developmental history milestones to observations.

    For each milestone, emits separate observations for Learned, Lost, and
    Relearned states with age-at-event in value_as_number.
    """
    source_path = config.source_custom_extracts / "csv" / "DevHx_5201_5211.csv"
    logger.info("Loading DevHx from %s", source_path)
    raw = read_csv_safe(source_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d DevHx rows", len(raw))

    # Resolve person_ids
    df = _resolve_person_ids(raw, registry, rejection_log, "DevHx")
    df_valid = df[df["_valid"]].copy()

    if df_valid.empty:
        logger.warning("No valid DevHx rows after person resolution")
        return pd.DataFrame()

    # Build DOB lookup from ChildsDOB column
    dob_map: dict[int, str] = {}
    for _, row in df_valid.iterrows():
        pid = int(row["person_id"])
        if pid in dob_map:
            continue
        dob_raw = row.get("ChildsDOB")
        parsed = _parse_visit_date(dob_raw)
        if parsed is not None:
            dob_map[pid] = parsed

    rows: list[dict] = []
    states = ("Learned", "Lost", "Relearned")

    for idx, record in df_valid.iterrows():
        person_id = int(record["person_id"])
        dob = dob_map.get(person_id)
        if dob is None:
            dob = "1900-01-01"

        for milestone in ALL_DEVHX_MILESTONES:
            for state in states:
                # Column naming varies: some use YN suffix for Learned, some don't
                state_col_candidates = [
                    f"{milestone}{state}YN",
                    f"{milestone}{state}",
                ]
                state_col = None
                for candidate in state_col_candidates:
                    if candidate in df_valid.columns:
                        state_col = candidate
                        break
                if state_col is None:
                    continue

                val = record.get(state_col)
                if not _is_truthy(val):
                    continue

                # Get age in months
                age_col_candidates = [
                    f"{milestone}{state}Age",
                    f"{milestone}{state}AgeUnkn",
                ]
                age_months: float | None = None
                for age_candidate in age_col_candidates:
                    if age_candidate in df_valid.columns and "Unkn" not in age_candidate:
                        raw_age = record.get(age_candidate)
                        parsed_age = _safe_int(raw_age)
                        if parsed_age is not None and parsed_age >= 0:
                            age_months = float(parsed_age)
                            break

                # Use DOB as observation date (milestones are relative to birth)
                obs_date = dob

                rows.append(
                    _build_observation_row(
                        person_id=person_id,
                        observation_concept_id=0,
                        observation_date=obs_date,
                        observation_type_concept_id=_OBS_TYPE_SURVEY,
                        value_as_number=age_months,
                        observation_source_value=f"{milestone}{state}",
                        observation_source_concept_id=0,
                    )
                )

        # HowSudden regression columns
        for sudden_col in _HOWSUDDEN_COLUMNS:
            if sudden_col not in df_valid.columns:
                continue
            val = record.get(sudden_col)
            if val is None or pd.isna(val) or str(val).strip() == "":
                continue
            rows.append(
                _build_observation_row(
                    person_id=person_id,
                    observation_concept_id=0,
                    observation_date=dob,
                    observation_type_concept_id=_OBS_TYPE_SURVEY,
                    value_as_string=str(val).strip(),
                    observation_source_value=sudden_col,
                    observation_source_concept_id=0,
                )
            )

        # RegressSameTimeIllness
        if "RegressSameTimeIllness" in df_valid.columns:
            val = record.get("RegressSameTimeIllness")
            if _is_truthy(val):
                rows.append(
                    _build_observation_row(
                        person_id=person_id,
                        observation_concept_id=0,
                        observation_date=dob,
                        observation_type_concept_id=_OBS_TYPE_SURVEY,
                        value_as_concept_id=_VALUE_AS_CONCEPT_PRESENT,
                        observation_source_value="RegressSameTimeIllness",
                        observation_source_concept_id=0,
                    )
                )

    logger.info("DevHx: emitted %d observation rows", len(rows))
    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ---------------------------------------------------------------------------
# Clinical Assessment transformer (Task 3)
# ---------------------------------------------------------------------------


def transform_clinical_assessment(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Transform clinical assessment categorical columns to observations.

    Processes dysmorphic features (booleans), neurological exam,
    mobility/gait, tone, communication, hand use, and self-injurious behavior.
    Excludes measurement columns (handled by Phase 9).
    """
    source_path = config.source_custom_extracts / "csv" / "ClinicalAssessment_5211.csv"
    logger.info("Loading ClinicalAssessment from %s", source_path)
    raw = read_csv_safe(source_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d ClinicalAssessment rows", len(raw))

    # Resolve person_ids
    df = _resolve_person_ids(raw, registry, rejection_log, "ClinicalAssessment")
    df_valid = df[df["_valid"]].copy()

    if df_valid.empty:
        logger.warning("No valid ClinicalAssessment rows after person resolution")
        return pd.DataFrame()

    # Identify boolean group columns
    bool_prefixes = (
        _DYSMORPHIC_CB_PREFIX,
        _DYSM_EXTREM_PREFIX,
        _CONTRACTURES_PREFIX,
        _GAIT_PATTERN_PREFIX,
        _DESCRIPT_ABNORMAL_PREFIX,
    )
    boolean_columns = [
        col
        for col in df_valid.columns
        if any(col.startswith(prefix) for prefix in bool_prefixes)
        and col not in _MEASUREMENT_COLUMNS
    ]

    rows: list[dict] = []

    for idx, record in df_valid.iterrows():
        person_id = int(record["person_id"])
        visit_date = _parse_visit_date(record.get("visit_date"))
        if visit_date is None:
            rejection_log.log(
                int(idx),
                "visit_date",
                str(record.get("visit_date")),
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                "NULL visit_date in ClinicalAssessment row",
            )
            continue

        visit_id = visit_resolver.resolve(person_id, visit_date)

        # Boolean group columns (emit where value = 1)
        for col in boolean_columns:
            val = _safe_int(record.get(col))
            if val != 1:
                continue
            # Skip "none" indicator columns
            if col.endswith("_none") or col.endswith("_None"):
                continue
            rows.append(
                _build_observation_row(
                    person_id=person_id,
                    observation_concept_id=0,
                    observation_date=visit_date,
                    observation_type_concept_id=_OBS_TYPE_EHR,
                    value_as_concept_id=_VALUE_AS_CONCEPT_PRESENT,
                    observation_source_value=col,
                    observation_source_concept_id=0,
                    visit_occurrence_id=visit_id,
                )
            )

        # Ordinal/categorical columns (emit where non-NULL, non-empty)
        for col in _CLINICAL_ORDINAL_COLUMNS:
            if col not in df_valid.columns:
                continue
            if col in _MEASUREMENT_COLUMNS:
                continue
            val = record.get(col)
            if val is None or pd.isna(val) or str(val).strip() == "":
                continue
            rows.append(
                _build_observation_row(
                    person_id=person_id,
                    observation_concept_id=0,
                    observation_date=visit_date,
                    observation_type_concept_id=_OBS_TYPE_EHR,
                    value_as_string=str(val).strip(),
                    observation_source_value=col,
                    observation_source_concept_id=0,
                    visit_occurrence_id=visit_id,
                )
            )

    logger.info("ClinicalAssessment: emitted %d observation rows", len(rows))
    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ---------------------------------------------------------------------------
# Allergies transformer (Task 4)
# ---------------------------------------------------------------------------


def _parse_snomed_code(snomed_output: str | None) -> int:
    """Extract SNOMED concept_id from AllergenSNOMEDOutput string.

    Attempts to parse integer SNOMED codes from various formats.
    Returns 0 if unparseable.
    """
    if snomed_output is None or pd.isna(snomed_output):
        return 0
    s = str(snomed_output).strip()
    if s == "" or s.lower() in ("nan", "none"):
        return 0
    # Try direct integer parse
    try:
        return int(float(s))
    except (ValueError, TypeError):
        pass
    # Try extracting numeric code from formatted string
    match = re.search(r"(\d{4,})", s)
    if match:
        return int(match.group(1))
    return 0


def transform_allergies(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Transform allergy entries to OMOP observations.

    Filters to rows where Allergies_reported is truthy, maps SNOMED codes
    from AllergenSNOMEDOutput, and stores reaction types in value_as_string.
    """
    source_path = config.source_custom_extracts / "csv" / "Allergies_5211.csv"
    logger.info("Loading Allergies from %s", source_path)
    raw = read_csv_safe(source_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d Allergies rows", len(raw))

    # Resolve person_ids
    df = _resolve_person_ids(raw, registry, rejection_log, "Allergies")
    df_valid = df[df["_valid"]].copy()

    if df_valid.empty:
        logger.warning("No valid Allergies rows after person resolution")
        return pd.DataFrame()

    # Reaction columns
    reaction_cols = [
        col for col in df_valid.columns if col.startswith("Reaction_")
    ]

    rows: list[dict] = []

    for idx, record in df_valid.iterrows():
        # Filter: Allergies_reported must be truthy
        if not _is_truthy(record.get("Allergies_reported")):
            continue

        person_id = int(record["person_id"])

        # Assemble date from split columns
        obs_date = None
        assembled = assemble_date(
            record.get("DateStartedMM"),
            record.get("DateStartedDD"),
            record.get("DateStartedYY"),
            max_year=2026,
        )
        if assembled is not None:
            obs_date = assembled.strftime("%Y-%m-%d")

        # Fallback to visit_date
        if obs_date is None:
            obs_date = _parse_visit_date(record.get("visit_date"))

        if obs_date is None:
            rejection_log.log(
                int(idx),
                "DateStarted",
                "",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                "No date for allergy observation",
            )
            continue

        # Parse SNOMED concept
        concept_id = _parse_snomed_code(record.get("AllergenSNOMEDOutput"))
        source_value = str(record.get("AllergenSNOMEDInput", "")).strip()
        if not source_value or source_value.lower() in ("nan", "none"):
            source_value = "Allergy"

        # Build reaction string
        reactions = []
        for rcol in reaction_cols:
            if _safe_int(record.get(rcol)) == 1:
                reaction_name = rcol.replace("Reaction_", "")
                reactions.append(reaction_name)
        reaction_str = ", ".join(reactions) if reactions else None

        visit_id = visit_resolver.resolve(person_id, obs_date)

        rows.append(
            _build_observation_row(
                person_id=person_id,
                observation_concept_id=concept_id,
                observation_date=obs_date,
                observation_type_concept_id=_OBS_TYPE_SURVEY,
                value_as_string=reaction_str,
                observation_source_value=source_value,
                observation_source_concept_id=concept_id,
                visit_occurrence_id=visit_id,
            )
        )

    logger.info("Allergies: emitted %d observation rows", len(rows))
    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ---------------------------------------------------------------------------
# Nutrition transformer (Task 4)
# ---------------------------------------------------------------------------


def transform_nutrition(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Transform nutrition log entries to OMOP observations.

    Combines Route, TypeOfFood, and Modification into value_as_string.
    """
    source_path = config.source_custom_extracts / "csv" / "Nutrition_5211.csv"
    logger.info("Loading Nutrition from %s", source_path)
    raw = read_csv_safe(source_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d Nutrition rows", len(raw))

    # Resolve person_ids
    df = _resolve_person_ids(raw, registry, rejection_log, "Nutrition")
    df_valid = df[df["_valid"]].copy()

    if df_valid.empty:
        logger.warning("No valid Nutrition rows after person resolution")
        return pd.DataFrame()

    rows: list[dict] = []

    for idx, record in df_valid.iterrows():
        if not _is_truthy(record.get("nutrition_reported")):
            continue

        person_id = int(record["person_id"])

        # Assemble date from split columns (Month/Day/Year format)
        obs_date = None
        assembled = assemble_date(
            record.get("DateStartedMonth"),
            record.get("DateStartedDay"),
            record.get("DateStartedYear"),
            max_year=2026,
        )
        if assembled is not None:
            obs_date = assembled.strftime("%Y-%m-%d")

        if obs_date is None:
            obs_date = _parse_visit_date(record.get("visit_date"))

        if obs_date is None:
            rejection_log.log(
                int(idx),
                "DateStarted",
                "",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                "No date for nutrition observation",
            )
            continue

        # Build value_as_string from Route, TypeOfFood, Modification
        route = str(record.get("Route", "")).strip()
        food_type = str(record.get("TypeOfFood", "")).strip()
        modification = str(record.get("Modification", "")).strip()

        parts = []
        if route and route.lower() not in ("nan", "none", ""):
            parts.append(f"Route:{route}")
        if food_type and food_type.lower() not in ("nan", "none", ""):
            parts.append(f"Food:{food_type}")
        if modification and modification.lower() not in ("nan", "none", ""):
            parts.append(f"Mod:{modification}")
        value_str = "; ".join(parts) if parts else None

        # Source value: Nutrition:{Route}:{TypeOfFood}
        route_clean = route if route.lower() not in ("nan", "none", "") else ""
        food_clean = food_type if food_type.lower() not in ("nan", "none", "") else ""
        source_value = f"Nutrition:{route_clean}:{food_clean}"

        visit_id = visit_resolver.resolve(person_id, obs_date)

        rows.append(
            _build_observation_row(
                person_id=person_id,
                observation_concept_id=0,
                observation_date=obs_date,
                observation_type_concept_id=_OBS_TYPE_SURVEY,
                value_as_string=value_str,
                observation_source_value=source_value,
                observation_source_concept_id=0,
                visit_occurrence_id=visit_id,
            )
        )

    logger.info("Nutrition: emitted %d observation rows", len(rows))
    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ---------------------------------------------------------------------------
# Abnormal Movements transformer (Task 4)
# ---------------------------------------------------------------------------


def transform_abnormal_movements(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Transform abnormal movement log entries to OMOP observations.

    Stores Description in value_as_string and InvestigatorsImpression
    in observation_source_value.
    """
    source_path = config.source_custom_extracts / "csv" / "Abnormal_Movements_5211.csv"
    logger.info("Loading Abnormal Movements from %s", source_path)
    raw = read_csv_safe(source_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d Abnormal Movements rows", len(raw))

    # Resolve person_ids
    df = _resolve_person_ids(raw, registry, rejection_log, "Abnormal_Movements")
    df_valid = df[df["_valid"]].copy()

    if df_valid.empty:
        logger.warning("No valid Abnormal Movements rows after person resolution")
        return pd.DataFrame()

    rows: list[dict] = []

    for idx, record in df_valid.iterrows():
        if not _is_truthy(record.get("Abnormal_Movements_reported")):
            continue

        person_id = int(record["person_id"])

        # Assemble date from split columns
        obs_date = None
        assembled = assemble_date(
            record.get("DateStartedMonth"),
            record.get("DateStartedDay"),
            record.get("DateStartedYear"),
            max_year=2026,
        )
        if assembled is not None:
            obs_date = assembled.strftime("%Y-%m-%d")

        if obs_date is None:
            obs_date = _parse_visit_date(record.get("visit_date"))

        if obs_date is None:
            rejection_log.log(
                int(idx),
                "DateStarted",
                "",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                "No date for abnormal movement observation",
            )
            continue

        # Get description and investigator impression
        description = str(record.get("Description", "")).strip()
        if description.lower() in ("nan", "none", ""):
            description = None

        impression = str(record.get("InvestigatorsImpression", "")).strip()
        if impression.lower() in ("nan", "none", ""):
            impression = "Unknown"

        source_value = f"AbnormalMovement:{impression}"

        visit_id = visit_resolver.resolve(person_id, obs_date)

        rows.append(
            _build_observation_row(
                person_id=person_id,
                observation_concept_id=0,
                observation_date=obs_date,
                observation_type_concept_id=_OBS_TYPE_SURVEY,
                value_as_string=description,
                observation_source_value=source_value,
                observation_source_concept_id=0,
                visit_occurrence_id=visit_id,
            )
        )

    logger.info("Abnormal Movements: emitted %d observation rows", len(rows))
    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ---------------------------------------------------------------------------
# Orchestrator (Task 5)
# ---------------------------------------------------------------------------


def transform_categorical_observations(
    config: ETLConfig,
    *,
    observation_id_offset: int = 0,
) -> pd.DataFrame:
    """Orchestrate all categorical observation transformers.

    Calls each sub-transformer, concatenates results, assigns sequential
    observation_ids, validates against pandera schema, and writes staging CSV.

    Args:
        config: ETL configuration.
        observation_id_offset: Starting observation_id (to avoid collisions).

    Returns:
        Merged DataFrame of all categorical observations.
    """
    registry = PersonIdRegistry.from_csv(config.staging_dir / "person_id_map.csv")
    visit_resolver = VisitResolver.from_csv(config.staging_dir / "visit_id_map.csv")

    # Run sub-transformers
    rejection_log_rett = RejectionLog("observation_rett_features")
    rejection_log_devhx = RejectionLog("observation_devhx")
    rejection_log_clinical = RejectionLog("observation_clinical_assessment")
    rejection_log_allergies = RejectionLog("observation_allergies")
    rejection_log_nutrition = RejectionLog("observation_nutrition")
    rejection_log_abnormal = RejectionLog("observation_abnormal_movements")

    logger.info("=== Starting categorical observation transforms ===")

    df_rett = transform_rett_features(
        config, registry, visit_resolver, rejection_log_rett
    )
    df_devhx = transform_devhx(config, registry, rejection_log_devhx)
    df_clinical = transform_clinical_assessment(
        config, registry, visit_resolver, rejection_log_clinical
    )
    df_allergies = transform_allergies(
        config, registry, visit_resolver, rejection_log_allergies
    )
    df_nutrition = transform_nutrition(
        config, registry, visit_resolver, rejection_log_nutrition
    )
    df_abnormal = transform_abnormal_movements(
        config, registry, visit_resolver, rejection_log_abnormal
    )

    # Log per-source counts
    sources = {
        "Rett Features": df_rett,
        "DevHx": df_devhx,
        "Clinical Assessment": df_clinical,
        "Allergies": df_allergies,
        "Nutrition": df_nutrition,
        "Abnormal Movements": df_abnormal,
    }
    for name, df in sources.items():
        logger.info("  %s: %d rows", name, len(df))

    # Concatenate all non-empty DataFrames
    non_empty = [df for df in sources.values() if not df.empty]
    if not non_empty:
        logger.warning("No categorical observation rows produced")
        return pd.DataFrame(columns=[c for c in observation_schema.columns])

    merged = pd.concat(non_empty, ignore_index=True)
    logger.info("Total categorical observations: %d rows", len(merged))

    # Assign sequential observation_id
    merged["observation_id"] = range(
        observation_id_offset + 1,
        observation_id_offset + len(merged) + 1,
    )

    # Ensure nullable integer columns use Int64Dtype
    for col in ("value_as_concept_id", "visit_occurrence_id"):
        if col in merged.columns:
            merged[col] = pd.array(merged[col].values, dtype=pd.Int64Dtype())

    # Select and order columns
    output_cols = [
        "observation_id",
        "person_id",
        "observation_concept_id",
        "observation_date",
        "observation_type_concept_id",
        "value_as_number",
        "value_as_string",
        "value_as_concept_id",
        "observation_source_value",
        "observation_source_concept_id",
        "visit_occurrence_id",
        "qualifier_source_value",
    ]
    result = merged[output_cols].copy()

    # Validate against pandera schema
    result = observation_schema.validate(result)
    logger.info("Schema validation passed: %d observation rows", len(result))

    # Write staging CSV
    output_path = config.staging_dir / "observation_categorical.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(output_path, index=False)
    logger.info("Wrote %d categorical observation rows to %s", len(result), output_path)

    # Write rejection reports
    rejection_logs = [
        (rejection_log_rett, "observation_rett_features_rejections.csv"),
        (rejection_log_devhx, "observation_devhx_rejections.csv"),
        (rejection_log_clinical, "observation_clinical_assessment_rejections.csv"),
        (rejection_log_allergies, "observation_allergies_rejections.csv"),
        (rejection_log_nutrition, "observation_nutrition_rejections.csv"),
        (rejection_log_abnormal, "observation_abnormal_movements_rejections.csv"),
    ]
    for rlog, filename in rejection_logs:
        summary = rlog.summary()
        if summary.total_rejected > 0 or summary.total_warnings > 0:
            reject_path = config.reports_dir / filename
            reject_path.parent.mkdir(parents=True, exist_ok=True)
            rlog.to_csv(reject_path)
            logger.info("Wrote rejection report to %s", reject_path)

    return result
