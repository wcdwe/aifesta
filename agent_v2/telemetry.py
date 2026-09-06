from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class LlmUsage:
    calls: int = 0
    failed_calls: int = 0
    estimated_input_tokens: int = 0
    estimated_output_tokens: int = 0
    http_attempts: int = 0
    actual_input_tokens: int = 0
    actual_output_tokens: int = 0
    actual_usage_responses: int = 0
    calls_by_stage: tuple[tuple[str, int], ...] = ()


_usage: ContextVar[LlmUsage] = ContextVar("agent_v2_llm_usage", default=LlmUsage())


def reset_usage() -> None:
    _usage.set(LlmUsage())


def _estimate_tokens(text: str) -> int:
    # HCX 응답이 토큰 사용량을 제공하지 않는 환경에서도 예산 추세를 볼 수
    # 있도록 보수적인 문자 기반 추정치를 남긴다. 실제 청구 토큰과는 다르다.
    return max(1, (len(text or "") + 2) // 3)


def record_call(messages: list[dict], stage: str = "unspecified") -> None:
    current = _usage.get()
    prompt = "\n".join(str(item.get("content", "")) for item in messages)
    stages = dict(current.calls_by_stage)
    stages[stage] = stages.get(stage, 0) + 1
    _usage.set(replace(
        current,
        calls=current.calls + 1,
        calls_by_stage=tuple(stages.items()),
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


def record_http_attempt():
    current = _usage.get()
    _usage.set(replace(current, http_attempts=current.http_attempts + 1))


def record_actual_usage(payload):
    result = payload.get("result") or {}
    usage = result.get("usage") or payload.get("usage") or {}
    incoming = result.get("inputLength", usage.get("prompt_tokens", usage.get("inputTokens")))
    outgoing = result.get("outputLength", usage.get("completion_tokens", usage.get("outputTokens")))
    if not isinstance(incoming, int) or not isinstance(outgoing, int): return
    current = _usage.get()
    _usage.set(replace(current, actual_input_tokens=current.actual_input_tokens + incoming,
        actual_output_tokens=current.actual_output_tokens + outgoing,
        actual_usage_responses=current.actual_usage_responses + 1))


def usage_snapshot() -> LlmUsage:
    return _usage.get()
