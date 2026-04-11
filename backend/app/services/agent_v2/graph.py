from __future__ import annotations

from sqlmodel import Session
from langgraph.graph import StateGraph, START, END

from app.services.agent_v2.nodes import intent_reasoning_node, context_builder_node, response_router
from app.services.agent_v2.state import ChatAgentState


class ChatAgentV2Service:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(ChatAgentState)

        def intent_node(state: ChatAgentState) -> ChatAgentState:
            print("[GRAPH] Executing node: intent_node")
            return intent_reasoning_node(state)

        def context_node(state: ChatAgentState) -> ChatAgentState:
            print("[GRAPH] Executing node: context_node")
            return context_builder_node(state, self.db)

        def response_router_node(state: ChatAgentState) -> ChatAgentState:
            print("[GRAPH] Executing node: response_router")
            return response_router(state)

        workflow.add_node("intent_node", intent_node)
        workflow.add_node("context_node", context_node)
        workflow.add_node("response_router", response_router_node)

        workflow.add_edge(START, "intent_node")
        workflow.add_edge("intent_node", "context_node")
        workflow.add_edge("context_node", "response_router")
        workflow.add_edge("response_router", END)

        return workflow.compile()

    def invoke(self, state: ChatAgentState) -> ChatAgentState:
        print("[GRAPH] invoke called once for request")
        return self.graph.invoke(state)
