import unittest
from unittest.mock import patch

from agent_v2.pre_router import assess_risk, pre_route
from agent_v2.document_path import (
    _usable,
    try_simple_institution_document,
    try_simple_product_document,
)
from agent_v2.product_resolver import resolve_product
from agent_v2.query_analyzer import parse_plan
from agent_v2.executor import execute_plan
from agent_v2.context_builder import build_context
from agent_v2.grounding_validator import validate_grounding
from agent_v2.schemas import ContextBundle, Evidence, QueryPlan, ValidationResult
from agent_v2.validation_gate import RepairResult, run_validation_gate
from agent_v2.validator_llm import parse_validation
from agent_v2.structured_path import try_fast_structured
from agent_v2.templates import build_policy_payload


class ProductResolverTests(unittest.TestCase):
    def test_exact_duration_product(self):
        result = resolve_product("미래에셋솔로몬국공채 중 단기 상품만 알려줘")
        self.assertEqual(result.status, "alias")
        self.assertEqual(result.candidates[0].product_code, "KR5153420063")

    def test_family_is_ambiguous(self):
        result = resolve_product("솔로몬 국공채 펀드가 뭐야?")
        self.assertEqual(result.status, "ambiguous")
        self.assertGreaterEqual(len(result.candidates), 4)

    def test_nonexistent_duration_is_not_found(self):
        result = resolve_product("미래에셋솔로몬초장기국공채 펀드를 설명해줘")
        self.assertEqual(result.status, "not_found")

    def test_two_named_products_are_ambiguous_set(self):
        result = resolve_product("미래에셋솔로몬장기국공채와 중장기국공채를 비교해줘")
        self.assertEqual(result.status, "ambiguous")
        self.assertEqual({c.product_code for c in result.candidates}, {"KR5153420079", "KR5153420105"})


class PreRouterTests(unittest.TestCase):
    def test_conflicting_recommendation_uses_policy_template(self):
        decision = pre_route("원금손실은 절대 싫지만 가장 높은 수익률을 원해. 어떤 상품이 좋아?")
        self.assertEqual(decision.route, "FAST_POLICY")
        self.assertEqual(decision.template_id, "conflicting_risk_return")
        payload = build_policy_payload("Q", "질문", decision)
        self.assertIn("원금손실", payload["answer"])
        self.assertIn("계좌 유형", payload["answer"])

    def test_low_risk_high_return_conflict_uses_policy_template(self):
        decision = pre_route("위험은 가장 낮고 수익률은 가장 높은 상품 하나만 추천해줘")
        self.assertEqual(decision.route, "FAST_POLICY")
        self.assertEqual(decision.template_id, "conflicting_risk_return")

    def test_ranking_is_not_misclassified_as_vague_recommendation(self):
        decision = pre_route("채권형 펀드 중에서 수익률이 가장 좋은 것")
        self.assertNotEqual(decision.route, "FAST_POLICY")

    def test_personalized_recommendation_keeps_existing_agent_path(self):
        decision = pre_route("제 나이에 맞는 펀드 하나만 콕 집어 추천해주세요")
        self.assertEqual(decision.route, "AGENT")

    def test_simple_structured_question(self):
        decision = pre_route("미래에셋장기성장포커스 위험등급 알려줘")
        self.assertEqual(decision.route, "FAST_STRUCTURED")

    def test_two_product_difference_is_not_fast_structured(self):
        decision = pre_route("하나파워e단기채와 한국투자 크레딧포커스 ESG 수익률 차이가 어때?")
        self.assertEqual(decision.route, "AGENT")

    def test_high_risk_llm_answer_requires_llm_validation(self):
        risk = assess_risk(["추천"], ["loss_intolerance"], "LLM")
        self.assertTrue(risk.requires_llm_validation)

    def test_approved_template_skips_llm_validation(self):
        risk = assess_risk(["추천"], ["loss_intolerance"], "TEMPLATE")
        self.assertFalse(risk.requires_llm_validation)


