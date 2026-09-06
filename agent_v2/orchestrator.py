from __future__ import annotations

from typing import Callable

from .answer_generator import GenerationOutcome, generate_answer
from .context_builder import build_context
from .executor import execute_plan
from .query_analyzer import AnalysisOutcome, analyze
from .schemas import QueryPlan, ToolExecutionResult
from .validation_gate import RepairResult, run_validation_gate
from .rule_planner import build_rule_plan


Analyzer = Callable[[str], AnalysisOutcome]
Executor = Callable[[str, QueryPlan], ToolExecutionResult]
Generator = Callable[..., GenerationOutcome]


def _trace(plan: QueryPlan, execution: ToolExecutionResult, generation: str, gate) -> str:
    tools = ", ".join(plan.tools) or "없음"
    py_status = gate.python_validation.status
    llm_status = gate.llm_validation.status if gate.llm_validation else "생략"
    return (
        f"1. QueryPlan 검증 완료: intents={plan.intents}\n"
        f"2. 도구 실행: {tools}, status={execution.status}\n"
        f"3. 근거 조립: {len(execution.evidence)}건\n"
        f"4. 답변 생성: {generation}\n"
        f"5. Python 근거·안전 검증: {py_status}\n"
        f"6. 고위험 검증 LLM: {llm_status}\n"
        f"7. 재처리 횟수: {gate.retry_count}, 최종={gate.status}"
    )


def try_agent_payload(
    question_id: str,
    question: str,
    *,
    analyzer: Analyzer = analyze,
    executor: Executor = execute_plan,
    generator: Generator = generate_answer,
    llm_validator=None,
) -> dict | None:
    """복합 질문용 새 Agent. 분석/생성 불가 시 기존 경로 사용을 위해 None."""
    analysis = analyzer(question)
    plan = analysis.plan
    plan_origin = analysis.status
    if plan is None:
        plan = build_rule_plan(question)
        plan_origin = f"{analysis.status}; Python 규칙 QueryPlan fallback"
    if plan is None:
        return None
    execution = executor(question, plan)
    if not execution.evidence:
        return None
    context = build_context(plan, execution)
    generated = generator(question, plan, context)
    if not generated.answer:
        return None

    def repair(action, errors):
        current_execution = execution
        current_context = context
        if action in {"RESOLVE_PRODUCT", "REQUERY_DATA", "RECALCULATE", "RETRIEVE_MORE"}:
            current_execution = executor(question, plan)
            if not current_execution.evidence:
                return None
            budget = 14000 if action == "RETRIEVE_MORE" else 8000
            current_context = build_context(plan, current_execution, char_budget=budget)
        retry = generator(question, plan, current_context, errors=errors)
        if not retry.answer:
            return None
        return RepairResult(retry.answer, current_execution.evidence, current_context)

    gate_kwargs = {"repair_handler": repair}
    if llm_validator is not None:
        gate_kwargs["llm_validator"] = llm_validator
    gate = run_validation_gate(
        question, generated.answer, plan, execution.evidence, context,
        answer_source="LLM", **gate_kwargs,
    )
    return {
        "question_id": str(question_id),
        "question": str(question),
        "retrieved_context": str(gate.context.text),
        "think_trace": f"0. 계획 출처: {plan_origin}\n" + _trace(
            plan, execution, generated.status, gate
        ),
        "answer": str(gate.answer),
        "route": "agent_v2",
    }
