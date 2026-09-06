from __future__ import annotations

from .schemas import ContextBundle, Evidence, QueryPlan, ToolExecutionResult


DEFAULT_CHAR_BUDGET = 8000


def _priority(evidence: Evidence) -> tuple[int, str]:
    order = {"calculation": 0, "structured": 1, "resolution": 2, "document": 3, "policy": 4}
    return order.get(evidence.kind, 9), evidence.evidence_id


def _render(evidence: Evidence) -> str:
    scope = []
    if evidence.product_code:
        scope.append(f"상품코드={evidence.product_code}")
    if evidence.class_code:
        scope.append(f"클래스={evidence.class_code}")
    if evidence.page is not None:
        scope.append(f"p.{evidence.page}")
    suffix = f" | {' | '.join(scope)}" if scope else ""
    return f"[{evidence.evidence_id} | {evidence.kind} | {evidence.source}{suffix}]\n{evidence.content}"


def build_context(plan: QueryPlan, execution: ToolExecutionResult,
                  char_budget: int = DEFAULT_CHAR_BUDGET) -> ContextBundle:
    """근거를 중복 없이 우선순위대로 조립하고 예산 초과를 명시한다."""
    unique: dict[tuple, Evidence] = {}
    for item in execution.evidence:
        key = (
            item.kind, item.source, item.product_code, item.class_code,
            item.page, item.content.strip(),
        )
        unique.setdefault(key, item)

    parts: list[str] = []
    used: list[str] = []
    omitted: list[str] = []
    size = 0
    for item in sorted(unique.values(), key=_priority):
        rendered = _render(item)
        extra = len(rendered) + (6 if parts else 0)
        if parts and size + extra > char_budget:
            omitted.append(item.evidence_id)
            continue
        # 첫 근거 하나는 예산보다 길어도 통째로 유지한다. 중간에서 잘라
        # 숫자·조건을 훼손하는 것보다 명시적 초과가 안전하다.
        parts.append(rendered)
        used.append(item.evidence_id)
        size += extra

    header = (
        f"[PLAN] intents={plan.intents}; required_facts={plan.required_facts}; "
        f"completeness={plan.completeness}\n"
    )
    text = header + "\n---\n".join(parts)
    return ContextBundle(
        text=text,
        evidence_ids=used,
        omitted_evidence_ids=omitted,
        char_count=len(text),
        truncated=bool(omitted),
    )
