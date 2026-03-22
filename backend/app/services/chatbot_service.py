"""
AarogyaAI service using RAG.
Provides context-aware mental health support based on user wellness data.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json
import logging

from sqlmodel import Session, select

from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.user_wellness_context import UserWellnessContext
from app.models.user import User
from app.services.rag_service import get_rag_pipeline


logger = logging.getLogger(__name__)


class ChatbotService:
    """
    AarogyaAI chat service that provides context-aware responses using a RAG pipeline.
    """
    
    def __init__(self, db_session: Session):
        """Initialize AarogyaAI service with database session and RAG pipeline."""
        self.db_session = db_session
        self.rag_pipeline = get_rag_pipeline()
    
    def create_chat_session(self, user_id: int, title: Optional[str] = None) -> ChatSession:
        """Create a new chat session for a user."""
        session = ChatSession(
            user_id=user_id,
            title=title or f"AarogyaAI Chat - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        )
        self.db_session.add(session)
        self.db_session.commit()
        self.db_session.refresh(session)
        return session
    
    def get_or_create_active_session(self, user_id: int) -> ChatSession:
        """Get existing active session or create a new one."""
        # Check for active session from last 24 hours
        stmt = select(ChatSession).where(
            (ChatSession.user_id == user_id) &
            (ChatSession.is_active == True) &
            (ChatSession.last_message_at > datetime.utcnow() - timedelta(hours=24))
        ).order_by(ChatSession.last_message_at.desc()).limit(1)
        
        session = self.db_session.exec(stmt).first()
        if session:
            return session
        
        # Create new session
        return self.create_chat_session(user_id)
    
    async def send_message(
        self,
        user_id: int,
        message_content: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send a message to AarogyaAI and get a context-aware response.
        
        Returns:
            Dict with response, context used, and metadata
        """
        # Get or create session
        if session_id:
            stmt = select(ChatSession).where(ChatSession.id == session_id)
            session = self.db_session.exec(stmt).first()
            if not session:
                raise ValueError(f"Session {session_id} not found")
        else:
            session = self.get_or_create_active_session(user_id)
        
        # Store user message
        user_msg = ChatMessage(
            session_id=session.id,
            user_id=user_id,
            role="user",
            content=message_content,
        )
        self.db_session.add(user_msg)
        self.db_session.commit()
        self.db_session.refresh(user_msg)
        
        # Get user wellness context
        stmt = select(UserWellnessContext).where(UserWellnessContext.user_id == user_id)
        wellness_context = self.db_session.exec(stmt).first()
        
        # Get recent conversation history for context
        stmt = select(ChatMessage).where(
            ChatMessage.session_id == session.id
        ).order_by(ChatMessage.created_at.desc()).limit(10)
        
        recent_messages = list(reversed(self.db_session.exec(stmt).all()))
        
        # Get augmented response from RAG pipeline
        try:
            response_data = await self.rag_pipeline.get_augmented_response(
                user_id=user_id,
                user_query=message_content,
                wellness_context=wellness_context,
                conversation_history=recent_messages
            )
        except Exception:
            logger.exception("RAG response generation failed for user %s", user_id)
            response_data = {
                "response": "I'm having trouble generating a full response right now. Please try again in a moment.",
                "retrieved_context": [],
                "used_wellness_data": False,
            }
        
        # Store assistant response
        assistant_msg = ChatMessage(
            session_id=session.id,
            user_id=user_id,
            role="assistant",
            content=response_data["response"],
            wellness_context_used=json.dumps([
                ctx["content"][:100] for ctx in response_data.get("retrieved_context", [])
            ]),
            message_type="text",
        )
        self.db_session.add(assistant_msg)
        
        # Update session metadata
        session.last_message_at = datetime.utcnow()
        session.wellness_context_used = response_data.get("used_wellness_data", False)
        self.db_session.add(session)
        self.db_session.commit()
        
        return {
            "session_id": session.id,
            "message_id": assistant_msg.id,
            "response": response_data["response"],
            "retrieved_context": response_data.get("retrieved_context", []),
            "context_used": response_data.get("used_wellness_data", False),
        }
    
    def get_session_messages(self, session_id: str, limit: int = 50) -> List[ChatMessage]:
        """Get all messages in a chat session."""
        stmt = select(ChatMessage).where(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.created_at).limit(limit)
        
        return self.db_session.exec(stmt).all()
    
    def get_user_sessions(self, user_id: int, limit: int = 10) -> List[ChatSession]:
        """Get all chat sessions for a user."""
        stmt = select(ChatSession).where(
            ChatSession.user_id == user_id
        ).order_by(ChatSession.last_message_at.desc()).limit(limit)
        
        return self.db_session.exec(stmt).all()
    
    def close_session(self, session_id: str) -> ChatSession:
        """Close a chat session."""
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        session = self.db_session.exec(stmt).first()
        
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        session.is_active = False
        self.db_session.add(session)
        self.db_session.commit()
        self.db_session.refresh(session)
        
        return session
    
    def update_wellness_context(
        self,
        user_id: int,
        wellness_scores: Dict[str, Any]
    ) -> UserWellnessContext:
        """
        Update user wellness context (called when new assessments are completed).
        This triggers RAG pipeline reindexing.
        """
        # Get or create wellness context
        stmt = select(UserWellnessContext).where(UserWellnessContext.user_id == user_id)
        wellness_context = self.db_session.exec(stmt).first()
        
        if not wellness_context:
            wellness_context = UserWellnessContext(user_id=user_id)
        
        # Update scores using allowlist to prevent mass-assignment of sensitive fields
        ALLOWED_WELLNESS_FIELDS = {
            'overall_wellness_score', 'mental_health_score', 'emotional_stability_score',
            'stress_level', 'anxiety_level', 'mood_score', 'sleep_quality_score', 'engagement_score',
            'last_assessment_date', 'last_checkin_date', 'total_assessments', 'total_checkins',
            'assessment_frequency', 'is_in_treatment', 'treatment_type'
        }
        
        for key, value in wellness_scores.items():
            if key in ALLOWED_WELLNESS_FIELDS:
                setattr(wellness_context, key, value)
        
        # Update timestamp
        wellness_context.updated_at = datetime.utcnow()
        wellness_context.context_text = self.rag_pipeline.build_wellness_context_text(wellness_context)
        
        self.db_session.add(wellness_context)
        self.db_session.commit()
        self.db_session.refresh(wellness_context)
        
        # Reindex in RAG pipeline (if upsert_user_wellness_context is async, call it appropriately)
        self.rag_pipeline.upsert_user_wellness_context(
            user_id,
            wellness_context,
            self.db_session
        )
        
        return wellness_context
    
    def handle_crisis_detection(self, user_id: int, reasoning: str) -> None:
        """Handle crisis detection - update context and send alerts."""
        stmt = select(UserWellnessContext).where(UserWellnessContext.user_id == user_id)
        wellness_context = self.db_session.exec(stmt).first()
        
        if wellness_context:
            wellness_context.has_crisis_flag = True
            wellness_context.crisis_date = datetime.utcnow()
            wellness_context.risk_level = "crisis"
            self.db_session.add(wellness_context)
            self.db_session.commit()
            
            # Reindex in RAG (if async, handle appropriately)
            self.rag_pipeline.upsert_user_wellness_context(
                user_id,
                wellness_context,
                self.db_session
            )
        
        # TODO: Send notifications to clinician, emergency contacts


def get_chatbot_service(db_session: Session) -> ChatbotService:
    """Factory function to get AarogyaAI service instance."""
    return ChatbotService(db_session)