class ValidationSchemaTests(unittest.TestCase):
    def test_pass_shape(self):
        result = ValidationResult(status="PASS", retry_action="NONE", errors=[])
        self.assertEqual(result.status, "PASS", result.errors)

    def test_fail_requires_error(self):
        with self.assertRaises(ValueError):
            ValidationResult(status="FAIL", retry_action="REGENERATE", errors=[])


class GroundingValidatorTests(unittest.TestCase):
    def setUp(self):
        self.plan = QueryPlan(intents=["상품설명"], tools=[])
        self.evidence = [Evidence(
            evidence_id="E1", kind="structured",
            content="상품코드 KR1234567890, A-e 클래스 총보수 연 0.32%, 위험등급 3등급",
            source="product_master", product_code="KR1234567890", class_code="A-e",
        )]
        self.context = ContextBundle(text=self.evidence[0].content, evidence_ids=["E1"])

    def test_grounded_answer_passes(self):
        result = validate_grounding(
            "이 상품 A-e 클래스 총보수와 위험등급 알려줘",
            "A-e 클래스 총보수는 연 0.32%이고 위험등급은 3등급입니다.",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.status, "PASS", result.errors)

    def test_unsupported_number_fails(self):
        result = validate_grounding(
            "이 상품 총보수 알려줘", "총보수는 연 0.45%입니다.",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.status, "FAIL")
        self.assertEqual(result.retry_action, "REGENERATE")

    def test_unknown_product_code_requires_resolution(self):
        result = validate_grounding(
            "상품 설명", "상품코드는 KR9999999999입니다.",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.retry_action, "RESOLVE_PRODUCT")

    def test_unknown_class_requires_resolution(self):
        result = validate_grounding(
            "이 상품 클래스 알려줘", "C-Pe 클래스입니다.",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.retry_action, "RESOLVE_PRODUCT")

    def test_total_fee_cannot_be_renamed_total_cost(self):
        result = validate_grounding(
            "이 상품 보수 알려줘", "총보수·비용은 연 0.32%입니다.",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.status, "FAIL")
        self.assertTrue(any("총보수·비용" in e.problem for e in result.errors))

    def test_fake_source_page_fails(self):
        result = validate_grounding(
            "상품 설명", "위험등급은 3등급입니다. (출처: fake.pdf, p.12)",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.status, "FAIL")
        self.assertTrue(any("출처·페이지" in e.problem for e in result.errors))

    def test_unsupported_principal_guarantee_uses_safe_fallback(self):
        result = validate_grounding(
            "원금 손실 없어?", "이 상품은 원금이 보장됩니다.",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.retry_action, "SAFE_FALLBACK")

    def test_truncated_all_matches_retrieves_more(self):
        plan = QueryPlan(
            intents=["조건검색"], return_all=True, completeness="all_matches", tools=[]
        )
        context = ContextBundle(
            text=self.context.text, evidence_ids=["E1"], omitted_evidence_ids=["E2"],
            truncated=True,
        )
        result = validate_grounding(
            "조건에 맞는 상품 모두 알려줘", "조건에 맞는 상품은 모두 1개입니다.",
            plan, self.evidence, context,
        )
        self.assertEqual(result.retry_action, "RETRIEVE_MORE")

    def test_return_period_must_be_named(self):
        plan = QueryPlan(
            intents=["상품설명"], metrics=["return_5y"], periods=["5년"], tools=[]
        )
        evidence = [Evidence(
            evidence_id="R1", kind="structured", content="최근 5년 수익률 12.3%",
            source="class_returns",
        )]
        result = validate_grounding(
            "최근 5년 수익률 알려줘", "수익률은 12.3%입니다.", plan, evidence,
            ContextBundle(text=evidence[0].content, evidence_ids=["R1"]),
        )
        self.assertEqual(result.status, "FAIL")
        self.assertTrue(any("수익률 기간" in e.problem for e in result.errors))

    def test_risk_grade_direction_error_fails(self):
        result = validate_grounding(
            "위험등급 설명", "1등급이 가장 낮은 위험등급입니다.",
            self.plan, self.evidence, self.context,
        )
        self.assertEqual(result.status, "FAIL")
        self.assertTrue(any("위험등급 숫자" in e.problem for e in result.errors))


