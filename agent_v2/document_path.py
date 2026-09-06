from __future__ import annotations

import re

from scripts.answer_llm import generate, verify_answer
from scripts import institution_facts
from scripts.search import lexical_search, semantic_search

from .product_resolver import resolve_product


_PRODUCT_DOCUMENT = re.compile(r"투자전략|투자목적|위험요인|주요\s*위험|원금보장|운용사")
_INSTITUTION_SIGNAL = re.compile(
    r"DB|DC|IRP|연금저축|퇴직연금|퇴직금|연금|세액공제|중도인출|"
    r"매수\s*취소|장외채권|예금\s*만기|재예치|유상청약",
    re.IGNORECASE,
)
_COVER_TOC = re.compile(r"\(표지\)|\(섹션\s*표지\)|목차|contents", re.IGNORECASE)
_BARE_TOC = re.compile(r"^\s*[1-9][.)]\s*[^\n:：>→]{1,30}$")
_FAQ_INDEX_LINE = re.compile(r"(?m)^\s*\d+(?:-\d+)?[.)]\s*.+\?\s*$")
_CONTACT_SIGNAL = re.compile(r"주소|연락처|홈페이지|www\.|전화", re.I)
_STRATEGY_SECTION = re.compile(r"투자전략|투자목적|투자방침|주요\s*투자대상")
_RISK_SECTION = re.compile(r"투자위험|주요\s*위험|원금손실|시장위험|가격변동")
_REQUEST_TERMS = {"어떻게", "어떻게해", "해주세요", "알려줘", "설명해줘", "되는", "거", "아니었나요"}


def _coverage(hit: dict, question: str) -> int:
    compact_text = re.sub(r"\s+", "", hit.get("text") or "").lower()
    tokens = [
        token.lower() for token in re.findall(r"[가-힣A-Za-z0-9]+", question or "")
        if len(token) >= 2 and token not in _REQUEST_TERMS
    ]
    return sum(len(token) for token in tokens if token in compact_text)


def _usable(hit: dict) -> bool:
    text = (hit.get("text") or "").strip()
    try:
        page = int(hit.get("page"))
    except (TypeError, ValueError):
        return False
    hit["page"] = page
    if not text or not hit.get("doc_id") or page < 1:
        return False
    if hit.get("boilerplate") or _COVER_TOC.search(text) or _BARE_TOC.match(text):
        return False
    # 답 없이 질문 제목만 여러 개 나열한 FAQ 색인도 목차로 취급한다.
    if len(_FAQ_INDEX_LINE.findall(text)) >= 4 and not re.search(r"(?m)^\s*[-☞]\s*\S", text):
        return False
    if len(_CONTACT_SIGNAL.findall(text)) >= 3:
        return False
    # 1쪽의 짧은 제목은 표지일 가능성이 높다. 짧아도 콜론·문장 종결·수치가
    # 있으면 실제 사실일 수 있으므로 제외하지 않는다.
    if page == 1 and len(text) <= 45 and not re.search(r"[:：\d]|다[.!]?\s*$|요[.!]?\s*$", text):
        return False
    return True


def retrieve_document_hits(question: str, doc_type: str,
                           product_code: str | None = None,
                           k: int = 10) -> list[dict]:
    semantic = semantic_search(question, k=k, doc_type=doc_type, product_code=product_code)
    lexical = lexical_search(question, k=k, doc_type=doc_type, product_code=product_code)
    pooled: dict[tuple, dict] = {}
    for ranked in (semantic, lexical):
        for rank, hit in enumerate(ranked):
            key = (hit.get("doc_id"), hit.get("page"), hit.get("chunk_id"))
            current = pooled.setdefault(key, dict(hit, rrf=0.0))
            current["rrf"] = current.get("rrf", 0.0) + 1.0 / (61 + rank)
            current["score"] = max(current.get("score") or 0.0, hit.get("score") or 0.0)
    hits = [hit for hit in pooled.values() if _usable(hit)]
    section_pattern = _RISK_SECTION if re.search(r"위험|원금", question) else _STRATEGY_SECTION
    hits.sort(
        key=lambda hit: (
            1 if section_pattern.search(hit.get("text") or "") else 0,
            _coverage(hit, question), hit.get("rrf", 0.0), hit.get("score", 0.0),
        ),
        reverse=True,
    )
    # 같은 페이지의 인접 청크 반복을 막는다.
    pages, deduped = set(), []
    for hit in hits:
        page_key = (hit.get("doc_id"), hit.get("page"))
        if page_key in pages:
            continue
        pages.add(page_key)
        deduped.append(hit)
    return deduped[:6]


def _context(hits: list[dict]) -> str:
    return "\n\n---\n\n".join(
        f"[{hit['doc_type']}/{hit['doc_id']} p.{hit['page']}]\n{hit['text'][:500]}"
        for hit in hits
    )


def _fallback(hit: dict) -> str:
    return f"검색된 근거({hit['doc_id']} p.{hit['page']})에 따르면:\n{hit['text'][:350]}"


def _procedure_fallback(hits: list[dict]) -> str:
    top = hits[0]
    adjacent = [
        hit for hit in hits
        if hit["doc_id"] == top["doc_id"] and abs(hit["page"] - top["page"]) <= 1
    ][:2]
    adjacent.sort(key=lambda hit: hit["page"])
    if len(adjacent) == 1:
        return _fallback(top)
    return "\n\n".join(
        f"검색된 근거({hit['doc_id']} p.{hit['page']}):\n{hit['text'][:450]}"
        for hit in adjacent
    )


