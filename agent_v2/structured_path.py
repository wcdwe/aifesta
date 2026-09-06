from __future__ import annotations

from typing import Any

from scripts.product_facts import detect_intents, product_facts
from scripts.product_lookup import find_class_code

from .product_resolver import resolve_product


STRUCTURED_INTENTS = {
    "fee", "return", "risk", "aum", "cost_projection",
    "fee_breakdown", "eligibility", "identity",
}


def _validate_result(summary: Any, evidence: Any, product_code: str) -> list[str]:
    """DB 템플릿 결과의 확정 오류만 검사한다.

    이 경로는 LLM을 쓰지 않으므로 환각 검사는 필요하지 않다. 대신 빈 결과,
    출처 없는 결과, 다른 상품코드의 근거가 섞이는 오류를 반환 전에 차단한다.
    """
    errors: list[str] = []
    if not isinstance(summary, str) or not summary.strip():
        errors.append("정형 조회 결과가 비어 있음")
    if not isinstance(evidence, list) or not evidence:
        errors.append("정형 조회 근거가 없음")
    else:
        wrong_codes = [
            item for item in evidence
            if isinstance(item, dict)
            and item.get("product_code")
            and item.get("product_code") != product_code
        ]
        if wrong_codes:
            errors.append("다른 상품코드의 근거가 포함됨")
    return errors


def try_fast_structured(question_id: str, question: str) -> dict | None:
    """명확한 단일 상품 정형 질문을 LLM 없이 처리한다.

    상품이 없거나 여러 후보이면 여기서 임의 선택하지 않고 기존 Agent 경로로
    돌려보낸다. 따라서 이 함수의 반환값 None은 실패가 아니라 안전한 이관이다.
    """
    resolution = resolve_product(question)
    if resolution.status not in {"exact", "alias"} or len(resolution.candidates) != 1:
        return None

    intents = detect_intents(question)
    if not set(intents) & STRUCTURED_INTENTS:
        return None

    candidate = resolution.candidates[0]
    class_code = find_class_code(question)
    summary, evidence = product_facts(candidate.product_code, class_code, intents)
    errors = _validate_result(summary, evidence, candidate.product_code)
    if errors:
        return None
    if class_code and {"fee", "risk"}.issubset(set(intents)):
        summary += (
            f"\n※ 위험등급은 상품 기준이며, 총보수는 {class_code} 클래스 기준입니다."
        )

    return {
        "question_id": str(question_id),
        "question": str(question),
        "retrieved_context": str(summary),
        "think_trace": (
            "1. Python Pre-router: FAST_STRUCTURED\n"
            f"2. 상품 식별: {resolution.status} - {candidate.product_code} "
            f"({candidate.product_name})\n"
            f"3. 정형 DB 조회: intents={intents}, class={class_code or '전체'}\n"
            f"4. Python 근거 검증: PASS (근거 {len(evidence)}건)\n"
            "5. 승인된 DB 답변 템플릿 사용; LLM 호출 없음"
        ),
        "answer": str(summary),
        # 기존 평가·호출자와의 하위 호환을 유지한다.
        "route": "single_product",
    }