class ValidationGateTests(unittest.TestCase):
    def setUp(self):
        self.evidence = [Evidence(
            evidence_id="E1", kind="structured", content="위험등급은 3등급입니다.",
            source="product_master",
        )]
        self.context = ContextBundle(text=self.evidence[0].content, evidence_ids=["E1"])

    @staticmethod
    def _pass_validator(*_args):
        return ValidationResult(status="PASS", retry_action="NONE", errors=[])

    @staticmethod
    def _fail_validator(*_args):
        return ValidationResult(
            status="FAIL", retry_action="REGENERATE",
            errors=[{"criterion": "안전성", "problem": "오류", "correction": "수정"}],
        )

    def test_low_risk_pass_skips_llm_validator(self):
        calls = []
        outcome = run_validation_gate(
            "위험등급 알려줘", "위험등급은 3등급입니다.",
            QueryPlan(intents=["상품설명"]), self.evidence, self.context,
            llm_validator=lambda *_args: calls.append(True),
        )
        self.assertEqual(outcome.status, "PASS")
        self.assertEqual(calls, [])

    def test_high_risk_pass_requires_llm_validator(self):
        calls = []

        def validator(*_args):
            calls.append(True)
            return self._pass_validator()

        outcome = run_validation_gate(
            "추천해줘", "위험등급은 3등급입니다.",
            QueryPlan(intents=["조건부추천"]), self.evidence, self.context,
            llm_validator=validator,
        )
        self.assertEqual(outcome.status, "PASS")
        self.assertEqual(len(calls), 1)

    def test_python_failure_is_not_overridden_by_llm(self):
        calls = []
        outcome = run_validation_gate(
            "위험등급 알려줘", "위험등급은 2등급입니다.",
            QueryPlan(intents=["상품설명"]), self.evidence, self.context,
            llm_validator=lambda *_args: calls.append(True),
        )
        self.assertEqual(outcome.status, "SAFE_FALLBACK")
        self.assertEqual(calls, [])

    def test_llm_failure_repairs_once_and_revalidates(self):
        calls = []

        def validator(*_args):
            calls.append(True)
            return self._fail_validator() if len(calls) == 1 else self._pass_validator()

        repairs = []

        def repair(action, _errors):
            repairs.append(action)
            return RepairResult("위험등급은 3등급입니다.", self.evidence, self.context)

        outcome = run_validation_gate(
            "추천해줘", "위험등급은 3등급입니다.",
            QueryPlan(intents=["추천"]), self.evidence, self.context,
            repair_handler=repair, llm_validator=validator,
        )
        self.assertEqual(outcome.status, "PASS")
        self.assertEqual(outcome.retry_count, 1)
        self.assertEqual(len(repairs), 1)
        self.assertEqual(len(calls), 2)

    def test_repeated_validator_failure_uses_safe_answer(self):
        outcome = run_validation_gate(
            "추천해줘", "위험등급은 3등급입니다.",
            QueryPlan(intents=["추천"]), self.evidence, self.context,
            repair_handler=lambda *_args: RepairResult(
                "위험등급은 3등급입니다.", self.evidence, self.context
            ),
            llm_validator=self._fail_validator,
        )
        self.assertEqual(outcome.status, "SAFE_FALLBACK")
        self.assertEqual(outcome.retry_count, 1)
        self.assertTrue(outcome.used_safe_fallback)
        self.assertIn("검증을 통과한 범위", outcome.answer)

    def test_invalid_validator_json_fails_closed(self):
        result = parse_validation("PASS")
        self.assertEqual(result.status, "FAIL")
        self.assertEqual(result.retry_action, "SAFE_FALLBACK")


