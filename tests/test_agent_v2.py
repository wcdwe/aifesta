import unittest

from agent_v2.pre_router import assess_risk, pre_route
from agent_v2.document_path import _usable, try_simple_product_document
from agent_v2.product_resolver import resolve_product
from agent_v2.schemas import ValidationResult
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
        self.assertEqual(result.status, "PASS")

    def test_fail_requires_error(self):
        with self.assertRaises(ValueError):
            ValidationResult(status="FAIL", retry_action="REGENERATE", errors=[])


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
    def test_cover_and_toc_are_rejected(self):
        self.assertFalse(_usable({"doc_id": "d", "page": 1, "text": "(표지) 투자설명서"}))
        self.assertFalse(_usable({"doc_id": "d", "page": 2, "text": "1. 투자전략"}))

    def test_product_document_path_is_scoped_and_cited(self):
        result = try_simple_product_document("Q", "미래에셋장기성장포커스 투자전략은 뭐야?")
        self.assertIsNotNone(result)
        self.assertEqual(result["route"], "rag")
        self.assertIn("p.", result["answer"])
        self.assertIn("상품 문서 Hybrid RAG", result["think_trace"])

    def test_institution_question_is_left_for_existing_path(self):
        self.assertIsNone(try_simple_product_document("Q", "IRP가 무엇인지 설명해줘"))


if __name__ == "__main__":
    unittest.main()
