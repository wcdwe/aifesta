from __future__ import annotations

import re

from scripts.product_facts import detect_intents
from scripts.product_lookup import find_products

from .schemas import PreRouteDecision, RiskDecision


_RECOMMENDATION = re.compile(r"추천|골라|선택해|어떤\s*상품이\s*(좋|나아)")
_VAGUE_PRODUCT_REQUEST = re.compile(r"어떤\s*(상품|펀드)(이|가)?\s*(좋|나아)")
_LOSS_INTOLERANCE = re.compile(r"원금\s*손실.*(싫|안\s*돼|없)|손실.*절대|절대.*손실")
_GUARANTEED_RETURN = re.compile(r"무조건.*(수익|벌)|수익.*보장|절대.*(오르|수익)")
_LOW_RISK_HIGH_RETURN = re.compile(
    r"((위험|손실).{0,15}(낮|적|없).{0,25}(수익률|수익).{0,12}(높|최고|가장))"
    r"|((수익률|수익).{0,12}(높|최고|가장).{0,25}(위험|손실).{0,15}(낮|적|없))"
)
_PROFILE = re.compile(r"\d{2,3}\s*세|IRP|DC|DB|연금저축|\d+\s*년|장기|단기|손실.*감수|중위험|고위험|저위험")
_DOCUMENT = re.compile(
    r"절차|방법|어떻게|뜻|의미|왜|위험요인|투자전략|원금보장|세제|세액공제|"
    r"만기\s*상환|재예치"
)
_COMPLEX = re.compile(r"비교|차이|각각|동시에|이면서|그리고|까지|모두")
_FILTER_FIELD = re.compile(r"IRP|DC|연금저축|채권형|주식형|위험등급|총보수|수익률|AUM|설정액", re.I)
_FILTER_OPERATION = re.compile(r"모두|전부|상위\s*\d+|이상|이하|초과|미만|존재|있는\s*상품|낮은\s*순|높은\s*순")
_COMPARE = re.compile(r"비교|차이|각각|섞지\s*말")


def pre_route(question: str) -> PreRouteDecision:
    text = question or ""
    flags = []
    if _LOSS_INTOLERANCE.search(text):
        flags.append("loss_intolerance")
    if _GUARANTEED_RETURN.search(text):
        flags.append("guaranteed_return")
    if _LOW_RISK_HIGH_RETURN.search(text):
        flags.append("risk_return_conflict")

    recommendation = bool(_RECOMMENDATION.search(text))
    if recommendation and ("loss_intolerance" in flags or "risk_return_conflict" in flags):
        return PreRouteDecision(
            route="FAST_POLICY",
            reasons=["추천 요청에 원금손실 회피 또는 위험·수익 충돌 조건이 포함됨"],
            safety_flags=flags,
            template_id="conflicting_risk_return",
        )
    if recommendation and _VAGUE_PRODUCT_REQUEST.search(text) and not _PROFILE.search(text):
        return PreRouteDecision(
            route="FAST_POLICY",
            reasons=["개인화 추천에 필요한 계좌·기간·손실감내 정보가 없음"],
            safety_flags=[*flags, "insufficient_recommendation_context"],
            template_id="recommendation_missing_profile",
        )

    products = find_products(text)
    intents = detect_intents(text)
    if len(products) >= 2 and _COMPARE.search(text):
        return PreRouteDecision(
            route="FAST_COMPARE",
            reasons=["복수 상품과 비교 항목을 Python 규칙으로 확정 가능"],
        )
    if _FILTER_FIELD.search(text) and _FILTER_OPERATION.search(text):
        return PreRouteDecision(
            route="FAST_FILTER",
            reasons=["상품 조건·값 존재·전체/정렬 요구를 Python 규칙으로 확정 가능"],
        )
    if len(products) == 1 and intents and not _COMPLEX.search(text):
        return PreRouteDecision(
            route="FAST_STRUCTURED",
            reasons=["단일 상품과 정형 조회 항목을 규칙으로 확정 가능"],
        )
    if _DOCUMENT.search(text) and not _COMPLEX.search(text):
        return PreRouteDecision(
            route="SIMPLE_DOCUMENT",
            reasons=["단일 문서 설명·절차 질문"],
            needs_answer_llm=True,
        )
    return PreRouteDecision(
        route="AGENT",
        reasons=["복합 질문이거나 규칙만으로 실행 계획을 확정하기 어려움"],
        needs_query_llm=True,
        needs_answer_llm=True,
    )


def assess_risk(intents: list[str], safety_flags: list[str], answer_source: str) -> RiskDecision:
    reasons = []
    normalized_intents = {item.replace(" ", "").lower() for item in intents}
    if any("추천" in item or "세제" in item or "tax" in item for item in normalized_intents):
        reasons.append("고위험 의도")
    if set(safety_flags) & {
        "principal_guarantee", "loss_intolerance", "guaranteed_return",
        "future_prediction", "risk_return_conflict", "recent_performance_only",
    }:
        reasons.append("금융 안전성 검토 필요")
    requires = bool(reasons) and answer_source == "LLM"
    return RiskDecision(
        level="HIGH" if reasons else "LOW",
        reasons=reasons,
        requires_llm_validation=requires,
    )
