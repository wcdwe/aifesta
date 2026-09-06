from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from scripts.compare_products import compare_products
from scripts.product_facts import detect_intents, product_facts
from scripts.product_lookup import find_class_code
from scripts.product_ranking import ASSET_TYPE_GROUPS
from scripts.tax_calculator import answer_from_question

from .product_resolver import resolve_product
from .schemas import Evidence, FilterOperator, QueryFilter, QueryPlan, ToolExecutionResult


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "integrated" / "structured_store.db"
ALLOWED_FIELDS = {
    "account_type", "asset_type", "risk_level", "total_fee", "aum",
    "return_1y", "return_2y", "return_3y", "return_5y", "return_since_inception",
}
RETURN_FIELDS = {field for field in ALLOWED_FIELDS if field.startswith("return_")}


def _matches(value: Any, item: QueryFilter) -> bool:
    op, target = item.operator, item.value
    if op == FilterOperator.IS_NULL:
        return value is None
    if op == FilterOperator.IS_NOT_NULL:
        return value is not None
    if value is None:
        return False
    if op == FilterOperator.EQ:
        return value == target
    if op == FilterOperator.NE:
        return value != target
    if op == FilterOperator.IN:
        return value in (target or [])
    if op == FilterOperator.CONTAINS:
        return str(target).lower() in str(value).lower()
    try:
        left, right = float(value), float(target)
    except (TypeError, ValueError):
        return False
    return {
        FilterOperator.LT: left < right,
        FilterOperator.LTE: left <= right,
        FilterOperator.GT: left > right,
        FilterOperator.GTE: left >= right,
    }.get(op, False)


def _normalize_filter(item: QueryFilter) -> QueryFilter:
    data = item.model_copy(deep=True)
    if data.field == "asset_type" and isinstance(data.value, str):
        mapped = ASSET_TYPE_GROUPS.get(data.value)
        if mapped is not None:
            data.operator, data.value = FilterOperator.IN, list(mapped)
    if data.field == "account_type" and str(data.value).upper() in {"IRP", "DC"}:
        data.operator, data.value = FilterOperator.CONTAINS, "퇴직연금"
    return data


