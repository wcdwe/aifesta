from __future__ import annotations

import json

from pydantic import ValidationError

from scripts.hcx import HcxError, chat, is_configured

from .prompts import FINAL_VALIDATOR_PROMPT
from .schemas import ContextBundle, Evidence, QueryPlan, ValidationErrorItem, ValidationResult


def _extract_json(text: str) -> dict | None:
    start = (text or "").find("{")
    end = (text or "").rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start:end + 1])
    except (ValueError, TypeError):
        return None
    return value if isinstance(value, dict) else None


def parse_validation(text: str) -> ValidationResult:
    data = _extract_json(text)
    if data is None:
        return _closed_failure("검증 LLM이 유효한 JSON 객체를 반환하지 않음")
    try:
        return ValidationResult.model_validate(data)
    except ValidationError as exc:
        return _closed_failure(f"검증 LLM 응답 스키마 오류: {exc.error_count()}건")


def _closed_failure(problem: str) -> ValidationResult:
    return ValidationResult(
        status="FAIL",
        retry_action="SAFE_FALLBACK",
        errors=[ValidationErrorItem(
            criterion="검증 수행",
            problem=problem,
            correction="검증되지 않은 고위험 답변을 내보내지 말고 근거 있는 안전 답변 사용",
        )],
    )


def validate_with_llm(
    question: str,
    answer: str,
    plan: QueryPlan,
    evidence: list[Evidence],
    context: ContextBundle,
    max_tokens: int = 500,
) -> ValidationResult:
    """고위험 및 문서 서술 답변의 의미를 검증한다. 호출 실패는 fail-closed다."""
    if not is_configured():
        return _closed_failure("HCX 키가 없어 고위험 답변 검증을 수행할 수 없음")
    payload = {
        "question": question,
        "plan": plan.model_dump(mode="json"),
        "python_validation": {"status": "PASS", "errors": []},
        "evidence": [item.model_dump(mode="json") for item in evidence],
        "context_truncated": context.truncated,
        "missing_task_ids": context.missing_task_ids,
        "answer": answer,
    }
    messages = [
        {"role": "system", "content": FINAL_VALIDATOR_PROMPT},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    try:
        raw = chat(messages, max_tokens=max_tokens, temperature=0.0, stage="validator")
    except HcxError as exc:
        return _closed_failure(f"고위험 답변 검증 호출 실패: {exc}")
    return parse_validation(raw)
