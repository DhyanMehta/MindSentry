"""
RAG Pipeline Service using LangChain and ChromaDB.
Builds context from user wellness data for enhanced AarogyaAI responses.
"""
import asyncio
import os
import json
import tempfile
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain_groq import ChatGroq
from langchain.prompts import PromptTemplate

from app.core.config import get_settings
from app.models.user_wellness_context import UserWellnessContext
from app.models.assessment import Assessment
from app.models.chat_message import ChatMessage


settings = get_settings()
logger = logging.getLogger(__name__)


class RAGPipeline:
    """
    RAG Pipeline for building context-aware responses from user wellness data.
    Uses LangChain + ChromaDB for vector storage and retrieval.
    """
    FALLBACK_MODELS = [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
    ]
    
    def __init__(self):
        """Initialize the RAG pipeline with embeddings and vector store."""
        # Configure sentence-transformers cache directory
        # Use environment variable with fallback to .mindsentry_cache in project root
        cache_folder = os.getenv("SENTENCE_TRANSFORMERS_CACHE")
        if not cache_folder:
            # Fallback: use project cache directory instead of /tmp
            cache_folder = str(Path(__file__).parent.parent.parent / ".mindsentry_cache" / "sentence_transformers")
        
        # Use sentence-transformers for embeddings (free, no API key needed)
        self.embeddings = SentenceTransformerEmbeddings(
            model_name="all-MiniLM-L6-v2",  # Lightweight, fast model
            cache_folder=cache_folder
        )
        
        # Configure ChromaDB persistent storage directory
        # Use environment variable with fallback to .mindsentry_cache in project root
        persist_directory = os.getenv("CHROMA_PERSIST_DIR")
        if not persist_directory:
            # Fallback: use project cache directory instead of /tmp
            persist_directory = str(Path(__file__).parent.parent.parent / ".mindsentry_cache" / "chroma_db")
        
        os.makedirs(persist_directory, exist_ok=True)
        
        # Initialize ChromaDB with persistent storage
        self.persist_directory = persist_directory
        
        self.vectorstore = Chroma(
            embedding_function=self.embeddings,
            persist_directory=self.persist_directory,
            collection_name="user_wellness_context",
        )
        
        # Initialize LLM for RAG chain
        self.api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
        self.model_name = settings.groq_model or self.FALLBACK_MODELS[0]
        self.llm = ChatGroq(
            model=self.model_name,
            api_key=self.api_key,
            temperature=0.3,
        ) if self.api_key else None
        
        # Text splitter for chunking documents
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
    
    def build_wellness_context_text(self, wellness_context: UserWellnessContext) -> str:
        """
        Build a comprehensive text summary of user wellness data.
        This text will be embedded and used for context retrieval.
        """
        context_parts = []
        
        # Overall wellness summary
        context_parts.append(f"Overall Wellness Score: {wellness_context.overall_wellness_score}/100")
        context_parts.append(f"Mental Health Score: {wellness_context.mental_health_score}/100")
        context_parts.append(f"Emotional Stability: {wellness_context.emotional_stability_score}/100")
        context_parts.append(f"Stress Level: {wellness_context.stress_level}/100")
        context_parts.append(f"Anxiety Level: {wellness_context.anxiety_level}/100")
        context_parts.append(f"Mood Score: {wellness_context.mood_score}/100")
        context_parts.append(f"Sleep Quality: {wellness_context.sleep_quality_score}/100")
        context_parts.append(f"Engagement Score: {wellness_context.engagement_score}/100")
        
        # Risk and crisis information
        context_parts.append(f"Risk Level: {wellness_context.risk_level}")
        if wellness_context.has_crisis_flag:
            context_parts.append(f"⚠️ CRISIS FLAG ACTIVE since {wellness_context.crisis_date}")
        
        # Treatment and care context
        if wellness_context.is_in_treatment:
            context_parts.append(f"Currently in treatment: {wellness_context.treatment_type}")
        if wellness_context.clinician_assigned:
            context_parts.append("Assigned to a clinician for support")
        
        # Recent activity
        if wellness_context.last_assessment_date:
            days_ago = (datetime.utcnow() - wellness_context.last_assessment_date).days
            context_parts.append(f"Last assessment: {days_ago} days ago")
        context_parts.append(f"Total assessments completed: {wellness_context.total_assessments}")
        context_parts.append(f"Assessment frequency: {wellness_context.assessment_frequency}")
        
        return "\n".join(context_parts)
    
    async def upsert_user_wellness_context(
        self, 
        user_id: int, 
        wellness_context: UserWellnessContext,
        db_session
    ) -> None:
        """
        Upsert user wellness context into vector store.
        Called whenever wellness data is updated.
        """
        # Build comprehensive context text
        if not wellness_context.context_text:
            wellness_context.context_text = self.build_wellness_context_text(wellness_context)
        
        # Create documents for embedding
        documents = []
        
        # Split wellness context text into chunks
        chunks = self.text_splitter.split_text(wellness_context.context_text)
        for i, chunk in enumerate(chunks):
            doc = Document(
                page_content=chunk,
                metadata={
                    "user_id": user_id,
                    "type": "wellness_context",
                    "chunk_index": i,
                    "updated_at": wellness_context.updated_at.isoformat(),
                }
            )
            documents.append(doc)
        
        # Add summary document
        summary_doc = Document(
            page_content=f"User {user_id} wellness summary: {wellness_context.context_text}",
            metadata={
                "user_id": user_id,
                "type": "wellness_summary",
                "risk_level": wellness_context.risk_level,
                "has_crisis": wellness_context.has_crisis_flag,
            }
        )
        documents.append(summary_doc)
        
        if documents:
            # Add documents to vector store (will upsert existing)
            ids = [f"wellness_{user_id}_{i}" for i in range(len(documents))]
            self.vectorstore.add_documents(documents, ids=ids)
            self.vectorstore.persist()
    
    def retrieve_user_context(
        self, 
        user_id: int, 
        query: str,
        k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant wellness context for a user based on a query.
        Used for augmenting AarogyaAI responses.
        """
        # Filter by user_id
        results = self.vectorstore.similarity_search_with_score(
            query,
            k=k,
            filter={"user_id": user_id}
        )
        
        context_docs = []
        for doc, score in results:
            context_docs.append({
                "content": doc.page_content,
                "relevance_score": 1 - score,  # Convert distance to similarity
                "metadata": doc.metadata,
            })
        
        return context_docs
    
    def build_system_prompt_with_context(
        self,
        user_wellness_context: Optional[UserWellnessContext],
        retrieved_context: List[Dict[str, Any]]
    ) -> str:
        """
        Build a system prompt that includes user wellness context.
        Used to prime the LLM for contextual responses.
        """
        context_text = "---\nUSER WELLNESS CONTEXT:\n"
        for i, ctx in enumerate(retrieved_context, 1):
            context_text += f"\n{i}. {ctx['content']}\n"
        
        # Add risk/treatment context only when wellness profile exists
        if user_wellness_context:
            if user_wellness_context.has_crisis_flag:
                context_text += "\n⚠️ NOTE: User has active crisis flag. Prioritize safety and mental health resources.\n"
            
            if user_wellness_context.is_in_treatment:
                context_text += f"\n📋 User is in {user_wellness_context.treatment_type}. Reference their ongoing care when relevant.\n"
        
        context_text += "---\n"
        
        system_prompt = f"""You are AarogyaAI, an empathetic mental health support assistant. 
Your role is to provide helpful, compassionate support based on the user's wellness data and history.

{context_text}

Guidelines:
1. Acknowledge the user's wellness context when relevant
2. Provide personalized recommendations based on their wellness scores
3. If crisis flag is active, prioritize safety resources and suggest immediate professional help
4. Be empathetic and non-judgmental
5. For serious concerns, always recommend contacting a mental health professional
6. Respect the user's privacy and data

Remember: You are a support tool, not a substitute for professional mental health care."""
        
        return system_prompt
    
    async def get_augmented_response(
        self,
        user_id: int,
        user_query: str,
        wellness_context: Optional[UserWellnessContext] = None,
        conversation_history: Optional[List[ChatMessage]] = None
    ) -> Dict[str, Any]:
        """
        Get an augmented response from AarogyaAI using RAG.
        Retrieves relevant wellness context and generates a response.
        """
        if not self.llm:
            # Graceful fallback so chat endpoints don't fail with 500.
            return {
                "response": "I'm available, but AI response generation is currently not configured. Please set GROQ_API_KEY and try again.",
                "retrieved_context": [],
                "used_wellness_data": False,
            }
        
        # Retrieve relevant wellness context
        retrieved_context = self.retrieve_user_context(user_id, user_query, k=5)
        
        # Build system prompt with context
        system_prompt = self.build_system_prompt_with_context(wellness_context, retrieved_context)
        
        # Prepare conversation history for context
        history_text = ""
        if conversation_history:
            for msg in conversation_history[-5:]:  # Last 5 messages for context
                history_text += f"{msg.role.upper()}: {msg.content}\n"
        
        # Build final prompt
        full_prompt = system_prompt + "\n\nPrevious context:\n" + history_text + f"\nUSER: {user_query}"
        
        # Get response from LLM
        try:
            response = await asyncio.wait_for(self.llm.ainvoke(full_prompt), timeout=60)
            response_text = response.content
        except asyncio.TimeoutError:
            response_text = "I'm taking longer than expected to respond right now. Please try again in a moment."
        except Exception as e:
            err_text = str(e)
            # Automatic one-time fallback when configured model is decommissioned.
            if "model_decommissioned" in err_text and self.api_key:
                for fallback_model in self.FALLBACK_MODELS:
                    if fallback_model == self.model_name:
                        continue
                    try:
                        logger.warning("Switching Groq model from %s to fallback %s", self.model_name, fallback_model)
                        self.llm = ChatGroq(
                            model=fallback_model,
                            api_key=self.api_key,
                            temperature=0.3,
                        )
                        self.model_name = fallback_model
                        retry_response = await asyncio.wait_for(self.llm.ainvoke(full_prompt), timeout=60)
                        response_text = retry_response.content
                        break
                    except Exception:
                        continue
                else:
                    response_text = "AI service is temporarily unavailable. Please try again in a few minutes."
            else:
                logger.exception("RAG generation failed")
                response_text = "I ran into a temporary issue while generating a response. Please try again."
        
        return {
            "response": response_text,
            "retrieved_context": retrieved_context,
            "used_wellness_data": bool(retrieved_context),
        }


def get_rag_pipeline() -> RAGPipeline:
    """Factory function to get RAG pipeline instance."""
    return RAGPipeline()
