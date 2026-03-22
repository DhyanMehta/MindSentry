"""
Agent Orchestration Service - ReAct pattern for agentic AI.
Coordinates tool usage and manages agent task execution.
"""
import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from langchain_groq import ChatGroq
from langchain.agents import tool
from langchain.tools import Tool
from sqlmodel import Session, select

from app.models.agent_task import AgentTask
from app.models.chat_session import ChatSession
from app.models.user import User
from app.services.agent_tools_service import AgentToolsService
from app.core.config import get_settings


settings = get_settings()
logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """
    ReAct pattern agent that orchestrates tool usage for complex tasks.
    Thinks, plans, acts, and observes results.
    """
    FALLBACK_MODELS = [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
    ]
    
    def __init__(self, db_session: Session):
        """Initialize agent with database session and tools."""
        self.db_session = db_session
        self.tools_service = AgentToolsService(db_session)
        
        # Initialize LLM for agent reasoning
        import os
        self.api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
        self.model_name = settings.groq_model or self.FALLBACK_MODELS[0]
        self.llm = ChatGroq(
            model=self.model_name,
            api_key=self.api_key,
            temperature=0.1,  # Lower temperature for more deterministic reasoning
        ) if self.api_key else None
        
        # Tools will be defined dynamically per request with user_id parameter
    
    def _define_tools(self, user_id: int) -> List[Tool]:
        """Define all available tools for the agent with user_id context."""
        tools = []
        
        # Tool 1: Find user location
        @tool("find_location")
        def find_location(address: Optional[str] = None) -> str:
            """Find user's current location from address. Returns location with coordinates."""
            result = self.tools_service.find_user_location(
                user_id=user_id,
                address=address
            )
            return json.dumps(result)
        
        tools.append(find_location)
        
        # Tool 2: Find nearby clinics
        @tool("find_nearby_clinics")
        def find_nearby_clinics(
            latitude: float,
            longitude: float,
            clinic_type: Optional[str] = None,
            has_emergency: bool = False,
            radius_km: float = 10.0
        ) -> str:
            """Find nearby health clinics. Returns list of nearby clinics with distances."""
            result = self.tools_service.find_nearby_clinics(
                latitude=latitude,
                longitude=longitude,
                clinic_type=clinic_type,
                has_emergency=has_emergency,
                radius_km=radius_km
            )
            return json.dumps(result)
        
        tools.append(find_nearby_clinics)
        
        # Tool 3: Book appointment
        @tool("book_appointment")
        def book_appointment(
            clinic_id: str,
            appointment_date: str,
            appointment_type: str = "consultation",
            reason: Optional[str] = None
        ) -> str:
            """Book an appointment at a clinic. Returns confirmation number and details."""
            result = self.tools_service.book_appointment(
                user_id=user_id,
                clinic_id=clinic_id,
                appointment_date=appointment_date,
                appointment_type=appointment_type,
                reason=reason
            )
            return json.dumps(result)
        
        tools.append(book_appointment)
        
        # Tool 4: Call ambulance
        @tool("call_ambulance")
        def call_ambulance(
            latitude: float,
            longitude: float,
            urgency: str = "high",
            description: Optional[str] = None
        ) -> str:
            """Call emergency ambulance to current location. Returns dispatch confirmation."""
            result = self.tools_service.call_ambulance(
                user_id=user_id,
                latitude=latitude,
                longitude=longitude,
                urgency=urgency,
                description=description
            )
            return json.dumps(result)
        
        tools.append(call_ambulance)
        
        return tools
    
    async def execute_task(
        self,
        user_id: int,
        task_type: str,
        task_description: str,
        input_params: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute an agent task using ReAct pattern.
        
        Args:
            user_id: User ID
            task_type: Type of task (find_location, find_clinics, book_appointment, call_ambulance)
            task_description: Natural language description of task
            input_params: Initial parameters for the task
            session_id: Associated chat session ID
        
        Returns:
            Dict with task execution result
        """
        if not self.llm:
            return {
                "success": False,
                "error": "LLM not initialized",
                "message": "Agent not available. Please set GROQ_API_KEY."
            }
        
        # Create agent task record
        agent_task = AgentTask(
            user_id=user_id,
            chat_session_id=session_id,
            task_type=task_type,
            status="executing",
            input_params=json.dumps(input_params),
        )
        self.db_session.add(agent_task)
        self.db_session.commit()
        self.db_session.refresh(agent_task)
        
        try:
            # Define tools with user_id context (no mutable instance state)
            tools = self._define_tools(user_id)
            
            # Build ReAct prompt
            system_prompt = self._build_agent_prompt(task_type, task_description, input_params)
            
            # Get agent thinking using async-compatible method
            try:
                response = await asyncio.wait_for(self.llm.ainvoke(system_prompt), timeout=60)
                reasoning = response.content
            except Exception as llm_error:
                err_text = str(llm_error)
                if "model_decommissioned" in err_text and self.api_key:
                    reasoning = None
                    for fallback_model in self.FALLBACK_MODELS:
                        if fallback_model == self.model_name:
                            continue
                        try:
                            logger.warning("Switching Groq model from %s to fallback %s", self.model_name, fallback_model)
                            self.llm = ChatGroq(
                                model=fallback_model,
                                api_key=self.api_key,
                                temperature=0.1,
                            )
                            self.model_name = fallback_model
                            retry_response = await asyncio.wait_for(self.llm.ainvoke(system_prompt), timeout=60)
                            reasoning = retry_response.content
                            break
                        except Exception:
                            continue
                    if reasoning is None:
                        raise RuntimeError("AI model is temporarily unavailable")
                else:
                    raise
            
            # Parse and execute tools based on agent reasoning
            result = await self._execute_tools_from_reasoning(
                reasoning,
                input_params,
                task_type,
                user_id
            )
            
            # Update agent task with result
            agent_task.status = "completed"
            agent_task.completed_at = datetime.now(timezone.utc)
            agent_task.result = json.dumps(result)
            agent_task.reasoning = reasoning
            self.db_session.add(agent_task)
            self.db_session.commit()
            
            return {
                "success": True,
                "task_id": agent_task.id,
                "result": result,
                "reasoning": reasoning
            }
        
        except Exception as e:
            # Update agent task with error
            agent_task.status = "failed"
            agent_task.completed_at = datetime.now(timezone.utc)
            agent_task.error_message = str(e)
            self.db_session.add(agent_task)
            self.db_session.commit()
            
            return {
                "success": False,
                "task_id": agent_task.id,
                "error": str(e),
                "message": f"Task failed: {str(e)}"
            }
    
    def _build_agent_prompt(
        self,
        task_type: str,
        task_description: str,
        input_params: Dict[str, Any]
    ) -> str:
        """Build ReAct prompt for the agent."""
        
        tools_description = """
Available Tools:
1. find_location(address) - Find location from address and get coordinates
2. find_nearby_clinics(latitude, longitude, clinic_type, has_emergency, radius_km) - Find nearby health clinics
3. book_appointment(clinic_id, appointment_date, appointment_type, reason) - Book an appointment
4. call_ambulance(latitude, longitude, urgency, description) - Call emergency ambulance

Tool Usage Format:
Thought: [Your reasoning about what to do]
Action: [Tool name]
Action Input: [JSON with parameters]
Observation: [Result from tool execution]
Final Answer: [Final result or next steps]
"""
        
        prompt = f"""You are a helpful healthcare assistant agent. Your role is to help users with healthcare-related tasks.

{tools_description}

Current Task: {task_type}
Description: {task_description}
Input Parameters: {json.dumps(input_params)}

Think step by step. Use the available tools to complete this task. Be concise and helpful.

Let's start:
Thought:"""
        
        return prompt
    
    async def _execute_tools_from_reasoning(
        self,
        reasoning: str,
        input_params: Dict[str, Any],
        task_type: str,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Execute tools based on agent reasoning.
        In a real ReAct implementation, this would parse the reasoning and call tools iteratively.
        For now, we directly call the appropriate tool.
        
        Args:
            reasoning: Agent reasoning output
            input_params: Task parameters
            task_type: Type of task
            user_id: User ID for context isolation
        """
        
        # Map task types to tool execution
        if task_type == "find_location":
            latitude = input_params.get("latitude")
            longitude = input_params.get("longitude")
            address = input_params.get("address")

            if latitude is None and longitude is None and not address:
                return {
                    "success": False,
                    "error": "missing_location_input",
                    "message": "Please provide an address or coordinates to find your location."
                }

            result = await self.tools_service.find_user_location(
                user_id=user_id,
                address=address,
                latitude=latitude,
                longitude=longitude,
            )
        
        elif task_type == "find_clinics":
            latitude = input_params.get("latitude")
            longitude = input_params.get("longitude")
            address = input_params.get("address")
            clinic_type = input_params.get("clinic_type")

            # If coordinates are missing but address exists, geocode first.
            if (latitude is None or longitude is None) and address:
                location_result = await self.tools_service.find_user_location(
                    user_id=user_id,
                    address=address,
                )
                if not location_result.get("success"):
                    return {
                        "success": False,
                        "error": "location_resolution_failed",
                        "message": "Could not resolve the location from address for clinic search.",
                    }

                location_data = location_result.get("data", {})
                latitude = location_data.get("latitude")
                longitude = location_data.get("longitude")

            if latitude is None or longitude is None:
                return {
                    "success": False,
                    "error": "missing_location_input",
                    "message": "Please provide your location (address or coordinates) to find nearby clinics.",
                }
            
            result = await self.tools_service.find_nearby_clinics(
                latitude=latitude,
                longitude=longitude,
                clinic_type=clinic_type,
                has_emergency=input_params.get("has_emergency", False),
                radius_km=input_params.get("radius_km", 10.0)
            )
        
        elif task_type == "book_appointment":
            clinic_id = input_params.get("clinic_id")
            appointment_date = input_params.get("appointment_date")
            reason = input_params.get("reason")
            
            if not clinic_id or not appointment_date:
                return {"success": False, "error": "Missing clinic_id or appointment_date"}
            
            result = await self.tools_service.book_appointment(
                user_id=user_id,
                clinic_id=clinic_id,
                appointment_date=appointment_date,
                reason=reason
            )
        
        elif task_type == "call_ambulance":
            latitude = input_params.get("latitude")
            longitude = input_params.get("longitude")
            urgency = input_params.get("urgency", "high")
            description = input_params.get("description")
            
            if not latitude or not longitude:
                return {"success": False, "error": "Location coordinates required"}
            
            result = await self.tools_service.call_ambulance(
                user_id=user_id,
                latitude=latitude,
                longitude=longitude,
                urgency=urgency,
                description=description
            )
        
        else:
            return {"success": False, "error": f"Unknown task type: {task_type}"}
        
        return result


def get_agent_orchestrator(db_session: Session) -> AgentOrchestrator:
    """Factory function to get agent orchestrator instance."""
    return AgentOrchestrator(db_session)