class QueryAnalyzerTests(unittest.TestCase):
    def test_valid_plan_is_parsed(self):
        raw = """```json
        {"intents":["조건검색"],"entities":{"account_type":"IRP"},
        "product_mentions":[],"required_facts":["자산유형","5년 수익률"],
        "filters":[{"field":"account_type","operator":"eq","value":"IRP","source_text":"IRP에서 투자 가능"}],
        "metrics":["return_5y"],"periods":["5년"],"sort":[],"limit":null,
        "return_all":true,"missing":{"for_personalization":[],"from_evidence":[]},
        "gap_types":[],"answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":["FILTER"],"completeness":"all_matches",
        "plan":[{"step":1,"tool":"FILTER","purpose":"조건 상품 전체 조회","depends_on":[]}]}
        ```"""
        outcome = parse_plan(raw, "IRP에서 투자 가능하고 채권형이며 5년 수익률이 있는 상품")
        self.assertIsNotNone(outcome.plan)
        self.assertTrue(outcome.plan.return_all)

    def test_invented_product_mention_is_rejected(self):
        raw = """{"intents":["상품설명"],"entities":{},
        "product_mentions":[{"text":"없는펀드","role":"single","resolution_required":true}],
        "required_facts":[],"filters":[],"metrics":[],"periods":[],"sort":[],
        "limit":null,"return_all":false,"missing":{"for_personalization":[],"from_evidence":[]},
        "gap_types":[],"answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":["RESOLVE"],"completeness":"single_answer",
        "plan":[{"step":1,"tool":"RESOLVE","purpose":"식별","depends_on":[]}]}"""
        outcome = parse_plan(raw, "IRP가 뭐야?")
        self.assertIsNone(outcome.plan)

    def test_forward_dependency_is_rejected(self):
        raw = """{"intents":[],"entities":{},"product_mentions":[],"required_facts":[],
        "filters":[],"metrics":[],"periods":[],"sort":[],"limit":null,"return_all":false,
        "missing":{"for_personalization":[],"from_evidence":[]},"gap_types":[],
        "answerable_now":true,"follow_ups":[],"safety_flags":[],"tools":["FACT","RAG"],
        "completeness":"single_answer","plan":[
        {"step":1,"tool":"FACT","purpose":"조회","depends_on":[2]},
        {"step":2,"tool":"RAG","purpose":"검색","depends_on":[]}]}"""
        outcome = parse_plan(raw, "질문")
        self.assertIsNone(outcome.plan)

    def test_empty_tools_with_plan_is_rejected(self):
        raw = """{"intents":["비교"],"entities":{},"product_mentions":[],
        "required_facts":[],"filters":[],"metrics":[],"periods":[],"sort":[],
        "limit":null,"return_all":false,"missing":{"for_personalization":[],"from_evidence":[]},
        "gap_types":[],"answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":[],"completeness":"single_answer",
        "plan":[{"step":1,"tool":"COMPARE","purpose":"비교","depends_on":[]}]}"""
        self.assertIsNone(parse_plan(raw, "두 상품 비교").plan)


