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
    evidence: list[Evidence]
    context: ContextBundle
    python_validation: ValidationResult
    llm_validation: ValidationResult | None
    retry_count: int
    used_safe_fallback: bool
    history: tuple[dict, ...] = ()


RepairHandler = Callable[..., RepairResult | None]
LlmValidator = Callable[[str, str, QueryPlan, list[Evidence], ContextBundle], ValidationResult]


def _safe_answer(evidence: list[Evidence]) -> str:
    # Do not present unvalidated generated prose or truncated raw RAG as verified.
    usable = [e for e in evidence if e.data.get("verified") and
              (e.data.get("metric") or e.kind == "policy")]
    lines = ["답변 전체의 근거 연결을 충분히 검증하지 못했습니다."]
    if usable:
        lines.append("현재 구조화 자료에서 직접 확인되는 항목은 다음과 같습니다.")
        for e in usable:
            citation = e.source + (f", p.{e.page}" if e.page is not None else "")
            lines.append(f"- {e.content} (출처: {citation})")
    else:
        lines.append("검증되지 않은 문장을 사실로 안내하지 않겠습니다. 제공된 근거만으로 요청한 결론을 확정할 수 없습니다.")
    return "\n".join(lines)


def run_validation_gate(question, answer, plan, evidence, context, *,
                        answer_source="LLM", repair_handler=None,
                        llm_validator=validate_with_llm) -> GateOutcome:
    guarded_intents = [*plan.intents, *( ["세제"] if "TAX" in plan.tools else [] )]
    risk = assess_risk(guarded_intents, plan.safety_flags, answer_source)
    current_answer, current_evidence, current_context = answer, evidence, context
    history, retry_count = [], 0
    llm_result = None
    # Python can verify identifiers/numbers, not entailment of free-form prose.
    semantic_required = answer_source == "LLM" and any(e.kind == "document" for e in evidence)
    for attempt in range(2):
        # Validation must use exactly the evidence supplied to this generation.
        visible = [e for e in current_evidence if e.evidence_id in current_context.evidence_ids]
        py_result = validate_grounding(question, current_answer, plan, visible, current_context)
        history.append({"stage": "python", "attempt": attempt,
                        **py_result.model_dump(mode="json")})
        result = py_result
        if py_result.status == "PASS" and (risk.requires_llm_validation or semantic_required):
            llm_result = llm_validator(question, current_answer, plan, visible, current_context)
            history.append({"stage": "semantic", "attempt": attempt,
                            **llm_result.model_dump(mode="json")})
            result = llm_result
        if result.status == "PASS":
            return GateOutcome(current_answer, "PASS", risk, current_evidence,
                current_context, py_result, llm_result, retry_count, False, tuple(history))
        if attempt or not repair_handler or result.retry_action == "SAFE_FALLBACK":
            break
        retry_count = 1
        # New handlers get full error/query payload and the actual previous text.
        # Keep injected two-argument test/external handlers backwards compatible.
        import inspect
        if "validation" in inspect.signature(repair_handler).parameters:
            repaired = repair_handler(result.retry_action, result.errors,
                                      validation=result, previous_answer=current_answer)
        else:
            repaired = repair_handler(result.retry_action, result.errors)
        if repaired is None:
            history.append({"stage": "repair", "attempt": 1, "status": "UNAVAILABLE"})
            break
        current_answer, current_evidence, current_context = repaired.answer, repaired.evidence, repaired.context
    return GateOutcome(_safe_answer(current_evidence), "SAFE_FALLBACK", risk,
        current_evidence, current_context, py_result, llm_result, retry_count, True, tuple(history))
