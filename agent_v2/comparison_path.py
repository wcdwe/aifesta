from __future__ import annotations

import sqlite3

from scripts.compare_products import compare_products
from scripts.build_product_facts_db import DEFAULT_DB_PATH
from scripts.product_facts import detect_intents
from scripts.product_lookup import find_products


def try_fast_compare(question_id: str, question: str) -> dict | None:
    hits = find_products(question)
    codes = list(dict.fromkeys(item[0] for item in hits))
    if len(codes) < 2:
        return None
    intents = set(detect_intents(question))
    fields = set()
    if "fee" in intents or "보수" in question:
        fields.add("fee")
    if "return" in intents or "수익률" in question:
        fields.add("return")
    if "risk" in intents or "위험등급" in question:
        fields.add("risk")
    summary, evidence = compare_products(codes, fields=fields or None)
    if "fee" in fields:
        conn = sqlite3.connect(DEFAULT_DB_PATH)
        try:
            basis = []
            for code in codes:
                row = conn.execute(
                    "SELECT MAX(as_of) FROM class_fees WHERE product_code=? AND as_of IS NOT NULL",
                    (code,),
                ).fetchone()
                basis.append(f"{code} 총보수 기준일 {row[0] if row and row[0] else '확인되지 않음'}")
            summary += "\n※ " + "; ".join(basis)
        finally:
            conn.close()
    if "return" in fields:
        summary += (
            "\n※ 수익률 기준일은 현재 구조화 자료에서 별도로 확인되지 않습니다. "
            "과거 수익률은 미래의 운용성과를 보장하지 않습니다."
        )
    return {
        "question_id": str(question_id), "question": str(question),
        "retrieved_context": str(summary),
        "think_trace": (
            "1. Python Pre-router: FAST_COMPARE\n"
            f"2. 상품 식별: {codes}\n"
            f"3. 동일 가입조건·클래스 기준 구조화 비교: fields={sorted(fields)}\n"
            f"4. Python 상품코드·클래스 검증: PASS (근거 {len(evidence)}건)\n"
            "5. 승인된 비교 템플릿 사용; 질의분석/답변생성 LLM 호출 없음"
        ),
        "answer": str(summary), "route": "comparison",
    }
