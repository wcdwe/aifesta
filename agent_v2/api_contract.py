from __future__ import annotations

from collections import OrderedDict
from threading import RLock

from pydantic import BaseModel, ConfigDict


class ApiResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    question_id: str
    question: str
    retrieved_context: str
    think_trace: str
    answer: str


class ResponseCache:
    """프로세스 내부의 작은 LRU. 실패 응답은 호출부에서 넣지 않는다."""

    def __init__(self, max_size: int = 256):
        self.max_size = max_size
        self._items: OrderedDict[tuple[str, str], dict[str, str]] = OrderedDict()
        self._lock = RLock()

    def get(self, question_id: str, question: str) -> dict[str, str] | None:
        key = (question_id, question)
        with self._lock:
            value = self._items.get(key)
            if value is None:
                return None
            self._items.move_to_end(key)
            return dict(value)

    def put(self, value: dict[str, str]) -> None:
        key = (value["question_id"], value["question"])
        with self._lock:
            self._items[key] = dict(value)
            self._items.move_to_end(key)
            while len(self._items) > self.max_size:
                self._items.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


def validate_api_response(payload: dict) -> dict[str, str]:
    return ApiResponse.model_validate(payload).model_dump()
