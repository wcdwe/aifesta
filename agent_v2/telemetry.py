from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class LlmUsage:
    calls: int = 0
    failed_calls: int = 0
    estimated_input_tokens: int = 0
    estimated_output_tokens: int = 0


_usage: ContextVar[LlmUsage] = ContextVar("agent_v2_llm_usage", default=LlmUsage())


def reset_usage() -> None:
    _usage.set(LlmUsage())


def _estimate_tokens(text: str) -> int:
    # HCX 응답이 토큰 사용량을 제공하지 않는 환경에서도 예산 추세를 볼 수
    # 있도록 보수적인 문자 기반 추정치를 남긴다. 실제 청구 토큰과는 다르다.
    return max(1, (len(text or "") + 2) // 3)


def record_call(messages: list[dict]) -> None:
    current = _usage.get()
    prompt = "\n".join(str(item.get("content", "")) for item in messages)
    _usage.set(replace(
        current,
        calls=current.calls + 1,
        estimated_input_tokens=current.estimated_input_tokens + _estimate_tokens(prompt),
    ))


def record_success(output: str) -> None:
    current = _usage.get()
    _usage.set(replace(
        current,
        estimated_output_tokens=current.estimated_output_tokens + _estimate_tokens(output),
    ))


def record_failure() -> None:
    current = _usage.get()
    _usage.set(replace(current, failed_calls=current.failed_calls + 1))


def usage_snapshot() -> LlmUsage:
    return _usage.get()
