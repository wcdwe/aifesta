from __future__ import annotations

from . import product_repository as repository
from .document_path import retrieve_document_hits
from .product_resolver import resolve_product
from .schemas import Evidence, PlanStep, QueryFilter, ToolExecutionResult


def execute_tasks(question, plan):
    results, evidence, errors, states = {}, [], [], {}
    codes = list(plan.entities.get("anchor_product_codes") or [])
    steps = plan.plan or [PlanStep(step=i, tool=t, purpose=t) for i, t in enumerate(plan.tools, 1)]
    for step in steps:
        key = str(step.step)
        if any(states.get(str(dep), {}).get("status") != "PASS" for dep in step.depends_on):
            states[key] = {"status": "SKIPPED", "tool": step.tool, "reason": "선행 Task 실패/부분 결과"}
            errors.append(f"Task {key}: 선행 Task 실패로 실행하지 않음")
            continue
        inputs = step.inputs
        scoped_codes = inputs.get("product_codes") or codes
        evs = []
        try:
            if step.tool == "RESOLVE":
                mentions = inputs.get("product_names") or [m.text for m in plan.product_mentions]
                if not mentions: raise ValueError("식별할 상품명이 없음")
                value = []
                for mention in mentions:
                    resolved = resolve_product(mention)
                    value.append(resolved.model_dump(mode="json"))
                    if resolved.status not in {"exact", "alias"}: raise ValueError(f"상품 식별 {resolved.status}: {mention}")
                    codes.extend(c.product_code for c in resolved.candidates if c.product_code not in codes)
            elif step.tool in {"FACT", "FILTER", "COMPARE"}:
                if step.tool == "FACT" and not scoped_codes: raise ValueError("FACT 상품 식별 미완료")
                if step.tool == "COMPARE" and len(scoped_codes) < 2: raise ValueError("COMPARE 대상 2개 이상 필요")
                local = plan.model_copy(deep=True)
                if inputs.get("filters"):
                    supplied = [QueryFilter.model_validate(f) for f in inputs["filters"]]
                    unique = {f.model_dump_json(): f for f in [*local.filters, *supplied]}
                    local.filters = list(unique.values())
                fields = inputs.get("metrics") or inputs.get("fact_types") or plan.metrics or plan.required_facts
                value, evs = repository.query(local, codes=scoped_codes,
                    classes=inputs.get("class_codes") or plan.entities.get("anchor_class_codes"), fields=fields)
                # Even a valid empty query has evidence: preserve filters/count,
                # rather than falling into unrelated institution RAG.
                evs.append(Evidence(evidence_id="QUERY", kind="structured",
                    content=repository.render_result(value, []), source="structured_store.db",
                    data={"query_result": value, "verified": True, "tool": step.tool}))
            elif step.tool == "RAG":
                sources = inputs.get("source_types") or (["product"] if scoped_codes else ["institution"])
                allowed = plan.entities.get("allowed_source_types", ["product", "institution", "structured"])
                if any(s not in allowed for s in sources): raise ValueError("허용된 검색 범위를 벗어남")
                facts = inputs.get("fact_types") or plan.required_facts
                query = inputs.get("query") or step.purpose or question
                hits = []
                for source in sources:
                    if source == "product":
                        if not scoped_codes: raise ValueError("상품 RAG는 먼저 상품코드를 확정해야 함")
                        for code in scoped_codes:
                            hits.extend(retrieve_document_hits(query, "product", code, k=3, fact_types=facts))
                    elif source == "institution":
                        hits.extend(retrieve_document_hits(query, "institution", k=3, fact_types=facts))
                    else: raise ValueError("RAG source는 product/institution만 허용")
                seen = set()
                for hit in hits:
                    identity = (hit.get("doc_id"), hit.get("page"), hit.get("chunk_id"), hit.get("text"))
                    if identity in seen: continue
                    seen.add(identity)
                    evs.append(Evidence(evidence_id=f"RAG-{len(evs)+1}", kind="document",
                        content=hit.get("text") or "", source=str(hit.get("doc_id")),
                        product_code=hit.get("product_code") or (scoped_codes[0] if len(scoped_codes)==1 and hit.get("doc_type")=="product" else None),
                        page=int(hit["page"]), data={"chunk_id": hit.get("chunk_id"),
                            "fact_types": facts, "score": hit.get("rrf", 0), "doc_type": hit.get("doc_type")}))
                    evs[-1].data["retrieval_backend"] = hit.get("retrieval_backend", "lexical_or_hybrid")
                if not evs: raise ValueError("해당 Task 범위에서 본문 근거를 찾지 못함")
                value = [e.model_dump(mode="json") for e in evs]
            elif step.tool == "TAX":
                from .tax_inputs import calculate
                value = calculate(question, inputs)
                evs = [Evidence(evidence_id="TAX", kind="calculation", content=value["summary"],
                    source="institution/doc41", page=1, data={**value, "verified": True})]
            elif step.tool == "POLICY":
                from .pre_router import pre_route
                from .templates import build_policy_payload
                decision = pre_route(question)
                if decision.route != "FAST_POLICY": raise ValueError("승인된 정책 템플릿과 일치하지 않음")
                value = build_policy_payload("policy", question, decision)["answer"]
                evs = [Evidence(evidence_id="POLICY", kind="policy", content=value, source="approved_policy", data={"verified": True})]
            else:
                raise ValueError(f"지원되지 않은 도구 {step.tool}")
            for ev in evs:
                ev.evidence_id = f"T{key}-{ev.evidence_id}"
                ev.data["task_id"] = key
            evidence.extend(evs)
            results[f"{step.tool}:{key}"] = value
            # Compatibility for consumers of a single Task of each tool.
            results[step.tool] = value
            states[key] = {"status": "PASS", "tool": step.tool,
                           "evidence_ids": [e.evidence_id for e in evs]}
        except (ValueError, KeyError, TypeError) as exc:
            states[key] = {"status": "FAIL", "tool": step.tool, "reason": str(exc)}
            errors.append(f"Task {key} ({step.tool}): {exc}")
    results["task_states"] = states
    return ToolExecutionResult(status="PARTIAL" if errors and evidence else "FAIL" if errors else "PASS",
                               tool_results=results, evidence=evidence, errors=errors)