def try_simple_product_document(question_id: str, question: str) -> dict | None:
    """명확한 단일 상품의 서술형 문서 질문을 Hybrid RAG로 처리한다."""
    if not _PRODUCT_DOCUMENT.search(question or ""):
        return None
    resolution = resolve_product(question)
    if resolution.status not in {"exact", "alias"} or len(resolution.candidates) != 1:
        return None

    candidate = resolution.candidates[0]
    # 통합 저장소의 실제 상품 doc_type 값은 단수형 `product`다.
    subqueries = []
    if re.search(r"투자전략|투자목적", question):
        subqueries.append(f"{candidate.product_name} 투자목적 투자전략 투자방침")
    if re.search(r"위험요인|주요\s*위험|원금", question):
        subqueries.append(f"{candidate.product_name} 주요 투자위험 원금손실 가격변동위험")
    subqueries = subqueries or [question]
    hits, seen = [], set()
    for subquery in subqueries:
        for hit in retrieve_document_hits(subquery, "product", candidate.product_code)[:2]:
            key = (hit.get("doc_id"), hit.get("page"))
            if key not in seen:
                seen.add(key)
                hits.append(hit)
    if not hits:
        return None
    context = _context(hits)
    answer, how = generate(question, context)
    fallback_reason = None
    if answer:
        answer = re.sub(
            r"\[product/([^\]\s]+)\s+p\.(\d+)\]",
            r"(출처: \1, p.\2)", answer,
        )
        problems = verify_answer(question, answer, context)
        cited = "p." in answer and any(hit["doc_id"] in answer for hit in hits)
        if not cited:
            problems.append("검색 결과에 있는 문서명·페이지가 답변에 연결되지 않음")
        if problems:
            fallback_reason = problems
            answer = None
        else:
            cited_pairs = {
                (doc, int(page))
                for doc, page in re.findall(r"출처:\s*([^,()]+),\s*p\.(\d+)", answer)
            }
            used = [
                hit for hit in hits
                if (str(hit.get("doc_id")), int(hit.get("page"))) in cited_pairs
            ]
            if used:
                hits = used
                context = _context(hits)
    if not answer:
        answer = _fallback(hits[0])
        how = how + "; Python 검증 후 근거 발췌 사용"

    return {
        "question_id": str(question_id),
        "question": str(question),
        "retrieved_context": context,
        "think_trace": (
            "1. Python Pre-router: SIMPLE_DOCUMENT\n"
            f"2. 상품 식별: {resolution.status} - {candidate.product_code} "
            f"({candidate.product_name})\n"
            f"3. 상품 문서 Hybrid RAG: 사실별 검색, 비본문 제외, 실제 사용 근거 {len(hits)}건\n"
            f"4. 답변 생성·검증: {how}"
            + (f"\n   - 생성 답변 반려 사유: {fallback_reason}" if fallback_reason else "")
        ),
        "answer": answer,
        "route": "rag",
    }


def try_simple_institution_document(question_id: str, question: str) -> dict | None:
    """제도·절차 질문: 원자적 사실을 우선하고 없을 때만 RAG를 사용한다."""
    if not _INSTITUTION_SIGNAL.search(question or ""):
        return None
    # 상품 투자설명서 질문을 제도 문서로 잘못 보내지 않는다.
    if _PRODUCT_DOCUMENT.search(question or ""):
        return None

    summary, evidence = institution_facts.institution_facts_answer(question)
    if summary is not None:
        return {
            "question_id": str(question_id),
            "question": str(question),
            "retrieved_context": str(summary),
            "think_trace": (
                "1. Python Pre-router: SIMPLE_DOCUMENT\n"
                "2. institution_facts 원자적 사실 조회: HIT\n"
                f"3. Python 근거 검증: PASS (근거 {len(evidence)}건)\n"
                "4. 승인된 사실 템플릿 사용; LLM 호출 없음"
            ),
            "answer": str(summary),
            "route": "institution_facts",
        }

    hits = retrieve_document_hits(question, "institution")
    if not hits:
        return None
    context = _context(hits)
    answer, how = generate(question, context)
    fallback_reason = None
    if answer:
        problems = verify_answer(question, answer, context)
        cited = "p." in answer and any(hit["doc_id"] in answer for hit in hits)
        if not cited:
            problems.append("검색 결과에 있는 문서명·페이지가 답변에 연결되지 않음")
        if problems:
            fallback_reason = problems
            answer = None
    if not answer:
        answer = _procedure_fallback(hits)
        how = how + "; Python 검증 후 근거 발췌 사용"

    return {
        "question_id": str(question_id),
        "question": str(question),
        "retrieved_context": context,
        "think_trace": (
            "1. Python Pre-router: SIMPLE_DOCUMENT\n"
            "2. institution_facts 원자적 사실 조회: MISS\n"
            f"3. 제도·절차 Hybrid RAG: 표지·목차 제외, 페이지 중복 제거, 근거 {len(hits)}건\n"
            f"4. 답변 생성·검증: {how}"
            + (f"\n   - 생성 답변 반려 사유: {fallback_reason}" if fallback_reason else "")
        ),
        "answer": answer,
        "route": "rag",
    }
