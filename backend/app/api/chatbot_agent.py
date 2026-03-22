"""
AarogyaAI and Agent API endpoints.
Provides REST API for chat interactions and agentic tasks.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
import logging
import re

from app.core.database import get_session
from app.api.auth import get_current_user
from app.models.user import User
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.agent_task import AgentTask
from app.services.chatbot_service import get_chatbot_service, ChatbotService
from app.services.agent_orchestrator import get_agent_orchestrator, AgentOrchestrator

logger = logging.getLogger(__name__)

# Pydantic schemas for request/response
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict, Any


class ChatMessageRequest(BaseModel):
    """Request to send a message to AarogyaAI."""
    message: str
    session_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    """Response from AarogyaAI."""
    session_id: str
    message_id: str
    response: str
    context_used: bool
    retrieved_context: List[Dict[str, Any]] = []


class ChatSessionResponse(BaseModel):
    """Chat session information."""
    id: str
    title: str
    created_at: datetime
    last_message_at: datetime
    is_active: bool


class AgentTaskRequest(BaseModel):
    """Request to execute an agent task."""
    task_type: str  # find_location, find_clinics, book_appointment, call_ambulance
    description: str
    input_params: Dict[str, Any] = {}
    session_id: Optional[str] = None


class AgentTaskResponse(BaseModel):
    """Response from agent task execution."""
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    reasoning: Optional[str] = None
    error: Optional[str] = None


# Create router
router = APIRouter(
    prefix="/api/v2/chat-agent",
    tags=["chat-agent"],
    dependencies=[Depends(get_current_user)],
)


# ────────────────────────────────────────────────────────────────────────────
# AAROGYAAI CHAT ENDPOINTS
# ────────────────────────────────────────────────────────────────────────────

@router.post("/chat/message", response_model=ChatMessageResponse)
async def send_chat_message(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """
    Send a message to AarogyaAI.
    Returns an empathetic, context-aware response based on user wellness data.
    """
    try:
        chatbot_service = get_chatbot_service(db_session)
        
        result = await chatbot_service.send_message(
            user_id=current_user.id,
            message_content=request.message,
            session_id=request.session_id
        )
        
        return ChatMessageResponse(**result)
    
    except Exception as e:
        logger.exception(f"Error processing message from user {current_user.id}")
        raise HTTPException(
            status_code=500,
            detail="Error processing message. Please try again."
        )


@router.get("/chat/sessions", response_model=List[ChatSessionResponse])
async def get_user_sessions(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """Get all chat sessions for the current user."""
    try:
        chatbot_service = get_chatbot_service(db_session)
        sessions = chatbot_service.get_user_sessions(current_user.id, limit=limit)
        
        return [
            ChatSessionResponse(
                id=s.id,
                title=s.title,
                created_at=s.created_at,
                last_message_at=s.last_message_at,
                is_active=s.is_active,
            )
            for s in sessions
        ]
    
    except Exception as e:
        logger.exception(f"Error fetching sessions for user {current_user.id}")
        raise HTTPException(
            status_code=500,
            detail="Error fetching sessions"
        )


@router.get("/chat/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """Get all messages in a chat session (ownership verified)."""
    try:
        chatbot_service = get_chatbot_service(db_session)
        
        # Verify session ownership before returning messages
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        session = db_session.exec(stmt).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        
        messages = chatbot_service.get_session_messages(session_id, limit=limit)
        
        return {
            "session_id": session_id,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at,
                }
                for m in messages
            ]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching messages for session {session_id}")
        raise HTTPException(
            status_code=500,
            detail="Error fetching messages"
        )


@router.post("/chat/sessions/{session_id}/close")
async def close_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """Close a chat session (ownership verified)."""
    try:
        # Verify session ownership before closing
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        session = db_session.exec(stmt).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        
        chatbot_service = get_chatbot_service(db_session)
        closed_session = chatbot_service.close_session(session_id)
        
        return {
            "status": "closed",
            "session_id": closed_session.id,
            "closed_at": datetime.now(timezone.utc).isoformat(),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error closing session {session_id}")
        raise HTTPException(
            status_code=500,
            detail="Error closing session"
        )


# ────────────────────────────────────────────────────────────────────────────
# AGENT ENDPOINTS
# ────────────────────────────────────────────────────────────────────────────

@router.post("/agent/task", response_model=AgentTaskResponse)
async def execute_agent_task(
    request: AgentTaskRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """
    Execute an agentic task (find location, find clinics, book appointment, call ambulance).
    The agent will use reasoning to determine the best course of action.
    """
    try:
        agent_orchestrator = get_agent_orchestrator(db_session)
        
        result = await agent_orchestrator.execute_task(
            user_id=current_user.id,
            task_type=request.task_type,
            task_description=request.description,
            input_params=request.input_params,
            session_id=request.session_id
        )
        
        if result.get("success"):
            return AgentTaskResponse(
                task_id=result.get("task_id"),
                status="completed",
                result=result.get("result"),
                reasoning=result.get("reasoning"),
            )
        else:
            return AgentTaskResponse(
                task_id=result.get("task_id"),
                status="failed",
                error=result.get("error"),
            )
    
    except Exception as e:
        logger.exception(f"Error executing agent task for user {current_user.id}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while processing agent task"
        )


@router.get("/agent/tasks")
async def get_user_agent_tasks(
    status: Optional[str] = Query(None, enum=["pending", "executing", "completed", "failed"]),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """Get agent tasks for the current user."""
    try:
        from sqlmodel import select
        
        stmt = select(AgentTask).where(AgentTask.user_id == current_user.id)
        
        if status:
            stmt = stmt.where(AgentTask.status == status)
        
        stmt = stmt.order_by(AgentTask.created_at.desc()).limit(limit)
        tasks = db_session.exec(stmt).all()
        
        return {
            "count": len(tasks),
            "tasks": [
                {
                    "id": t.id,
                    "task_type": t.task_type,
                    "status": t.status,
                    "created_at": t.created_at,
                    "completed_at": t.completed_at,
                    "error": t.error_message,
                }
                for t in tasks
            ]
        }
    
    except Exception as e:
        logger.exception(f"Error fetching tasks for user {current_user.id}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching tasks"
        )


@router.get("/agent/tasks/{task_id}")
async def get_agent_task_details(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """Get details of a specific agent task."""
    try:
        from sqlmodel import select
        
        stmt = select(AgentTask).where(
            (AgentTask.id == task_id) &
            (AgentTask.user_id == current_user.id)
        )
        
        task = db_session.exec(stmt).first()
        
        if not task:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )
        
        return {
            "id": task.id,
            "task_type": task.task_type,
            "status": task.status,
            "input_params": task.get_input_params(),
            "result": task.get_result(),
            "reasoning": task.reasoning,
            "error": task.error_message,
            "created_at": task.created_at,
            "completed_at": task.completed_at,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching task {task_id} for user {current_user.id}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching task"
        )


# ────────────────────────────────────────────────────────────────────────────
# COMBINED ENDPOINTS (Chat + Agent)
# ────────────────────────────────────────────────────────────────────────────

@router.post("/chat-with-agent")
async def chat_with_agent_capability(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_session),
):
    """
    Send a message to AarogyaAI with potential agent task capability.
    If the message implies a task (find clinics, book appointment), the agent will handle it.
    Otherwise, AarogyaAI will provide support.
    """
    try:
        chatbot_service = get_chatbot_service(db_session)
        agent_orchestrator = get_agent_orchestrator(db_session)
        
        # First, send to AarogyaAI
        chat_result = await chatbot_service.send_message(
            user_id=current_user.id,
            message_content=request.message,
            session_id=request.session_id
        )
        
        # Analyze if agent task is needed (simple heuristic - can be improved)
        message_lower = request.message.lower()
        agent_keywords = [
            "book appointment", "find clinic", "find hospital", "find doctor",
            "nearest clinic", "nearby hospital",
            "location", "near me", "my location", "nearby clinics"
        ]
        
        should_trigger_agent = any(keyword in message_lower for keyword in agent_keywords)
        
        # Emergency calls require explicit confirmation - do NOT auto-trigger
        is_emergency_request = "emergency" in message_lower or "ambulance" in message_lower or "call ambulance" in message_lower
        
        agent_result = None
        if should_trigger_agent:
            # Determine task type from message
            task_type = "find_clinics"
            if "book" in message_lower and "appointment" in message_lower:
                task_type = "book_appointment"
            elif "location" in message_lower or "where" in message_lower:
                task_type = "find_location"

            # Extract location hints from message to avoid geocoding the LLM reasoning text.
            input_params = {}

            # Match coordinates like: 12.9716, 77.5946
            coord_match = re.search(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)", request.message)
            if coord_match:
                try:
                    input_params["latitude"] = float(coord_match.group(1))
                    input_params["longitude"] = float(coord_match.group(2))
                except ValueError:
                    pass

            # Try to capture address phrase from natural language
            address_match = re.search(
                r"(?:in|near|at|around)\s+([A-Za-z0-9\s,.-]{3,})$",
                request.message.strip(),
                flags=re.IGNORECASE,
            )
            if address_match and "address" not in input_params:
                input_params["address"] = address_match.group(1).strip()

            # Clinic preference hints
            if "emergency" in message_lower:
                input_params["clinic_type"] = "emergency"
                input_params["has_emergency"] = True
            elif "mental" in message_lower or "psychi" in message_lower:
                input_params["clinic_type"] = "mental_health"
            elif "specialist" in message_lower:
                input_params["clinic_type"] = "specialist"

            # Radius hint e.g. "within 5 km" or "10km"
            radius_match = re.search(r"(\d+(?:\.\d+)?)\s*km", message_lower)
            if radius_match:
                try:
                    input_params["radius_km"] = float(radius_match.group(1))
                except ValueError:
                    pass
            
            agent_result = await agent_orchestrator.execute_task(
                user_id=current_user.id,
                task_type=task_type,
                task_description=request.message,
                input_params=input_params,
                session_id=chat_result.get("session_id")
            )
        elif is_emergency_request:
            # For emergency requests, return a prompt asking for explicit confirmation
            # Do NOT automatically execute call_ambulance without user confirmation
            agent_result = {
                "emergency_confirmation_required": True,
                "message": "Emergency detected. Please confirm you want to call an ambulance."
            }
        
        return {
            "session_id": chat_result.get("session_id"),
            "message_id": chat_result.get("message_id"),
            "chatbot_response": chat_result.get("response"),
            "context_used": chat_result.get("context_used"),
            "agent_triggered": should_trigger_agent,
            "emergency_confirmation_required": is_emergency_request,
            "agent_result": agent_result,
        }
    
    except Exception as e:
        logger.exception(f"Error in chat-with-agent for user {current_user.id}")
        return {
            "session_id": request.session_id,
            "message_id": None,
            "chatbot_response": "I ran into a temporary issue while processing your message. Please try again.",
            "context_used": False,
            "agent_triggered": False,
            "emergency_confirmation_required": False,
            "agent_result": {
                "success": False,
                "error": "internal_error",
                "message": "A temporary internal issue occurred while processing chat-with-agent."
            },
        }
