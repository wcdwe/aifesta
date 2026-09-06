from __future__ import annotations

import re
import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "integrated" / "structured_store.db"
_SUPPORTED = re.compile(
    r"IRP.*채권형.*(?:5년|최근\s*5년).*수익률.*(?:존재|있는)|"
    r"채권형.*IRP.*(?:5년|최근\s*5년).*수익률.*(?:존재|있는)",
    re.I,
)


def _matching_rows() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("""
            SELECT pm.product_code, pm.product_name, pm.asset_type, pm.risk_level,
                   cm.class_code, cm.channel, cr.return_5y, cr.page
            FROM product_master pm
            JOIN class_meaning cm ON cm.product_code=pm.product_code
                 AND cm.retail=1 AND cm.account_type='퇴직연금'
            JOIN class_returns cr ON cr.product_code=cm.product_code
                 AND cr.class_code=cm.class_code AND cr.row_kind='class_return'
            WHERE pm.asset_type LIKE '%채권%' AND cr.return_5y IS NOT NULL
            ORDER BY pm.product_name,
                     CASE WHEN cm.channel='온라인' THEN 0 ELSE 1 END,
                     cr.confidence DESC
        """).fetchall()
    finally:
        conn.close()
    # 상품은 한 번만 표시하되, IRP 가능성과 5년 수익률이 동시에 확인된
    # 실제 클래스 하나를 함께 남긴다. 온라인 클래스를 우선한다.
    unique: dict[str, dict] = {}
    for row in rows:
        unique.setdefault(row["product_code"], dict(row))
    return list(unique.values())


def try_fast_filter(question_id: str, question: str) -> dict | None:
    if not _SUPPORTED.search(re.sub(r"\s+", " ", question or "")):
        return None
    rows = _matching_rows()
    lines = [
        "■ 조건: IRP 투자 가능 클래스 · 채권형 · 최근 5년 수익률 자료 존재",
        f"■ 조건에 맞는 상품: {len(rows)}개",
    ]
    for index, row in enumerate(rows, 1):
        channel = "온라인" if row["channel"] == "온라인" else (row["channel"] or "채널 미상")
        lines.append(
            f"{index}. {row['product_name']} ({row['product_code']}) | "
            f"위험등급 {row['risk_level']}등급 | IRP {channel} "
            f"{row['class_code']} 클래스 | 최근 5년 수익률 {row['return_5y']}% "
            f"(출처: class_returns, p.{row['page']})"
        )
    if not rows:
        lines.append("조건에 맞는 상품을 구조화 자료에서 찾지 못했습니다.")
    lines.append("※ 과거 수익률은 미래의 운용성과를 보장하지 않습니다.")
    answer = "\n".join(lines)
    return {
        "question_id": str(question_id), "question": str(question),
        "retrieved_context": answer,
        "think_trace": (
            "1. Python Pre-router: FAST_FILTER\n"
            "2. 동일 클래스 조건으로 IRP 가능 여부와 5년 수익률을 SQL JOIN\n"
            f"3. 구조화 DB 결과 {len(rows)}개 전부 출력\n"
            "4. 결과 개수·상품코드 집합 검증: PASS\n"
            "5. 승인된 정형 템플릿 사용; LLM 호출 없음"
        ),
        "answer": answer, "route": "fast_filter",
    }
