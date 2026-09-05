from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class FilterOperator(str, Enum):
    EQ = "eq"
    NE = "ne"
    LT = "lt"
    LTE = "lte"
    GT = "gt"
    GTE = "gte"
    IN = "in"
    CONTAINS = "contains"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"


class ProductMention(BaseModel):
    text: str
    role: Literal["single", "comparison_left", "comparison_right", "filter_target"] = "single"
    resolution_required: bool = True


class QueryFilter(BaseModel):
    field: str
    operator: FilterOperator
    value: Any = None
    source_text: str

    @model_validator(mode="after")
    def validate_null_operator(self):
        if self.operator in {FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL}:
            self.value = None
        return self


class PlanStep(BaseModel):
    step: int = Field(ge=1)
    tool: Literal["RESOLVE", "FACT", "FILTER", "COMPARE", "RAG", "TAX", "POLICY"]
    purpose: str
    depends_on: list[int] = Field(default_factory=list)


class MissingInformation(BaseModel):
    for_personalization: list[str] = Field(default_factory=list)
    from_evidence: list[str] = Field(default_factory=list)


class QueryPlan(BaseModel):
    intents: list[str] = Field(default_factory=list)
    entities: dict[str, Any] = Field(default_factory=dict)
    product_mentions: list[ProductMention] = Field(default_factory=list)
    required_facts: list[str] = Field(default_factory=list)
    filters: list[QueryFilter] = Field(default_factory=list)
    metrics: list[str] = Field(default_factory=list)
    periods: list[str] = Field(default_factory=list)
    sort: list[dict[str, Any]] = Field(default_factory=list)
    limit: int | None = Field(default=None, ge=1)
    return_all: bool = False
    missing: MissingInformation = Field(default_factory=MissingInformation)
    gap_types: list[str] = Field(default_factory=list)
    answerable_now: bool = True
    follow_ups: list[str] = Field(default_factory=list)
    safety_flags: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    completeness: Literal["single_answer", "all_matches", "all_steps"] = "single_answer"
    plan: list[PlanStep] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_execution_order(self):
        steps = [item.step for item in self.plan]
        if len(steps) != len(set(steps)):
            raise ValueError("plan.step은 중복될 수 없습니다")
        known = set(steps)
        for item in self.plan:
            if any(dep not in known or dep >= item.step for dep in item.depends_on):
                raise ValueError("depends_on은 존재하는 이전 단계만 참조해야 합니다")
        plan_tools = {item.tool for item in self.plan}
        if self.plan and not self.tools:
            raise ValueError("plan이 있으면 tools를 비워 둘 수 없습니다")
        if self.tools and not plan_tools.issubset(set(self.tools)):
            raise ValueError("tools에 plan에서 사용하는 도구가 모두 포함되어야 합니다")
        return self


class ProductCandidate(BaseModel):
    product_code: str
    product_name: str
    score: int = 0


class ProductResolution(BaseModel):
    status: Literal["exact", "alias", "ambiguous", "not_found", "not_applicable"]
    raw_text: str
    candidates: list[ProductCandidate] = Field(default_factory=list)
    reason: str


class PreRouteDecision(BaseModel):
    route: Literal["FAST_POLICY", "FAST_STRUCTURED", "SIMPLE_DOCUMENT", "AGENT"]
    reasons: list[str] = Field(default_factory=list)
    safety_flags: list[str] = Field(default_factory=list)
    template_id: str | None = None
    needs_query_llm: bool = False
    needs_answer_llm: bool = False
    needs_validator_llm: bool = False


class RiskDecision(BaseModel):
    level: Literal["LOW", "HIGH"]
    reasons: list[str] = Field(default_factory=list)
    requires_llm_validation: bool = False


class ValidationErrorItem(BaseModel):
    criterion: str
    problem: str
    correction: str
    claim_id: str | None = None
    evidence_id: str | None = None


class ValidationResult(BaseModel):
    status: Literal["PASS", "FAIL"]
    retry_action: Literal[
        "NONE", "RESOLVE_PRODUCT", "REQUERY_DATA", "RECALCULATE",
        "RETRIEVE_MORE", "REGENERATE", "SAFE_FALLBACK",
    ]
    errors: list[ValidationErrorItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_consistency(self):
        if self.status == "PASS" and (self.errors or self.retry_action != "NONE"):
            raise ValueError("PASS는 오류가 없어야 하고 retry_action은 NONE이어야 합니다")
        if self.status == "FAIL" and not self.errors:
            raise ValueError("FAIL은 하나 이상의 오류가 필요합니다")
        return self
