from __future__ import annotations

import re
from collections.abc import Iterable

from scripts.answer_llm import (
    check_asks_back,
    check_claims,
    check_numbers,
    check_question_coverage,
    check_recommendation,
)

from .schemas import (
    ContextBundle,
    Evidence,
    QueryPlan,
    ValidationErrorItem,
    ValidationResult,
)


RE_CLASS = re.compile(
    r"(?<![A-Za-z0-9])(?:A|A-e|C|C-e|C-P|C-Pe|C-P2|C-P2e|C-RP|C-RPe|S)(?![A-Za-z0-9])",
    re.IGNORECASE,
)
RE_CITATION = re.compile(r"(?:출처\s*:\s*)?([^()\n,]{1,100}?),?\s*p\.?\s*(\d+)", re.IGNORECASE)
RE_GUARANTEE = re.compile(
    r"원금(?:이|은)?\s*(?:절대\s*)?(?:보장|손실(?:이|은)?\s*없)|"
    r"손실\s*(?:가능성이|위험이)?\s*없|수익률(?:이|은)?\s*보장"
)
RE_UNIVERSAL = re.compile(r"(?:조건에 맞는|해당하는)?\s*(?:상품|펀드)?\s*(?:을|를)?\s*(모두|전부|전체)")
RE_LOWEST_RISK_ERROR = re.compile(r"1등급[^.!?\n]{0,30}(?:가장\s*(?:낮은|안전)|최저\s*위험)")
RE_HIGHEST_RISK_ERROR = re.compile(r"6등급[^.!?\n]{0,30}(?:가장\s*(?:높은|위험)|최고\s*위험)")
RE_NO_RESULTS = re.compile(r"찾을\s*수\s*없|해당\s*(?:상품|펀드).{0,10}없|검색\s*결과.{0,10}없")
RE_UNSUPPORTED_SCOPE = re.compile(r"일반\s*가입\s*기준|대표\s*클래스|기본\s*클래스|통상적인\s*조건")


def _error(criterion: str, problem: str, correction: str,
           evidence_id: str | None = None) -> ValidationErrorItem:
    return ValidationErrorItem(
        criterion=criterion,
        problem=problem,
        correction=correction,
        evidence_id=evidence_id,
    )


def _source_page_pairs(evidence: Iterable[Evidence]) -> set[tuple[str, int]]:
    pairs: set[tuple[str, int]] = set()
    for item in evidence:
        if item.page is None:
            continue
        source = item.source.strip().lower()
        pairs.add((source, item.page))
        # 답변에는 전체 경로 대신 파일명 또는 doc id만 쓰기도 한다.
        pairs.add((source.replace("\\", "/").rsplit("/", 1)[-1], item.page))
    return pairs


def _citation_errors(answer: str, evidence: list[Evidence]) -> list[ValidationErrorItem]:
    available = _source_page_pairs(evidence)
    errors: list[ValidationErrorItem] = []
    for source, page_text in RE_CITATION.findall(answer or ""):
        page = int(page_text)
        normalized = source.strip(" []").lower()
        if not any(
            page == p and (normalized == s or normalized in s or s in normalized)
            for s, p in available
        ):
            errors.append(_error(
                "근거 완전성",
                f"답변의 출처·페이지를 검색 근거에서 확인할 수 없음: {source.strip()}, p.{page}",
                "실제 검색된 문서명과 페이지로 고치거나 해당 인용을 제거",
            ))
    return errors


def _class_errors(answer: str, evidence: list[Evidence]) -> list[ValidationErrorItem]:
    mentioned = {m.group(0).lower() for m in RE_CLASS.finditer(answer or "")}
    supported = {e.class_code.lower() for e in evidence if e.class_code}
    # 구조화 근거의 본문/데이터에 명시된 클래스도 허용한다.
    hay = "\n".join(e.content + " " + str(e.data) for e in evidence).lower()
    unsupported = sorted(c for c in mentioned if c not in supported and c not in hay)
    if not unsupported:
        return []
    return [_error(
        "정확성",
        f"근거에 없는 판매 클래스 언급: {unsupported}",
        "상품과 클래스 범위를 다시 조회하고 확인된 클래스만 사용",
    )]


def _metric_errors(answer: str, evidence: list[Evidence]) -> list[ValidationErrorItem]:
    text = (answer or "").replace(" ", "")
    hay = "\n".join(e.content + " " + str(e.data) for e in evidence).replace(" ", "")
    errors: list[ValidationErrorItem] = []
    says_cost = "총보수·비용" in text or "총보수비용" in text
    has_cost = "총보수·비용" in hay or "총보수비용" in hay or "total_cost" in hay
    if says_cost and not has_cost:
        errors.append(_error(
            "정확성", "총보수 근거를 총보수·비용으로 바꾸어 표현함",
            "총보수와 총보수·비용을 구분하여 근거의 지표명을 그대로 사용",
        ))
    return errors


