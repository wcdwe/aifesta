from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .grounding_validator import validate_grounding
from .pre_router import assess_risk
from .schemas import ContextBundle, Evidence, QueryPlan, RiskDecision, ValidationResult
from .validator_llm import validate_with_llm


@dataclass(frozen=True)
class RepairResult:
    answer: str
    evidence: list[Evidence]
    context: ContextBundle


@dataclass(frozen=True)
class GateOutcome:
    answer: str
    status: str
    risk: RiskDecision
    python_validation: ValidationResult
    llm_validation: ValidationResult | None
    retry_count: int
    used_safe_fallback: bool


RepairHandler = Callable[[str, list], RepairResult | None]
LlmValidator = Callable[[str, str, QueryPlan, list[Evidence], ContextBundle], ValidationResult]


def _safe_answer(evidence: list[Evidence]) -> str:
    usable = [item for item in evidence if item.content.strip()][:3]
    if not usable:
        return "제공된 자료에서 검증 가능한 근거를 확인하지 못해 답변할 수 없습니다."
    lines = ["검증을 통과한 범위의 근거만 안내드립니다."]
    for item in usable:
        citation = item.source
        if item.page is not None:
            citation += f", p.{item.page}"
        lines.append(f"- {item.content.strip()} (출처: {citation})")
    return "\n".join(lines)


def run_validation_gate(
    question: str,
    answer: str,
    plan: QueryPlan,
    evidence: list[Evidence],
    context: ContextBundle,
    *,
    answer_source: str = "LLM",
    repair_handler: RepairHandler | None = None,
    llm_validator: LlmValidator = validate_with_llm,
) -> GateOutcome:
    """Python 검증 → 위험 게이트 → 최대 1회 재처리 → 안전 답변을 강제한다."""
    risk = assess_risk(plan.intents, plan.safety_flags, answer_source)
    current_answer, current_evidence, current_context = answer, evidence, context
    retry_count = 0

    py_result = validate_grounding(
        question, current_answer, plan, current_evidence, current_context
    )
    llm_result: ValidationResult | None = None

    # Python 확정 오류는 검증 LLM으로 보내지 않는다.
    if py_result.status == "FAIL":
        if repair_handler is not None and py_result.retry_action != "SAFE_FALLBACK":
            repaired = repair_handler(py_result.retry_action, py_result.errors)
            retry_count = 1
            if repaired is not None:
                current_answer = repaired.answer
                current_evidence = repaired.evidence
                current_context = repaired.context
                py_result = validate_grounding(
                    question, current_answer, plan, current_evidence, current_context
                )
        if py_result.status == "FAIL":
            return GateOutcome(
                answer=_safe_answer(current_evidence), status="SAFE_FALLBACK", risk=risk,
                python_validation=py_result, llm_validation=None,
                retry_count=retry_count, used_safe_fallback=True,
            )

    if not risk.requires_llm_validation:
        return GateOutcome(
            answer=current_answer, status="PASS", risk=risk,
            python_validation=py_result, llm_validation=None,
            retry_count=retry_count, used_safe_fallback=False,
        )

    llm_result = llm_validator(
        question, current_answer, plan, current_evidence, current_context
    )
    if llm_result.status == "PASS":
        return GateOutcome(
            answer=current_answer, status="PASS", risk=risk,
            python_validation=py_result, llm_validation=llm_result,
            retry_count=retry_count, used_safe_fallback=False,
        )

    # 앞에서 재처리하지 않았을 때만 검증 LLM 실패를 한 번 고칠 수 있다.
    if repair_handler is not None and retry_count == 0 \
            and llm_result.retry_action != "SAFE_FALLBACK":
        repaired = repair_handler(llm_result.retry_action, llm_result.errors)
        retry_count = 1
        if repaired is not None:
            current_answer = repaired.answer
            current_evidence = repaired.evidence
            current_context = repaired.context
            py_result = validate_grounding(
                question, current_answer, plan, current_evidence, current_context
            )
            if py_result.status == "PASS":
                llm_result = llm_validator(
                    question, current_answer, plan, current_evidence, current_context
                )
                if llm_result.status == "PASS":
                    return GateOutcome(
                        answer=current_answer, status="PASS", risk=risk,
                        python_validation=py_result, llm_validation=llm_result,
                        retry_count=retry_count, used_safe_fallback=False,
                    )

    return GateOutcome(
        answer=_safe_answer(current_evidence), status="SAFE_FALLBACK", risk=risk,
        python_validation=py_result, llm_validation=llm_result,
        retry_count=retry_count, used_safe_fallback=True,
    )
