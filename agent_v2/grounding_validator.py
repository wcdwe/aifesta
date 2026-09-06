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
    MissingEvidenceQuery,
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


_RE_DOC_NUM = re.compile(r"^doc0*(\d+)$")


def _doc_number(source: str) -> str | None:
    """doc23/DOC00023처럼 실제 doc_id는 같아도 0패딩·대소문자 표기가 갈릴
    때가 있다(관측: evidence.source="doc23"인데 LLM이 답변에 "DOC00023"
    으로 씀 - 인용한 문서 자체는 맞는데 0패딩만 다름). institution
    문서의 "doc+숫자" 형태에만 한정한다 - product 문서 파일명
    (R2_KR5153420063.pdf 등)에 이걸 적용하면 안에 섞인 다른 숫자로
    엉뚱한 문서를 같은 문서로 오인할 수 있다."""
    match = _RE_DOC_NUM.match(source)
    return str(int(match.group(1))) if match else None


def _source_page_pairs(evidence: Iterable[Evidence]) -> set[tuple[str, int]]:
    pairs: set[tuple[str, int]] = set()
    for item in evidence:
        if item.page is None:
            continue
        source = item.source.strip().lower()
        pairs.add((source, item.page))
        # 답변에는 전체 경로 대신 파일명 또는 doc id만 쓰기도 한다.
        pairs.add((source.replace("\\", "/").rsplit("/", 1)[-1], item.page))
        number = _doc_number(source)
        if number is not None:
            pairs.add((number, item.page))
    return pairs


def _citation_errors(answer: str, evidence: list[Evidence]) -> list[ValidationErrorItem]:
    available = _source_page_pairs(evidence)
    errors: list[ValidationErrorItem] = []
    if any(item.kind == "document" for item in evidence) and not RE_CITATION.search(answer or ""):
        errors.append(_error(
            "근거 완전성",
            "문서 기반 핵심 주장에 출처·페이지가 연결되지 않음",
            "각 핵심 주장 끝에 실제 Evidence의 source와 page를 하나씩 표시",
        ))
        return errors
    for source, page_text in RE_CITATION.findall(answer or ""):
        page = int(page_text)
        normalized = source.strip(" []").lower()
        number = _doc_number(normalized)
        if not any(page == p and (normalized == s or (number is not None and number == s))
                   for s, p in available):
            errors.append(_error(
                "근거 완전성",
                f"답변의 출처·페이지를 검색 근거에서 확인할 수 없음: {source.strip()}, p.{page}",
                "실제 검색된 문서명과 페이지로 고치거나 해당 인용을 제거",
            ))
    return errors


def _bound_claim_errors(answer, evidence):
    """Check each cited clause against its own evidence, not the union of values.

    This is a numeric/source check, not a proof of semantic entailment; document
    synthesis additionally goes through the semantic validation gate.
    """
    errors = []
    for match in re.finditer(r"([^\n]+?)\(출처:\s*([^(),]+),\s*p\.?\s*(\d+)\)", answer):
        clause, source, page = match[1], match[2].strip().lower(), int(match[3])
        scoped = [e for e in evidence if e.page == page and
                  source in {e.source.lower(), e.source.replace('\\', '/').rsplit('/', 1)[-1].lower()}]
        if not scoped: continue  # handled by the citation validator
        mentioned_codes = set(re.findall(r"KR[A-Z0-9]{10}", clause))
        if mentioned_codes:
            scoped = [e for e in scoped if not e.product_code or e.product_code in mentioned_codes]
        # Numeric tokens in product names are identifiers, not asserted values.
        cleaned = clause
        for ev in evidence:
            name = ev.data.get("product_name")
            if name: cleaned = cleaned.replace(name, "")
        local_text = "\n".join(e.content + " " + str(e.data) for e in scoped)
        bad = check_numbers(cleaned, local_text)
        if bad or not scoped:
            errors.append(_error("정확성", f"주장에 연결된 상품·출처 범위와 수치 불일치: {bad}",
                                 "해당 상품·클래스·지표의 직접 근거로 수치와 인용을 함께 수정"))
    # Typed facts permit stricter metric binding for common numeric claims.
    patterns = {"risk_level": r"위험\s*등급\s*(?:은|이|:)?\s*([1-6])\s*등급",
                "total_fee": r"총\s*보수(?![·ㆍ\s]*비용)\s*(?:은|는|:)?\s*(?:연\s*)?([0-9.]+)\s*%",
                "total_fee_and_cost": r"총\s*보수[·ㆍ\s]*비용\s*(?:은|는|:)?\s*([0-9.]+)\s*%"}
    for line in answer.splitlines():
        for metric, pattern in patterns.items():
            for m in re.finditer(pattern, line):
                candidates = [e for e in evidence if e.data.get("metric") == metric]
                named = [e for e in candidates if (e.product_code and e.product_code in line) or
                         (e.data.get("product_name") and e.data["product_name"] in line)]
                if named: candidates = named
                classes = re.findall(r"([A-Za-z][A-Za-z0-9-]*)\s*클래스", line)
                if classes: candidates = [e for e in candidates if e.class_code in classes]
                if candidates and not any(e.data.get("value") is not None and float(e.data["value"]) == float(m[1]) for e in candidates):
                    errors.append(_error("정확성", f"상품·클래스별 {metric} 값 불일치", "동일 상품·클래스·지표의 값만 사용"))
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
    errors.extend(_bound_claim_errors(answer, evidence))

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
    filter_evidence = [item for item in evidence if item.evidence_id.startswith("FILTER-") or
                       (item.data.get("tool") == "FILTER" and item.data.get("query_result", {}).get("count", 0) > 0)]
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
    missing_queries = []
    if action == "RETRIEVE_MORE":
        codes = plan.entities.get("anchor_product_codes") or []
        source_type = "product" if codes and "RAG" in plan.tools else (
            "structured" if set(plan.tools) & {"FACT", "FILTER", "COMPARE"} else "institution"
        )
        missing_queries.append(MissingEvidenceQuery(
            source_type=source_type,
            product_code=codes[0] if source_type == "product" and len(codes) == 1 else None,
            query=question,
            required_fact=", ".join(plan.required_facts),
        ))
    return ValidationResult(
        status="FAIL", retry_action=action, errors=errors,
        missing_evidence_queries=missing_queries,
    )
