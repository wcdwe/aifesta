from __future__ import annotations

from .schemas import PreRouteDecision


TEMPLATES = {
    "conflicting_risk_return": (
        "펀드는 운용 결과에 따라 원금손실이 발생할 수 있어, 원금손실을 허용하지 않는 조건과 "
        "가장 높은 수익률을 동시에 보장하는 상품을 선정할 수는 없습니다. 현재 자료에서는 상품의 "
        "자산유형·위험등급·보수·과거 수익률을 비교할 수 있지만, 과거 수익률은 미래 성과를 보장하지 "
        "않습니다. 원금보전을 최우선으로 한다면 펀드 수익률 순위보다 원리금보장 여부를 먼저 확인해야 "
        "합니다. 계좌 유형과 투자기간을 알려주시면 확인 가능한 조건을 기준으로 후보군을 비교할 수 있습니다."
    ),
    "recommendation_missing_profile": (
        "현재 정보만으로 특정 상품 하나를 적합하다고 확정하기는 어렵습니다. 제공된 자료에서는 자산유형, "
        "위험등급, 클래스별 보수, 과거 수익률과 상품별 AUM을 기준으로 후보를 비교할 수 있습니다. "
        "정확한 조건별 비교를 위해 계좌 유형, 투자기간, 원금손실 감내수준을 알려주세요."
    ),
}


def build_policy_payload(question_id: str, question: str, decision: PreRouteDecision) -> dict:
    answer = TEMPLATES[decision.template_id]
    return {
        "question_id": question_id,
        "question": question,
        "retrieved_context": "(승인된 추천 안전정책 템플릿 사용; 상품 검색 및 LLM 호출 없음)",
        "think_trace": (
            f"1. Python Pre-router: {decision.route}\n"
            f"2. 안전 플래그: {decision.safety_flags}\n"
            "3. 승인된 조건부 답변 템플릿 사용; 유료 LLM 호출 없음"
        ),
        "answer": answer,
        "route": "fast_policy",
    }

