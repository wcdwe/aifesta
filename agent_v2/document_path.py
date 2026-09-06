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
_REQUEST_TERMS = {
    "어떻게", "어떻게해", "해주세요", "알려줘", "설명해줘", "되는", "거", "아니었나요",
    # 이 코퍼스가 대부분 FAQ 형식이라("~되나요?" 식 질문이 문서마다 즐비하다),
    # 아래 낱말들은 질문 어디에 붙어 있든 거의 모든 페이지에 코사인 유사도와
    # 무관하게 걸린다 - 실측(INST-05): "연금저축을 중도해지하면 세금이
    # 어떻게 되나요?"에서 정답과 전혀 무관한 페이지들이 "어떻게"/"되나요"
    # 때문에 정답 페이지(coverage=0)보다 coverage 점수가 높게 나왔다.
    "되나요", "됩니까", "됩니다", "인가요", "합니까", "습니까", "하나요",
    "그런가요", "가능한가요", "가능한가", "됐나요",
}

# 조사·흔한 의문형 어미가 명사에 그대로 붙은 원문 토큰("연금저축을",
# "중도해지하면", "세금이")은 정답 청크가 조사 없는 원형("연금저축",
# "중도해지", "세금")으로 적혀 있으면 그대로는 절대 안 걸린다. 형태소
# 분석기를 새로 넣는 대신, 흔한 접미사만 하나 떼어 정규화 토큰을 "추가로"
# 만든다 - 원문 토큰은 그대로 두고 검사 대상에 얹기만 한다.
#
# "도"(-도 조사) 같은 흔하고 애매한 접미사는 일부러 뺐다 - "위험도",
# "수수료도"처럼 조사가 아니라 단어 자체의 일부인 경우까지 잘못 잘라
# ("위험") 무관한 청크에 새로 걸릴 위험이 더 크다고 판단했다.
_NORMALIZE_SUFFIXES = sorted([
    "이라서", "라서", "이지만", "지만", "이라도", "라도",
    "됩니까", "됩니다", "되나요", "됐나요", "인가요", "합니까", "습니까", "하나요",
    "하려면", "하면은", "했나요",
    "하면", "해서", "하고", "하는", "했을", "인가",
    "에서", "에게", "한테", "까지", "부터", "으로",
    "이나", "이란", "란",
    "은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "만", "로",
], key=len, reverse=True)


def _normalized_token(token: str) -> str | None:
    """token 끝에서 접미사를 하나 떼어낸 정규화 형태. 어간이 2글자 미만으로
    남으면(잘못 자를 위험이 크다) None."""
    for suf in _NORMALIZE_SUFFIXES:
        if token.endswith(suf) and len(token) - len(suf) >= 2:
            return token[: -len(suf)]
    return None


# 이 코퍼스는 "제도(대상) + 행위 -> 결과"를 묻는 질문이 대부분인데("연금저축을
# 중도해지하면 세금이 어떻게 되나요?" = 대상 연금저축 + 행위 중도해지 + 요구정보
# 세금), 그런데 정작 대상 낱말("연금저축", "퇴직연금")은 이 코퍼스 문서
# 대부분이 연금/퇴직연금 제도를 다루는 문서라 거의 모든 페이지에 등장한다 -
# 변별력이 없다. 반면 행위 낱말("중도해지")은 그 페이지가 실제로 그 절차를
# 다루는지를 정확히 가른다(실측: "연금저축"+"세금이"만 일치하는 무관한
# ISA 절세 페이지가, "중도해지"가 일치하는 정답 페이지보다 대상 낱말까지
# 덩달아 가중치를 받으면 오히려 더 높은 점수를 받는다). 그래서 행위
# 낱말에만 가중치를 높이고, 대상·요구정보 낱말은 원래 가중치(글자 수)를
# 그대로 둔다 - 길이로 짧은 낱말을 잘라내는 대신, 실제 변별력이 있는
# 낱말군만 무겁게 본다.
_ACTION_TERMS = {
    "해지", "중도해지", "인출", "중도인출", "이전", "전환", "신청", "가입",
    "수령", "개시", "만기", "연장", "환급", "환매", "감면", "승계", "이체", "납입",
}
_ANCHOR_WEIGHT_MULT = 3


def _term_weight(form: str) -> int:
    base = len(form)
    if form in _ACTION_TERMS:
        return base * _ANCHOR_WEIGHT_MULT
    return base


def _coverage(hit: dict, question: str) -> int:
    compact_text = re.sub(r"\s+", "", hit.get("text") or "").lower()
    tokens = [
        token.lower() for token in re.findall(r"[가-힣A-Za-z0-9]+", question or "")
        if len(token) >= 2 and token not in _REQUEST_TERMS
    ]
    total = 0
    for token in tokens:
        forms = {token}
        norm = _normalized_token(token)
        if norm and norm not in _REQUEST_TERMS:
            forms.add(norm)
        total += max(
            (_term_weight(form) for form in forms if form in compact_text),
            default=0,
        )
    return total


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
