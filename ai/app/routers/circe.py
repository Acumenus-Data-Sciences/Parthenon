"""Circe cohort definition compiler endpoints.

Wraps the OHDSI Circepy library to compile cohort definition JSON
into executable SQL, validate definitions, and render markdown.
"""
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


class CompileRequest(BaseModel):
    """Request to compile a cohort definition to SQL."""
    expression: dict[str, Any] = Field(..., description="OHDSI cohort definition JSON")
    cdm_schema: str = Field(default="cdm", description="CDM database schema")
    vocabulary_schema: str = Field(default="vocab", description="Vocabulary schema")
    target_table: str = Field(default="cohort", description="Target cohort table")
    result_schema: str = Field(default="results", description="Results schema")
    cohort_id: int = Field(default=1, description="Cohort definition ID")
    generate_stats: bool = Field(default=True, description="Generate inclusion statistics")


class CompileResponse(BaseModel):
    """Compiled SQL output."""
    sql: str
    cohort_id: int
    generate_stats: bool


class ValidateRequest(BaseModel):
    """Request to validate a cohort definition."""
    expression: dict[str, Any] = Field(..., description="OHDSI cohort definition JSON")


class ValidationWarning(BaseModel):
    """A single validation warning."""
    message: str
    severity: str


class ValidateResponse(BaseModel):
    """Validation results."""
    valid: bool
    warnings: list[ValidationWarning]


class RenderRequest(BaseModel):
    """Request to render cohort definition as markdown."""
    expression: dict[str, Any] = Field(..., description="OHDSI cohort definition JSON")


class RenderResponse(BaseModel):
    """Rendered markdown output."""
    markdown: str


@router.post("/compile", response_model=CompileResponse)
async def compile_cohort(request: CompileRequest) -> CompileResponse:
    """Compile a cohort definition JSON into executable OHDSI SQL.

    The generated SQL uses OHDSI SQL dialect (SqlRender-compatible)
    with @placeholder markers for schema names.
    """
    try:
        import json
        from circe.cohortdefinition import CohortExpression
        from circe.cohortdefinition.builders.cohort_expression_query_builder import (
            BuildExpressionQueryOptions,
            CohortExpressionQueryBuilder,
        )

        expression = CohortExpression.model_validate(request.expression)

        options = BuildExpressionQueryOptions(
            cdm_schema=request.cdm_schema,
            vocabulary_schema=request.vocabulary_schema,
            target_table=request.target_table,
            result_schema=request.result_schema,
            cohort_id=request.cohort_id,
            generate_stats=request.generate_stats,
        )

        builder = CohortExpressionQueryBuilder()
        sql = builder.build_expression_query(expression, options)

        return CompileResponse(
            sql=sql,
            cohort_id=request.cohort_id,
            generate_stats=request.generate_stats,
        )
    except Exception as e:
        logger.exception("Failed to compile cohort definition")
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/validate", response_model=ValidateResponse)
async def validate_cohort(request: ValidateRequest) -> ValidateResponse:
    """Validate a cohort definition JSON and return warnings.

    Runs 24 validation checks including: unused concepts, empty concept sets,
    missing exit criteria, range errors, time window issues, and more.
    """
    try:
        from circe.cohortdefinition import CohortExpression
        from circe.check.checker import Checker

        expression = CohortExpression.model_validate(request.expression)
        checker = Checker()
        warnings_raw = checker.check(expression)

        warnings = [
            ValidationWarning(
                message=str(w.message) if hasattr(w, "message") else str(w),
                severity=str(w.severity.value) if hasattr(w, "severity") else "info",
            )
            for w in warnings_raw
        ]

        return ValidateResponse(
            valid=len(warnings) == 0,
            warnings=warnings,
        )
    except Exception as e:
        logger.exception("Failed to validate cohort definition")
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/render", response_model=RenderResponse)
async def render_cohort(request: RenderRequest) -> RenderResponse:
    """Render a cohort definition as human-readable markdown.

    Produces a structured description of the cohort logic including
    primary criteria, inclusion rules, and end strategy.
    """
    try:
        from circe.cohortdefinition import CohortExpression
        from circe.cohortdefinition.printfriendly.markdown_render import MarkdownRender

        expression = CohortExpression.model_validate(request.expression)
        renderer = MarkdownRender()
        markdown = renderer.render(expression)

        return RenderResponse(markdown=markdown)
    except Exception as e:
        logger.exception("Failed to render cohort definition")
        raise HTTPException(status_code=422, detail=str(e))
