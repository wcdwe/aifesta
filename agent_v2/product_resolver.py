from __future__ import annotations

import re

from scripts.product_lookup import find_products, load_products

from .schemas import ProductCandidate, ProductResolution


_DURATION_TERMS = ("초단기", "중장기", "초장기", "장기", "단기")
_REQUEST_WORDS = {
    "알려줘", "설명해줘", "뭐야", "무엇", "상품", "펀드", "정보", "각각",
    "비교해줘", "중", "에서", "대한", "관련", "미래에셋",
}


def _norm(text: str) -> str:
    return re.sub(r"[^가-힣A-Za-z0-9]", "", text or "").lower()


def _durations(text: str) -> list[str]:
    normalized = _norm(text)
    occupied: set[int] = set()
    found: list[tuple[int, str]] = []
    # 긴 표현을 먼저 잡아 `중장기` 안의 `장기`를 별도 조건으로 오인하지 않는다.
    for term in sorted(_DURATION_TERMS, key=len, reverse=True):
        for match in re.finditer(term, normalized):
            span = set(range(match.start(), match.end()))
            if span & occupied:
                continue
            occupied.update(span)
            found.append((match.start(), term))
    return [term for _, term in sorted(found)]


def _duration(text: str) -> str | None:
    durations = _durations(text)
    return durations[0] if durations else None


def _family_candidates(question: str) -> list[ProductCandidate]:
    tokens = [
        token for token in re.findall(r"[가-힣A-Za-z0-9]+", question or "")
        if len(token) >= 2 and token not in _REQUEST_WORDS
    ]
    # 띄어 쓰지 않은 전체 상품명 표현은 기존 matcher가 더 잘 처리한다.
    if not tokens:
        return []
    rows = []
    for code, name, normalized_name in load_products():
        matched = [token for token in tokens if _norm(token) in normalized_name.lower()]
        if matched and sum(len(token) for token in matched) >= 5:
            rows.append(ProductCandidate(
                product_code=code,
                product_name=name,
                score=sum(len(token) for token in matched),
            ))
    rows.sort(key=lambda item: (-item.score, item.product_code))
    return rows


def resolve_product(question: str) -> ProductResolution:
    raw_hits = find_products(question, limit=20)
    candidates = [
        ProductCandidate(product_code=code, product_name=name, score=score)
        for code, name, score in raw_hits if name
    ]
    requested_durations = _durations(question)

    if requested_durations:
        # `미래에셋솔로몬장기국공채`처럼 정식명칭의 중간까지만 말하면 기존
        # matcher가 0건일 수 있다. 상품군 후보를 보강한 뒤 기간을 엄격히
        # 적용한다. 실제로 없는 `초장기`는 이 필터에서 여전히 0건이 된다.
        family = _family_candidates(question)
        known_codes = {item.product_code for item in candidates}
        candidates.extend(item for item in family if item.product_code not in known_codes)
        duration_matches = [
            item for item in candidates
            if _duration(item.product_name) in requested_durations
        ]
        if not duration_matches:
            return ProductResolution(
                status="not_found",
                raw_text=question,
                candidates=candidates[:5],
                reason=f"질문에 명시된 기간 구분 {requested_durations}과 정확히 일치하는 상품이 없음",
            )
        candidates = duration_matches
    elif len(candidates) <= 1:
        family = _family_candidates(question)
        if len(family) > 1:
            candidates = family

    if not candidates:
        return ProductResolution(
            status="not_found",
            raw_text=question,
            reason="상품코드 또는 식별 가능한 상품명이 없음",
        )
    if len(candidates) > 1:
        return ProductResolution(
            status="ambiguous",
            raw_text=question,
            candidates=candidates,
            reason="질문의 상품 표현과 일치할 수 있는 후보가 여러 개임",
        )

    candidate = candidates[0]
    exact = candidate.product_code.lower() in question.lower() or _norm(candidate.product_name) in _norm(question)
    return ProductResolution(
        status="exact" if exact else "alias",
        raw_text=question,
        candidates=[candidate],
        reason="상품코드 또는 전체 상품명 일치" if exact else "축약·부분 상품명으로 단일 후보 식별",
    )
