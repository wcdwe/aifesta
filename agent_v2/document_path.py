from __future__ import annotations

import re

from scripts.answer_llm import generate, verify_answer
from scripts.search import lexical_search, semantic_search

from .product_resolver import resolve_product


_PRODUCT_DOCUMENT = re.compile(r"투자전략|투자목적|위험요인|주요\s*위험|원금보장|운용사")
_COVER_TOC = re.compile(r"\(표지\)|\(섹션\s*표지\)|목차|contents", re.IGNORECASE)
_BARE_TOC = re.compile(r"^\s*[1-9][.)]\s*[^\n:：>→]{1,30}$")


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
    # 1쪽의 짧은 제목은 표지일 가능성이 높다. 짧아도 콜론·문장 종결·수치가
    # 있으면 실제 사실일 수 있으므로 제외하지 않는다.
    if page == 1 and len(text) <= 45 and not re.search(r"[:：\d]|다[.!]?\s*$|요[.!]?\s*$", text):
        return False
    return True


def _retrieve(question: str, product_code: str, k: int = 10) -> list[dict]:
    # 통합 저장소의 실제 doc_type 값은 단수형 `product`다.
    semantic = semantic_search(question, k=k, doc_type="product", product_code=product_code)
    lexical = lexical_search(question, k=k, doc_type="product", product_code=product_code)
    pooled: dict[tuple, dict] = {}
    for ranked in (semantic, lexical):
        for rank, hit in enumerate(ranked):
            key = (hit.get("doc_id"), hit.get("page"), hit.get("chunk_id"))
            current = pooled.setdefault(key, dict(hit, rrf=0.0))
            current["rrf"] = current.get("rrf", 0.0) + 1.0 / (61 + rank)
            current["score"] = max(current.get("score") or 0.0, hit.get("score") or 0.0)
    hits = [hit for hit in pooled.values() if _usable(hit)]
    hits.sort(key=lambda hit: (hit.get("rrf", 0.0), hit.get("score", 0.0)), reverse=True)
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
        f"[product/{hit['doc_id']} p.{hit['page']}]\n{hit['text'][:500]}"
        for hit in hits
    )


def _fallback(hit: dict) -> str:
    return f"검색된 근거({hit['doc_id']} p.{hit['page']})에 따르면:\n{hit['text'][:350]}"


def try_simple_product_document(question_id: str, question: str) -> dict | None:
    """명확한 단일 상품의 서술형 문서 질문을 Hybrid RAG로 처리한다."""
    if not _PRODUCT_DOCUMENT.search(question or ""):
        return None
    resolution = resolve_product(question)
    if resolution.status not in {"exact", "alias"} or len(resolution.candidates) != 1:
        return None

    candidate = resolution.candidates[0]
    hits = _retrieve(question, candidate.product_code)
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
            f"3. 상품 문서 Hybrid RAG: 표지·목차 제외, 페이지 중복 제거, 근거 {len(hits)}건\n"
            f"4. 답변 생성·검증: {how}"
            + (f"\n   - 생성 답변 반려 사유: {fallback_reason}" if fallback_reason else "")
        ),
        "answer": answer,
        "route": "rag",
    }
