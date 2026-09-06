from __future__ import annotations

from dataclasses import dataclass

from scripts.hcx import HcxError, chat, is_configured

from .prompts import ANSWER_GENERATOR_PROMPT
from .schemas import ContextBundle, QueryPlan, ValidationErrorItem


@dataclass(frozen=True)
class GenerationOutcome:
    answer: str | None
    status: str


def generate_answer(
    question: str,
    plan: QueryPlan,
    context: ContextBundle,
    errors: list[ValidationErrorItem] | None = None,
    max_tokens: int = 900,
) -> GenerationOutcome:
    if not is_configured():
        return GenerationOutcome(None, "HCX 키가 없어 답변 생성 생략")
    if not context.evidence_ids or not context.text.strip():
        return GenerationOutcome(None, "답변에 사용할 근거가 없어 생성 생략")
    correction = ""
    if errors:
        items = "\n".join(
            f"- {item.criterion}: {item.problem} / 수정: {item.correction}"
            for item in errors[:8]
        )
        correction = f"\n\n이전 답변의 아래 오류만 고쳐 새 답변을 작성하라.\n{items}"
    user = (
        f"<질문>\n{question}\n</질문>\n"
        f"<실행계획>\n{plan.model_dump_json()}\n</실행계획>\n"
        f"<근거>\n{context.text}\n</근거>"
        f"{correction}"
    )
    try:
        answer = chat(
            [
                {"role": "system", "content": ANSWER_GENERATOR_PROMPT},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0.1,
        )
    except HcxError as exc:
        return GenerationOutcome(None, f"HCX 답변 생성 실패: {exc}")
    return GenerationOutcome(answer, "HCX 근거 기반 답변 생성 완료")
