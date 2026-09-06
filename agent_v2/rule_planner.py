"""Failed Planner JSON never invokes a looser condition parser."""
def build_rule_plan(question):
    from .structured_request import compile_structured
    return compile_structured(question)