def _product_rows() -> list[dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    products = {row["product_code"]: dict(row) for row in conn.execute("SELECT * FROM product_master")}
    for code, row in products.items():
        row.update({"account_types": set(), "returns": {}, "fees": []})
    for row in conn.execute("SELECT product_code, account_type FROM class_meaning WHERE retail=1"):
        if row["product_code"] in products and row["account_type"]:
            products[row["product_code"]]["account_types"].add(row["account_type"])
    for row in conn.execute(
        "SELECT cr.* FROM class_returns cr JOIN class_meaning cm ON "
        "cm.product_code=cr.product_code AND cm.class_code=cr.class_code "
        "WHERE cr.row_kind='class_return' AND cm.retail=1"
    ):
        if row["product_code"] not in products:
            continue
        for field in RETURN_FIELDS:
            if row[field] is not None and field not in products[row["product_code"]]["returns"]:
                products[row["product_code"]]["returns"][field] = row[field]
    for row in conn.execute(
        "SELECT cf.product_code, cf.total_fee FROM class_fees cf JOIN class_meaning cm ON "
        "cm.product_code=cf.product_code AND cm.class_code=cf.class_code "
        "WHERE cm.retail=1 AND cf.total_fee IS NOT NULL"
    ):
        if row["product_code"] in products:
            products[row["product_code"]]["fees"].append(row["total_fee"])
    for row in conn.execute("SELECT product_code, net_asset_latest, unit, page FROM fund_aum"):
        if row["product_code"] in products:
            products[row["product_code"]]["aum"] = row["net_asset_latest"]
            products[row["product_code"]]["aum_unit"] = row["unit"]
            products[row["product_code"]]["aum_page"] = row["page"]
    conn.close()
    return list(products.values())


def _field_value(row: dict[str, Any], field: str) -> Any:
    if field == "account_type":
        return " ".join(sorted(row["account_types"]))
    if field == "total_fee":
        return min(row["fees"]) if row["fees"] else None
    if field in RETURN_FIELDS:
        return row["returns"].get(field)
    return row.get(field)


def _execute_filter(plan: QueryPlan) -> tuple[dict, list[Evidence], list[str]]:
    filters = [_normalize_filter(item) for item in plan.filters]
    unknown = sorted({item.field for item in filters if item.field not in ALLOWED_FIELDS})
    if unknown:
        return {}, [], [f"허용되지 않은 필터 필드: {unknown}"]
    rows = [
        row for row in _product_rows()
        if all(_matches(_field_value(row, item.field), item) for item in filters)
    ]
    for sort_item in reversed(plan.sort):
        field = sort_item.get("field")
        if field not in ALLOWED_FIELDS:
            return {}, [], [f"허용되지 않은 정렬 필드: {field}"]
        reverse = sort_item.get("direction") == "desc"
        rows.sort(key=lambda row: _field_value(row, field) or 0, reverse=reverse)
        rows.sort(key=lambda row: _field_value(row, field) is None)
    if not plan.return_all:
        rows = rows[: plan.limit or 5]
    result_rows, evidence = [], []
    requested = list(dict.fromkeys([*plan.metrics, *(item.field for item in filters)]))
    for index, row in enumerate(rows, 1):
        values = {field: _field_value(row, field) for field in requested if field in ALLOWED_FIELDS}
        result_rows.append({
            "product_code": row["product_code"], "product_name": row["product_name"], **values,
        })
        evidence.append(Evidence(
            evidence_id=f"FILTER-{index}", kind="structured",
            content=f"{row['product_name']} ({row['product_code']}): {values}",
            source="structured_store.db", product_code=row["product_code"], data=values,
        ))
    return {"count": len(result_rows), "rows": result_rows}, evidence, []


def execute_plan(question: str, plan: QueryPlan) -> ToolExecutionResult:
    results: dict[str, Any] = {}
    evidence: list[Evidence] = []
    errors: list[str] = []
    resolutions = []
    codes: list[str] = []

    if "RESOLVE" in plan.tools:
        for index, mention in enumerate(plan.product_mentions, 1):
            resolved = resolve_product(mention.text)
            resolutions.append(resolved.model_dump(mode="json"))
            for candidate in resolved.candidates if resolved.status in {"exact", "alias"} else []:
                if candidate.product_code not in codes:
                    codes.append(candidate.product_code)
            evidence.append(Evidence(
                evidence_id=f"RESOLVE-{index}", kind="resolution",
                content=f"{mention.text}: {resolved.status} - {resolved.reason}",
                source="product_master", data=resolved.model_dump(mode="json"),
            ))
            if resolved.status in {"ambiguous", "not_found"}:
                errors.append(f"상품 식별 {resolved.status}: {mention.text}")
        results["RESOLVE"] = resolutions

    if "FILTER" in plan.tools:
        value, ev, errs = _execute_filter(plan)
        results["FILTER"], evidence = value, [*evidence, *ev]
        errors.extend(errs)

    if "FACT" in plan.tools:
        if len(codes) != 1:
            errors.append("FACT는 정확히 식별된 상품 1개가 필요함")
        else:
            intents = detect_intents(question)
            summary, ev = product_facts(codes[0], find_class_code(question), intents)
            results["FACT"] = summary
            evidence.append(Evidence(
                evidence_id="FACT-1", kind="structured", content=summary,
                source="structured_store.db", product_code=codes[0], data={"raw_evidence": ev},
            ))

    if "COMPARE" in plan.tools:
        if len(codes) < 2:
            errors.append("COMPARE는 정확히 식별된 상품 2개 이상이 필요함")
        else:
            summary, ev = compare_products(codes)
            results["COMPARE"] = summary
            evidence.append(Evidence(
                evidence_id="COMPARE-1", kind="structured", content=summary,
                source="structured_store.db", data={"product_codes": codes, "raw_evidence": ev},
            ))

    if "TAX" in plan.tools:
        summary, ev = answer_from_question(question)
        if summary is None:
            errors.append("질문에서 검증 가능한 세제 계산 입력을 찾지 못함")
        else:
            results["TAX"] = summary
            evidence.append(Evidence(
                evidence_id="TAX-1", kind="calculation", content=summary,
                source="tax_calculator", data={"rules": ev},
            ))

    unsupported = sorted(set(plan.tools) - {"RESOLVE", "FACT", "FILTER", "COMPARE", "TAX"})
    if unsupported:
        errors.append(f"아직 연결되지 않은 도구: {unsupported}")
    status = "FAIL" if errors and not evidence else "PARTIAL" if errors else "PASS"
    return ToolExecutionResult(status=status, tool_results=results, evidence=evidence, errors=errors)
