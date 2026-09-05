from __future__ import annotations

import json
import re
from dataclasses import dataclass

from pydantic import ValidationError

from scripts.hcx import HcxError, chat, is_configured

from .prompts import QUERY_ANALYZER_PROMPT
from .schemas import QueryPlan


PLAN_SHAPE = """반환 JSON 필드:
{
 "intents":[], "entities":{},
 "product_mentions":[{"text":"질문 속 표현","role":"single|comparison_left|comparison_right|filter_target","resolution_required":true}],
 "required_facts":[],
 "filters":[{"field":"필드명","operator":"eq|ne|lt|lte|gt|gte|in|contains|is_null|is_not_null","value":null,"source_text":"질문 속 조건"}],
 "metrics":[], "periods":[], "sort":[{"field":"필드명","direction":"asc|desc"}],
 "limit":null, "return_all":false,
 "missing":{"for_personalization":[],"from_evidence":[]},
 "gap_types":[], "answerable_now":true, "follow_ups":[], "safety_flags":[],
 "tools":[], "completeness":"single_answer|all_matches|all_steps",
 "plan":[{"step":1,"tool":"RESOLVE|FACT|FILTER|COMPARE|RAG|TAX|POLICY","purpose":"","depends_on":[]}]
}
필수 규칙:
- intents는 1개 이상. product_mentions에는 질문에 직접 나온 펀드·상품명만 넣고 IRP·조건 문장은 넣지 않는다.
- 모든 filter에는 질문의 연속된 원문인 source_text가 필수다. metrics는 문자열만 넣는다.
- "값 존재" 조건은 filters에 operator=is_not_null로 넣는다. 정렬 표현이 질문에 없으면 sort=[]이다.
- tools에는 plan에서 쓴 도구를 모두 넣고, plan은 필요한 도구별 단계를 빠짐없이 둔다.
예: "IRP에서 투자 가능하고 채권형이며 5년 수익률이 있는 상품 모두"는
intents=["조건검색"], product_mentions=[], filters=[
{field:"account_type",operator:"eq",value:"IRP",source_text:"IRP에서 투자 가능"},
{field:"asset_type",operator:"eq",value:"채권형",source_text:"채권형"},
{field:"return_5y",operator:"is_not_null",value:null,source_text:"5년 수익률이 있는"}],
metrics=["return_5y"], periods=["5년"], return_all=true, tools=["FILTER"], completeness="all_matches"다."""


@dataclass(frozen=True)
class AnalysisOutcome:
    plan: QueryPlan | None
    status: str
    raw: str = ""


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start:end + 1])
    except (ValueError, TypeError):
        return None
    return value if isinstance(value, dict) else None


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", text or "").lower()


def _preserves_question(plan: QueryPlan, question: str) -> list[str]:
    """질문에 없는 상품 표현·필터 원문을 분석기가 새로 만들지 못하게 한다."""
    q = _norm(question)
    errors = []
    for mention in plan.product_mentions:
        if _norm(mention.text) not in q:
            errors.append(f"질문에 없는 상품 표현: {mention.text}")
    for item in plan.filters:
        if item.source_text and _norm(item.source_text) not in q:
            errors.append(f"질문에 없는 필터 원문: {item.source_text}")
    return errors


def parse_plan(text: str, question: str) -> AnalysisOutcome:
    data = _extract_json(text)
    if data is None:
        return AnalysisOutcome(None, "JSON 객체를 찾지 못해 폐기", text)
    try:
        plan = QueryPlan.model_validate(data)
    except ValidationError as exc:
        details = [
            {"loc": ".".join(map(str, item["loc"])), "msg": item["msg"]}
            for item in exc.errors()[:3]
        ]
        return AnalysisOutcome(
            None,
            f"Pydantic 스키마 불일치로 폐기: {exc.error_count()}건 {details}",
            text,
        )
    preservation_errors = _preserves_question(plan, question)
    if preservation_errors:
        return AnalysisOutcome(None, f"질문 의미 보존 실패로 폐기: {preservation_errors[:2]}", text)
    if len(plan.product_mentions) >= 2 and not ({"COMPARE", "RAG"} & set(plan.tools)):
        return AnalysisOutcome(None, "복수 상품 계획에 COMPARE 또는 RAG가 없어 폐기", text)
    if not plan.intents:
        return AnalysisOutcome(None, "intent가 비어 있어 실행계획으로 사용할 수 없어 폐기", text)
    return AnalysisOutcome(plan, "HCX QueryPlan 검증 통과", text)


def analyze(question: str, max_tokens: int = 1000) -> AnalysisOutcome:
    if not (question or "").strip():
        return AnalysisOutcome(None, "빈 질문이라 분석 생략")
    if not is_configured():
        return AnalysisOutcome(None, "HCX 키가 없어 규칙 경로 사용")
    messages = [
        {"role": "system", "content": QUERY_ANALYZER_PROMPT + "\n\n" + PLAN_SHAPE},
        {"role": "user", "content": question},
    ]
    try:
        raw = chat(messages, max_tokens=max_tokens, temperature=0.0)
    except HcxError as exc:
        return AnalysisOutcome(None, f"HCX 분석 실패로 규칙 경로 사용: {exc}")
    return parse_plan(raw, question)
