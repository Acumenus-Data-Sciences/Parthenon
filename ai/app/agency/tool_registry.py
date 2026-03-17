"""Tool Registry — central catalogue of all agency tools with risk metadata.

Tools are registered with a RiskLevel that controls whether execution requires
explicit user confirmation before the Plan-Confirm-Execute engine proceeds.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class RiskLevel(str, Enum):
    """Risk classification for agency tools.

    LOW
        Read-only or copy operations that are easy to reverse.
    MEDIUM
        Write operations that create new resources (reversible via delete).
    HIGH
        Destructive or irreversible mutations.
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class ToolDefinition:
    """Metadata for a single callable agency tool.

    Parameters
    ----------
    name:
        Unique snake_case identifier, e.g. ``"create_concept_set"``.
    description:
        Human-readable explanation shown to users and the LLM.
    risk_level:
        Risk classification controlling confirmation requirements.
    requires_confirmation:
        If ``True`` (default), the plan engine will pause and ask the user to
        approve before executing this tool.
    rollback_capable:
        If ``True`` (default), the action logger records a checkpoint that can
        be used to undo the operation.
    parameters_schema:
        JSON-Schema dict describing accepted parameters (optional; used for
        prompt construction and validation).
    """

    name: str
    description: str
    risk_level: RiskLevel
    requires_confirmation: bool = True
    rollback_capable: bool = True
    parameters_schema: dict[str, Any] = field(default_factory=dict)


