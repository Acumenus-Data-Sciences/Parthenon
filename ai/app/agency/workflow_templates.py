"""Workflow Templates — pre-built step sequences for common OHDSI study designs.

Each template method returns a list of step dicts compatible with
:meth:`~app.agency.plan_engine.PlanEngine.create_plan`.  Templates capture
institutional knowledge about the correct order of operations for standard
OHDSI study patterns so users and the LLM do not need to build plans from
scratch.
"""
from __future__ import annotations

from typing import Any


class WorkflowTemplates:
    """Static factory methods for common OHDSI workflow step sequences.

    All methods return a list of step dicts.  Each dict has at minimum:

    * ``tool_name`` (str) — a registered tool name.
    * ``parameters`` (dict) — parameters for that tool.
    * ``step_id`` (str) — a short human-readable identifier.
    * ``depends_on`` (list[str]) — IDs of prerequisite steps.
    """

    # ------------------------------------------------------------------
    # Templates
    # ------------------------------------------------------------------

    @staticmethod
    def incident_cohort(
        condition_name: str,
        condition_concepts: list[int],
        drug_name: str,
        drug_concepts: list[int],
        washout_days: int = 365,
        source_id: int | None = None,
    ) -> list[dict[str, Any]]:
        """Generate steps for an incident cohort study.

        Workflow:
        1. Create a concept set for the condition.
        2. Create a concept set for the drug/exposure.
        3. Create a cohort definition using both concept sets.
        4. Generate the cohort against the data source.
        5. Run an incidence rate analysis.

        Parameters
        ----------
        condition_name:
            Display name for the condition concept set and cohort.
        condition_concepts:
            List of OMOP concept IDs for the condition.
        drug_name:
            Display name for the drug/exposure concept set.
        drug_concepts:
            List of OMOP concept IDs for the drug/exposure.
        washout_days:
            Required clean-window in days before index date (default 365).
        source_id:
            CDM data source ID.  ``None`` uses the default source.

        Returns
        -------
        list[dict[str, Any]]
            Ordered list of step dicts (>= 3 steps).
        """
        steps: list[dict[str, Any]] = []

        # Step 1 — condition concept set
        steps.append({
            "step_id": "create_concept_set",
            "tool_name": "create_concept_set",
            "parameters": {
                "name": f"{condition_name} Concepts",
                "description": f"OMOP concept set for {condition_name}",
                "items": [
                    {"concept_id": cid, "include_descendants": True}
                    for cid in condition_concepts
                ],
            },
            "depends_on": [],
        })

        # Step 2 — drug/exposure concept set
        steps.append({
            "step_id": "create_drug_concept_set",
            "tool_name": "create_concept_set",
            "parameters": {
                "name": f"{drug_name} Concepts",
                "description": f"OMOP concept set for {drug_name}",
                "items": [
                    {"concept_id": cid, "include_descendants": True}
                    for cid in drug_concepts
                ],
            },
            "depends_on": [],
        })

        # Step 3 — cohort definition
        cohort_params: dict[str, Any] = {
            "name": f"Incident {condition_name} on {drug_name}",
            "description": (
                f"Incident {condition_name} patients initiating {drug_name} "
                f"with {washout_days}-day washout."
            ),
        }
        steps.append({
            "step_id": "create_cohort_definition",
            "tool_name": "create_cohort_definition",
            "parameters": cohort_params,
            "depends_on": ["create_concept_set", "create_drug_concept_set"],
        })

        # Step 4 — generate cohort
        generate_params: dict[str, Any] = {"cohort_definition_id": None}  # resolved at runtime
        if source_id is not None:
            generate_params["data_source_id"] = source_id
        steps.append({
            "step_id": "generate_cohort",
            "tool_name": "generate_cohort",
            "parameters": generate_params,
            "depends_on": ["create_cohort_definition"],
        })

        # Step 5 — incidence analysis
        incidence_params: dict[str, Any] = {
            "target_cohort_id": None,   # resolved at runtime
            "outcome_cohort_id": None,  # resolved at runtime
            "washout_days": washout_days,
            "name": f"Incidence of {condition_name} on {drug_name}",
        }
        if source_id is not None:
            incidence_params["source_id"] = source_id
        steps.append({
            "step_id": "run_incidence_analysis",
            "tool_name": "run_incidence_analysis",
            "parameters": incidence_params,
            "depends_on": ["generate_cohort"],
        })

        return steps

    @staticmethod
    def characterization_study(
        cohort_name: str,
        condition_concepts: list[int],
        source_id: int | None = None,
    ) -> list[dict[str, Any]]:
        """Generate steps for a cohort characterization study.

        Workflow:
        1. Create a concept set for the condition.
        2. Create a cohort definition.
        3. Generate the cohort.
        4. Run a characterization analysis.

        Parameters
        ----------
        cohort_name:
            Display name for the cohort.
        condition_concepts:
            List of OMOP concept IDs that define cohort membership.
        source_id:
            CDM data source ID.  ``None`` uses the default source.

        Returns
        -------
        list[dict[str, Any]]
            Ordered list of step dicts (>= 3 steps).
        """
        steps: list[dict[str, Any]] = []

        # Step 1 — concept set
        steps.append({
            "step_id": "create_concept_set",
            "tool_name": "create_concept_set",
            "parameters": {
                "name": f"{cohort_name} Concepts",
                "description": f"OMOP concept set for {cohort_name}",
                "items": [
                    {"concept_id": cid, "include_descendants": True}
                    for cid in condition_concepts
                ],
            },
            "depends_on": [],
        })

        # Step 2 — cohort definition
        steps.append({
            "step_id": "create_cohort_definition",
            "tool_name": "create_cohort_definition",
            "parameters": {
                "name": cohort_name,
                "description": f"Cohort for characterization study: {cohort_name}",
            },
            "depends_on": ["create_concept_set"],
        })

        # Step 3 — generate cohort
        generate_params: dict[str, Any] = {"cohort_definition_id": None}
        if source_id is not None:
            generate_params["data_source_id"] = source_id
        steps.append({
            "step_id": "generate_cohort",
            "tool_name": "generate_cohort",
            "parameters": generate_params,
            "depends_on": ["create_cohort_definition"],
        })

        # Step 4 — characterization analysis
        char_params: dict[str, Any] = {
            "cohort_definition_id": None,  # resolved at runtime
            "name": f"Characterization of {cohort_name}",
        }
        if source_id is not None:
            char_params["source_id"] = source_id
        steps.append({
            "step_id": "run_characterization",
            "tool_name": "run_characterization",
            "parameters": char_params,
            "depends_on": ["generate_cohort"],
        })

        return steps

    # ------------------------------------------------------------------
    # Discovery helpers
    # ------------------------------------------------------------------

    @staticmethod
    def list_templates() -> list[dict[str, str]]:
        """Return metadata for all available workflow templates.

        Returns
        -------
        list[dict[str, str]]
            Each entry has ``name`` and ``description`` keys.
        """
        return [
            {
                "name": "incident_cohort",
                "description": (
                    "Build an incident cohort study: concept sets → cohort definition "
                    "→ generation → incidence rate analysis."
                ),
            },
            {
                "name": "characterization_study",
                "description": (
                    "Characterize a patient cohort: concept set → cohort definition "
                    "→ generation → characterization analysis."
                ),
            },
        ]

    @staticmethod
    def format_for_prompt() -> str:
        """Render a human-readable summary of available templates for LLM prompts.

        Returns
        -------
        str
            Multi-line string listing each template name and description.
        """
        templates = WorkflowTemplates.list_templates()
        lines: list[str] = ["Available workflow templates:"]
        for tmpl in templates:
            lines.append(f"  - {tmpl['name']}: {tmpl['description']}")
        return "\n".join(lines)