def _period_errors(answer: str, plan: QueryPlan) -> list[ValidationErrorItem]:
    if not plan.periods or not any("return" in metric.lower() or "수익률" in metric for metric in plan.metrics):
        return []
    normalized = (answer or "").replace(" ", "")
    missing = [period for period in plan.periods if period.replace(" ", "") not in normalized]
    if not missing:
        return []
    return [_error(
        "정확성", f"요청한 수익률 기간을 답변에서 확인할 수 없음: {missing}",
        "수익률 값과 함께 질문에서 요구한 기간을 명시",
    )]


def validate_grounding(
    question: str,
    answer: str,
    plan: QueryPlan,
    evidence: list[Evidence],
    context: ContextBundle,
) -> ValidationResult:
    """LLM 판단 전에 실행하는 결정론적 근거·안전 검증.

    이 함수의 FAIL은 검증 LLM이 덮어쓸 수 없다. 호출부는 retry_action에
    따라 최대 한 번만 재처리해야 한다.
    """
    errors: list[ValidationErrorItem] = []
    evidence_text = "\n".join(e.content + " " + str(e.data) for e in evidence)
    grounded_text = context.text + "\n" + evidence_text

    bad_numbers = check_numbers(answer, grounded_text)
    if bad_numbers:
        errors.append(_error(
            "정확성", f"근거에 없는 숫자 사용: {bad_numbers[:8]}",
            "숫자를 근거의 값 그대로 사용하고 계산값은 계산기 결과만 사용",
        ))
    bad_codes = check_claims(answer, grounded_text)
    if bad_codes:
        errors.append(_error(
            "근거 기반 답변", f"근거에 없는 상품코드 언급: {bad_codes[:8]}",
            "상품을 다시 식별하거나 근거에 존재하는 상품코드만 사용",
        ))

    errors.extend(_class_errors(answer, evidence))
    errors.extend(_citation_errors(answer, evidence))
    errors.extend(_metric_errors(answer, evidence))
    errors.extend(_period_errors(answer, plan))

    missing = check_question_coverage(question, answer)
    if missing:
        errors.append(_error(
            "요구사항 충족", f"질문이 요구한 항목 미반영: {missing}",
            "누락 항목의 근거를 보강한 뒤 답변에 포함",
        ))
    if check_asks_back(answer) and len(answer.strip()) < 180:
        errors.append(_error(
            "정보한계 대응", "현재 답변 가능한 내용 없이 확인 질문 위주로 종료함",
            "확인 가능한 일반·조건별 내용을 먼저 답하고 최소 확인사항을 마지막에 안내",
        ))
    if check_recommendation(answer):
        errors.append(_error(
            "안전성 및 신뢰성", "특정 상품을 단정적으로 추천하거나 매수를 권유함",
            "확인된 비교 결과와 조건을 제시하고 최종 선택을 단정하지 않기",
        ))
    filter_evidence = [item for item in evidence if item.evidence_id.startswith("FILTER-")]
    if filter_evidence and RE_NO_RESULTS.search(answer or ""):
        errors.append(_error(
            "정확성", "구조화 FILTER 결과가 존재하지만 검색 결과가 없다고 답함",
            "FILTER 결과의 상품을 답변하거나 조건·결과 개수를 다시 확인",
        ))
    if RE_UNSUPPORTED_SCOPE.search(answer or "") and not RE_UNSUPPORTED_SCOPE.search(evidence_text):
        errors.append(_error(
            "정확성", "근거에 없는 대표·일반 가입 범위를 임의로 추가함",
            "실제 클래스의 계좌 유형·판매 채널만 명시",
        ))
    if RE_GUARANTEE.search(answer or "") and not RE_GUARANTEE.search(evidence_text):
        errors.append(_error(
            "안전성 및 신뢰성", "근거 없이 원금 또는 수익 보장을 단정함",
            "보장 표현을 제거하고 근거에 있는 손실 가능성과 조건만 설명",
        ))
    if RE_LOWEST_RISK_ERROR.search(answer or "") or RE_HIGHEST_RISK_ERROR.search(answer or ""):
        errors.append(_error(
            "정확성", "위험등급 숫자의 방향을 반대로 설명함",
            "위험등급 체계를 근거에서 재확인하여 등급과 위험도를 올바르게 연결",
        ))
    if context.truncated and (plan.return_all or plan.completeness == "all_matches") \
            and RE_UNIVERSAL.search(answer or ""):
        errors.append(_error(
            "근거 완전성", "일부 근거가 생략됐는데 결과가 전체라고 단정함",
            "RETRIEVE_MORE로 생략 근거를 포함하거나 전체라는 표현을 제거",
        ))

    if not errors:
        return ValidationResult(status="PASS", retry_action="NONE", errors=[])

    if context.truncated and any(e.criterion in {"근거 완전성", "요구사항 충족"} for e in errors):
        action = "RETRIEVE_MORE"
    elif any("상품코드" in e.problem or "판매 클래스" in e.problem for e in errors):
        action = "RESOLVE_PRODUCT"
    elif any("원금" in e.problem or "단정적으로 추천" in e.problem for e in errors):
        action = "SAFE_FALLBACK"
    else:
        action = "REGENERATE"
    return ValidationResult(status="FAIL", retry_action=action, errors=errors)