class ToolRegistry:
    """Central registry mapping tool names to :class:`ToolDefinition` objects.

    Usage::

        registry = ToolRegistry.default()
        tool = registry.get("create_concept_set")
    """

    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def register(self, tool: ToolDefinition) -> None:
        """Add *tool* to the registry.

        If a tool with the same name already exists it will be overwritten.
        """
        self._tools[tool.name] = tool

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def get(self, name: str) -> ToolDefinition | None:
        """Return the :class:`ToolDefinition` for *name*, or ``None``."""
        return self._tools.get(name)

    def list_tools(self) -> list[ToolDefinition]:
        """Return all registered tools in insertion order."""
        return list(self._tools.values())

    def list_by_risk(self, risk_level: RiskLevel) -> list[ToolDefinition]:
        """Return only tools whose ``risk_level`` matches *risk_level*."""
        return [t for t in self._tools.values() if t.risk_level == risk_level]

    def format_for_prompt(self) -> str:
        """Render a human-readable summary of all tools for LLM prompts.

        Each tool appears on its own line with its name, risk level, and
        short description.
        """
        lines: list[str] = ["Available agency tools:"]
        for tool in self._tools.values():
            lines.append(
                f"  - {tool.name} [{tool.risk_level.value}]: {tool.description}"
            )
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def default(cls) -> "ToolRegistry":
        """Return a registry pre-loaded with all Phase 4 and Phase 5 tools."""
        registry = cls()

        registry.register(ToolDefinition(
            name="create_concept_set",
            description=(
                "Create a new OMOP concept set, optionally adding one or more "
                "concept items."
            ),
            risk_level=RiskLevel.MEDIUM,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {"type": "object"},
                    },
                },
                "required": ["name"],
            },
        ))

        registry.register(ToolDefinition(
            name="create_cohort_definition",
            description=(
                "Create a new cohort definition with inclusion/exclusion criteria."
            ),
            risk_level=RiskLevel.MEDIUM,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "expression": {"type": "object"},
                },
                "required": ["name"],
            },
        ))

        registry.register(ToolDefinition(
            name="generate_cohort",
            description=(
                "Trigger generation (execution) of a cohort definition against "
                "the CDM data source."
            ),
            risk_level=RiskLevel.MEDIUM,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "cohort_definition_id": {"type": "integer"},
                    "data_source_id": {"type": "integer"},
                },
                "required": ["cohort_definition_id"],
            },
        ))

        registry.register(ToolDefinition(
            name="clone_cohort",
            description=(
                "Clone an existing cohort definition to create an editable copy."
            ),
            risk_level=RiskLevel.LOW,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "cohort_definition_id": {"type": "integer"},
                    "new_name": {"type": "string"},
                },
                "required": ["cohort_definition_id"],
            },
        ))

        registry.register(ToolDefinition(
            name="compare_cohorts",
            description=(
                "Retrieve and compare two cohort definitions side-by-side."
            ),
            risk_level=RiskLevel.LOW,
            requires_confirmation=False,
            rollback_capable=False,
            parameters_schema={
                "type": "object",
                "properties": {
                    "cohort_a_id": {"type": "integer"},
                    "cohort_b_id": {"type": "integer"},
                },
                "required": ["cohort_a_id", "cohort_b_id"],
            },
        ))

        registry.register(ToolDefinition(
            name="export_results",
            description=(
                "Export cohort or analysis results to a downloadable format."
            ),
            risk_level=RiskLevel.LOW,
            requires_confirmation=False,
            rollback_capable=False,
            parameters_schema={
                "type": "object",
                "properties": {
                    "entity_type": {"type": "string"},
                    "entity_id": {"type": "integer"},
                    "format": {"type": "string", "enum": ["csv", "json"]},
                },
                "required": ["entity_type", "entity_id"],
            },
        ))

        # ------------------------------------------------------------------
        # Phase 5 — high-risk modify, analysis, and SQL tools
        # ------------------------------------------------------------------

        registry.register(ToolDefinition(
            name="modify_concept_set",
            description=(
                "Add or remove concept items from an existing OMOP concept set. "
                "Destructive — items cannot easily be recovered once removed."
            ),
            risk_level=RiskLevel.HIGH,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "concept_set_id": {"type": "integer"},
                    "add_items": {"type": "array", "items": {"type": "object"}},
                    "remove_item_ids": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["concept_set_id"],
            },
        ))

        registry.register(ToolDefinition(
            name="modify_cohort_criteria",
            description=(
                "Update the inclusion/exclusion criteria (expression) of an "
                "existing cohort definition. Overwrites the existing expression."
            ),
            risk_level=RiskLevel.HIGH,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "cohort_definition_id": {"type": "integer"},
                    "expression": {"type": "object"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["cohort_definition_id", "expression"],
            },
        ))

        registry.register(ToolDefinition(
            name="execute_sql",
            description=(
                "Execute a validated read-only SQL query against a CDM data source. "
                "Only SELECT statements are permitted; DML/DDL is blocked."
            ),
            risk_level=RiskLevel.HIGH,
            requires_confirmation=True,
            rollback_capable=False,
            parameters_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "source_id": {"type": "integer"},
                },
                "required": ["query"],
            },
        ))

        registry.register(ToolDefinition(
            name="run_characterization",
            description=(
                "Submit a characterization analysis for a cohort against a CDM "
                "data source.  Runs asynchronously; returns an analysis ID."
            ),
            risk_level=RiskLevel.MEDIUM,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "cohort_definition_id": {"type": "integer"},
                    "source_id": {"type": "integer"},
                    "feature_analyses": {"type": "array"},
                    "name": {"type": "string"},
                },
                "required": ["cohort_definition_id"],
            },
        ))

        registry.register(ToolDefinition(
            name="run_incidence_analysis",
            description=(
                "Submit an incidence rate analysis for a target and outcome cohort "
                "against a CDM data source.  Runs asynchronously."
            ),
            risk_level=RiskLevel.MEDIUM,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "target_cohort_id": {"type": "integer"},
                    "outcome_cohort_id": {"type": "integer"},
                    "source_id": {"type": "integer"},
                    "washout_days": {"type": "integer"},
                    "name": {"type": "string"},
                },
                "required": ["target_cohort_id", "outcome_cohort_id"],
            },
        ))

        registry.register(ToolDefinition(
            name="schedule_recurring_analysis",
            description=(
                "Schedule a recurring analysis to run on a defined cadence. "
                "Creates a persistent schedule entry — remove explicitly to stop."
            ),
            risk_level=RiskLevel.HIGH,
            requires_confirmation=True,
            rollback_capable=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "analysis_id": {"type": "integer"},
                    "cron_expression": {"type": "string"},
                    "source_id": {"type": "integer"},
                    "name": {"type": "string"},
                },
                "required": ["analysis_id", "cron_expression"],
            },
        ))

        return registry