class PlanExecutorTests(unittest.TestCase):
    def test_multi_filter_returns_all_matching_products(self):
        raw = """{"intents":["조건검색"],"entities":{"account_type":"IRP"},
        "product_mentions":[],"required_facts":["자산유형","5년 수익률"],
        "filters":[
        {"field":"account_type","operator":"eq","value":"IRP","source_text":"IRP에서 투자 가능"},
        {"field":"asset_type","operator":"eq","value":"채권형","source_text":"채권형"},
        {"field":"return_5y","operator":"is_not_null","value":null,"source_text":"5년 수익률이 존재"}],
        "metrics":["return_5y"],"periods":["5년"],"sort":[],"limit":null,
        "return_all":true,"missing":{"for_personalization":[],"from_evidence":[]},
        "gap_types":[],"answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":["FILTER"],"completeness":"all_matches",
        "plan":[{"step":1,"tool":"FILTER","purpose":"전체 조회","depends_on":[]}]}"""
        question = "IRP에서 투자 가능하고 채권형이면서 5년 수익률이 존재하는 상품을 모두 찾아줘"
        plan = parse_plan(raw, question).plan
        result = execute_plan(question, plan)
        self.assertEqual(result.status, "PASS")
        self.assertGreater(result.tool_results["FILTER"]["count"], 0)
        self.assertTrue(all(row["return_5y"] is not None for row in result.tool_results["FILTER"]["rows"]))

    def test_unknown_filter_field_fails_closed(self):
        raw = """{"intents":["조건검색"],"entities":{},"product_mentions":[],
        "required_facts":[],"filters":[{"field":"future_profit","operator":"gte","value":10,
        "source_text":"미래수익 10 이상"}],"metrics":[],"periods":[],"sort":[],
        "limit":null,"return_all":true,"missing":{"for_personalization":[],"from_evidence":[]},
        "gap_types":[],"answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":["FILTER"],"completeness":"all_matches",
        "plan":[{"step":1,"tool":"FILTER","purpose":"조회","depends_on":[]}]}"""
        question = "미래수익 10 이상 상품"
        result = execute_plan(question, parse_plan(raw, question).plan)
        self.assertEqual(result.status, "FAIL")
        self.assertIn("허용되지 않은", result.errors[0])

    def test_two_resolved_products_can_be_compared(self):
        raw = """{"intents":["비교"],"entities":{},"product_mentions":[
        {"text":"미래에셋솔로몬장기국공채","role":"comparison_left","resolution_required":true},
        {"text":"중장기국공채","role":"comparison_right","resolution_required":true}],
        "required_facts":["위험등급","총보수"],"filters":[],"metrics":["risk_level","total_fee"],
        "periods":[],"sort":[],"limit":null,"return_all":false,
        "missing":{"for_personalization":[],"from_evidence":[]},"gap_types":[],
        "answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":["RESOLVE","COMPARE"],"completeness":"all_matches","plan":[
        {"step":1,"tool":"RESOLVE","purpose":"두 상품 식별","depends_on":[]},
        {"step":2,"tool":"COMPARE","purpose":"동일 기준 비교","depends_on":[1]}]}"""
        question = "미래에셋솔로몬장기국공채와 중장기국공채의 위험등급과 총보수를 비교해줘"
        plan = parse_plan(raw, question).plan
        result = execute_plan(question, plan)
        self.assertEqual(result.status, "PASS", result.errors)
        self.assertIn("KR5153420079", result.tool_results["COMPARE"])
        self.assertIn("KR5153420105", result.tool_results["COMPARE"])

    def test_rag_is_scoped_per_resolved_product(self):
        raw = """{"intents":["상품설명"],"entities":{},"product_mentions":[
        {"text":"미래에셋장기성장포커스","role":"single","resolution_required":true}],
        "required_facts":["투자전략"],"filters":[],"metrics":[],"periods":[],"sort":[],
        "limit":null,"return_all":false,"missing":{"for_personalization":[],"from_evidence":[]},
        "gap_types":[],"answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":["RESOLVE","RAG"],"completeness":"single_answer","plan":[
        {"step":1,"tool":"RESOLVE","purpose":"상품 식별","depends_on":[]},
        {"step":2,"tool":"RAG","purpose":"투자전략 검색","depends_on":[1]}]}"""
        question = "미래에셋장기성장포커스 투자전략을 설명해줘"
        plan = parse_plan(raw, question).plan
        result = execute_plan(question, plan)
        self.assertEqual(result.status, "PASS", result.errors)
        docs = [item for item in result.evidence if item.kind == "document"]
        self.assertTrue(docs)
        self.assertTrue(all(item.product_code == "KR510902511M" for item in docs))

    def test_context_builder_dedupes_and_reports_budget_omissions(self):
        question = "미래에셋장기성장포커스 투자전략을 설명해줘"
        raw = """{"intents":["상품설명"],"entities":{},"product_mentions":[
        {"text":"미래에셋장기성장포커스","role":"single","resolution_required":true}],
        "required_facts":["투자전략"],"filters":[],"metrics":[],"periods":[],"sort":[],
        "limit":null,"return_all":false,"missing":{"for_personalization":[],"from_evidence":[]},
        "gap_types":[],"answerable_now":true,"follow_ups":[],"safety_flags":[],
        "tools":["RESOLVE","RAG"],"completeness":"single_answer","plan":[
        {"step":1,"tool":"RESOLVE","purpose":"식별","depends_on":[]},
        {"step":2,"tool":"RAG","purpose":"검색","depends_on":[1]}]}"""
        plan = parse_plan(raw, question).plan
        result = execute_plan(question, plan)
        bundle = build_context(plan, result, char_budget=900)
        self.assertTrue(bundle.text)
        self.assertTrue(bundle.truncated)
        self.assertTrue(bundle.omitted_evidence_ids)


