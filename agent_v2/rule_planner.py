from __future__ import annotations

import re

from .schemas import FilterOperator, PlanStep, QueryFilter, QueryPlan


def build_rule_plan(question: str) -> QueryPlan | None:
    """LLM 계획이 깨졌을 때 확실한 정형 조건만 보수적으로 복구한다."""
    text = question or ""
    filters: list[QueryFilter] = []
    metrics: list[str] = []
    periods: list[str] = []

    account = re.search(r"IRP|DC|연금저축", text, re.I)
    if account:
        value = account.group(0).upper() if account.group(0).lower() != "연금저축" else "연금저축"
        filters.append(QueryFilter(
            field="account_type", operator=FilterOperator.EQ, value=value,
            source_text=account.group(0),
        ))
    asset = re.search(r"채권형|주식형", text)
    if asset:
        filters.append(QueryFilter(
            field="asset_type", operator=FilterOperator.EQ, value=asset.group(0),
            source_text=asset.group(0),
        ))
    period = re.search(r"(?:최근\s*)?(1년|2년|3년|5년)\s*수익률", text)
    existence = re.search(r"존재|있는|자료가\s*있는", text)
    if period and existence:
        label = period.group(1)
        field = f"return_{label[:-1]}y"
        filters.append(QueryFilter(
            field=field, operator=FilterOperator.IS_NOT_NULL,
            source_text=period.group(0),
        ))
        metrics.append(field)
        periods.append(label)

    if len(filters) < 2 or not re.search(r"상품|펀드", text):
        return None
    return QueryPlan(
        intents=["조건검색"], required_facts=[item.field for item in filters],
        filters=filters, metrics=metrics, periods=periods,
        return_all=bool(re.search(r"모두|전부|전체", text)),
        tools=["FILTER"], completeness="all_matches" if re.search(r"모두|전부|전체", text) else "single_answer",
        plan=[PlanStep(step=1, tool="FILTER", purpose="규칙 기반 조건검색", depends_on=[])],
    )
