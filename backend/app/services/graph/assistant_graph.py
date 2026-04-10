"""LangGraph orchestration for the MindSentry assistant."""
from __future__ import annotations

from langgraph.graph import StateGraph, START, END
from sqlmodel import Session

from app.services.graph.state import AssistantGraphState
from app.services.graph.nodes.intake_node import intake_node
from app.services.graph.nodes.crisis_detection_node import crisis_detection_node
from app.services.graph.nodes.wellness_context_node import wellness_context_node
from app.services.graph.nodes.assistant_reasoning_node import assistant_reasoning_node
from app.services.graph.nodes.tool_decision_node import tool_decision_node
from app.services.graph.nodes.user_approval_node import user_approval_node
from app.services.graph.nodes.tool_execution_node import tool_execution_node
from app.services.graph.nodes.final_response_node import final_response_node
from app.services.tools.registry import ToolRegistry


class AssistantGraphService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.registry = ToolRegistry(db)
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AssistantGraphState)

        workflow.add_node("intake_node", intake_node)
        workflow.add_node("crisis_detection_node", crisis_detection_node)
        workflow.add_node("wellness_context_node", lambda state: wellness_context_node(state, self.db))
        workflow.add_node("assistant_reasoning_node", assistant_reasoning_node)
        workflow.add_node("tool_decision_node", lambda state: tool_decision_node(state, self.registry))
        workflow.add_node("user_approval_node", user_approval_node)
        workflow.add_node("tool_execution_node", lambda state: tool_execution_node(state, self.registry))
        workflow.add_node("final_response_node", final_response_node)

        workflow.add_edge(START, "intake_node")
        workflow.add_edge("intake_node", "wellness_context_node")
        workflow.add_edge("wellness_context_node", "crisis_detection_node")

        workflow.add_conditional_edges(
            "crisis_detection_node",
            self._route_after_crisis,
            {
                "crisis_path": "final_response_node",
                "normal_path": "assistant_reasoning_node",
            },
        )

        workflow.add_edge("assistant_reasoning_node", "tool_decision_node")

        workflow.add_conditional_edges(
            "tool_decision_node",
            self._route_after_tool_decision,
            {
                "no_tool": "final_response_node",
                "need_approval": "user_approval_node",
                "execute_tool": "tool_execution_node",
            },
        )

        workflow.add_conditional_edges(
            "user_approval_node",
            self._route_after_approval,
            {
                "approved": "tool_execution_node",
                "denied": "final_response_node",
                "awaiting": "final_response_node",
            },
        )

        workflow.add_edge("tool_execution_node", "final_response_node")
        workflow.add_edge("final_response_node", END)

        return workflow.compile()

    @staticmethod
    def _route_after_crisis(state: AssistantGraphState) -> str:
        return "crisis_path" if state.get("risk_level") == "crisis" else "normal_path"

    @staticmethod
    def _route_after_tool_decision(state: AssistantGraphState) -> str:
        if not state.get("selected_tool"):
            return "no_tool"
        if state.get("requires_consent") and state.get("consent_status") in {"pending", "denied"}:
            return "need_approval"
        return "execute_tool"

    @staticmethod
    def _route_after_approval(state: AssistantGraphState) -> str:
        status = state.get("consent_status")
        if status == "approved":
            return "approved"
        if status == "denied":
            return "denied"
        return "awaiting"

    def invoke(self, state: AssistantGraphState) -> AssistantGraphState:
        return self.graph.invoke(state)