class FastStructuredTests(unittest.TestCase):
    def test_risk_question_uses_db_without_llm(self):
        result = try_fast_structured("Q", "미래에셋장기성장포커스 위험등급 알려줘")
        self.assertIsNotNone(result)
        self.assertEqual(result["route"], "single_product")
        self.assertIn("LLM 호출 없음", result["think_trace"])
        self.assertIn("위험등급", result["answer"])

    def test_class_fee_question_keeps_class_scope(self):
        result = try_fast_structured("Q", "미래에셋장기성장포커스 A-e 클래스 총보수 얼마야?")
        self.assertIsNotNone(result)
        self.assertIn("A-e", result["answer"])

    def test_ambiguous_family_is_not_arbitrarily_selected(self):
        result = try_fast_structured("Q", "솔로몬 국공채 펀드 총보수 알려줘")
        self.assertIsNone(result)


class SimpleDocumentTests(unittest.TestCase):
    def setUp(self):
        # 로컬 .env에 실제 키가 있어도 단위 테스트가 유료 호출을 하지 않는다.
        self.generate_patcher = patch(
            "agent_v2.document_path.generate",
            return_value=(None, "테스트에서 LLM 호출 생략"),
        )
        self.generate_patcher.start()

    def tearDown(self):
        self.generate_patcher.stop()

    def test_cover_and_toc_are_rejected(self):
        self.assertFalse(_usable({"doc_id": "d", "page": 1, "text": "(표지) 투자설명서"}))
        self.assertFalse(_usable({"doc_id": "d", "page": 2, "text": "1. 투자전략"}))

    def test_product_document_path_is_scoped_and_cited(self):
        result = try_simple_product_document("Q", "미래에셋장기성장포커스 투자전략은 뭐야?")
        self.assertIsNotNone(result)
        self.assertEqual(result["route"], "rag")
        self.assertIn("p.", result["answer"])
        self.assertIn("상품 문서 Hybrid RAG", result["think_trace"])

    def test_atomic_institution_fact_skips_llm(self):
        result = try_simple_institution_document("Q", "IRP의 세액공제 한도는 얼마인가요?")
        self.assertIsNotNone(result)
        self.assertEqual(result["route"], "institution_facts")
        self.assertIn("LLM 호출 없음", result["think_trace"])

    def test_procedure_uses_institution_rag_with_citation(self):
        result = try_simple_institution_document("Q", "퇴직연금 장외채권 매수 신청 어떻게 해?")
        self.assertIsNotNone(result)
        self.assertEqual(result["route"], "rag")
        self.assertIn("p.", result["answer"])
        self.assertIn("표지·목차 제외", result["think_trace"])

    def test_buy_cancel_prefers_exact_procedure(self):
        result = try_simple_institution_document("Q", "매수취소 어떻게해?")
        self.assertIsNotNone(result)
        self.assertIn("doc7", result["answer"])
        self.assertIn("연금계좌현황", result["answer"])

    def test_deposit_maturity_is_document_question(self):
        self.assertEqual(
            pre_route("예금 만기상환 자금은 자동 재예치 되는 거 아니었나요?").route,
            "SIMPLE_DOCUMENT",
        )

    def test_faq_index_is_skipped_for_deposit_maturity(self):
        result = try_simple_institution_document(
            "Q", "예금 만기상환 자금은 자동 재예치 되는 거 아니었나요?"
        )
        self.assertIsNotNone(result)
        self.assertIn("doc30 p.9", result["answer"])
        self.assertIn("2023년 7월 12일", result["answer"])

    def test_unrelated_question_is_not_intercepted(self):
        self.assertIsNone(try_simple_institution_document("Q", "오늘 날씨가 어때?"))


if __name__ == "__main__":
    unittest.main()
