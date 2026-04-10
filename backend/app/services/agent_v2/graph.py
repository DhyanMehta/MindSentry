from __future__ import annotations

from sqlmodel import Session
from langgraph.graph import StateGraph, START, END

from app.services.agent_v2.nodes import intent_reasoning_node, context_builder_node, agent_llm_node
from app.services.agent_v2.state import ChatAgentState


class ChatAgentV2Service:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(ChatAgentState)

        workflow.add_node("intent", intent_reasoning_node)
        workflow.add_node("context", lambda state: context_builder_node(state, self.db))
        workflow.add_node("agent", agent_llm_node)

        workflow.add_edge(START, "intent")
        workflow.add_edge("intent", "context")
        workflow.add_edge("context", "agent")
        workflow.add_edge("agent", END)

        return workflow.compile()

    def invoke(self, state: ChatAgentState) -> ChatAgentState:
        return self.graph.invoke(state)
