# MindSentry AarogyaAI & Agent System Setup Guide

## Overview

This guide covers the new AarogyaAI assistant and agentic system for MindSentry. The system includes:

1. **RAG-Enhanced AarogyaAI Assistant** - Context-aware responses using user wellness data
2. **Agentic AI System** - Autonomous agent that can find locations, discover clinics, book appointments, and call ambulances
3. **Scalable Architecture** - Built with LangChain, ChromaDB, and Groq LLM

## Architecture Components

### 1. RAG Pipeline (`app/services/rag_service.py`)
- **Vector Database**: ChromaDB for embedding storage
- **Embeddings**: Sentence-Transformers (all-MiniLM-L6-v2)
- **LLM**: Groq API (Mixtral-8x7b-32768) - Free tier available
- **Context**: User wellness data, assessment history, risk levels

### 2. AarogyaAI Service (`app/services/chatbot_service.py`)
- Manages chat sessions and messages
- Retrieves wellness context for each user
- Augments responses with RAG pipeline
- Tracks conversation history

### 3. Agent System (`app/services/agent_orchestrator.py`)
- ReAct (Reasoning + Acting) pattern implementation
- Tool definitions for autonomous actions
- Task tracking and execution monitoring

### 4. Agent Tools (`app/services/agent_tools_service.py`)
- **find_user_location**: geocoding and reverse geocoding
- **find_nearby_clinics**: proximity search with filters
- **book_appointment**: appointment scheduling
- **call_ambulance**: emergency dispatch

### 5. Database Models
- `ChatSession` - Conversation sessions
- `ChatMessage` - Individual messages
- `AgentTask` - Agent task tracking
- `HealthClinic` - Clinic directory
- `Appointment` - Booking records
- `UserWellnessContext` - Aggregated wellness data

### 6. API Endpoints (`app/api/chatbot_agent.py`)
- Chat endpoints: `/api/v2/chat-agent/chat/*`
- Agent endpoints: `/api/v2/chat-agent/agent/*`
- Combined endpoint: `/api/v2/chat-agent/chat-with-agent`

## Setup Instructions

### Requirements
- **Python 3.9+** (minimum 3.8, but 3.9+ recommended for async/await stability)
- **PostgreSQL** (for chat history and wellness data)
- **500MB+ free disk space** (for ChromaDB and sentence-transformer models)
- **Internet connection** (for Groq API and model downloads)

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Required packages added:
- `langchain` - LLM orchestration
- `langchain-groq` - Groq integration
- `chromadb` - Vector database
- `sentence-transformers` - Embeddings
- `geopy` - Geolocation services
- `googlemaps` - Optional: Google Maps integration

### Step 2: Environment Variables

Add to your `.env` file:

```env
# Groq API (Free tier available at https://console.groq.com)
GROQ_API_KEY=your_groq_api_key_here

# Optional: Google Maps API (for advanced location features)
GOOGLE_MAPS_API_KEY=your_google_maps_key_here

# Persistent RAG storage (optional, defaults to .mindsentry_cache)
SENTENCE_TRANSFORMERS_CACHE=/path/to/cache/sentence_transformers
CHROMA_PERSIST_DIR=/path/to/cache/chroma_db

# Database (already configured, no changes needed)
DATABASE_URL=postgresql://...
```

**How to get GROQ_API_KEY:**
1. Visit https://console.groq.com
2. Sign up for free account
3. Create an API key
4. Add to `.env`

### Step 3: Database Migrations

The system automatically creates tables on startup. The following tables are created:

```sql
-- Chat Tables
chat_sessions - Conversation sessions for each user
chat_messages - Individual messages in conversations

-- Agent Tables
agent_tasks - Tracking of agent executions
health_clinics - Directory of health clinics
appointments - Booked appointments

-- Context Tables
user_wellness_contexts - Aggregated wellness data for RAG
```

### Step 4: Initialize Clinic Data

You need to populate the `health_clinics` table. Use this script to seed sample data:

```python
# scripts/seed_clinics.py
from app.models.health_clinic import HealthClinic
from app.core.database import get_session

def seed_clinics():
    """Seed sample clinic data for testing."""
    db = next(get_session())
    
    clinics_data = [
        {
            "name": "City Mental Health Center",
            "address": "123 Main St, New York, NY 10001",
            "city": "New York",
            "state": "NY",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "phone": "+1-212-555-0100",
            "email": "contact@citymh.org",
            "clinic_type": "mental_health",
            "has_emergency": True,
            "has_ambulance": True,
        },
        {
            "name": "Park Avenue General Hospital",
            "address": "456 Park Ave, New York, NY 10002",
            "city": "New York",
            "state": "NY",
            "latitude": 40.7489,
            "longitude": -73.9680,
            "phone": "+1-212-555-0200",
            "email": "info@parkhospital.org",
            "clinic_type": "general",
            "has_emergency": True,
            "has_ambulance": True,
        },
        # Add more clinics as needed
    ]
    
    for clinic_data in clinics_data:
        clinic = HealthClinic(**clinic_data)
        db.add(clinic)
    
    db.commit()
    print(f"Seeded {len(clinics_data)} clinics")

if __name__ == "__main__":
    seed_clinics()
```

Run with:
```bash
cd backend
python -m scripts.seed_clinics
```

## API Usage Examples

### Example 1: Send Chat Message with RAG Context

```bash
curl -X POST "http://localhost:8000/api/v2/chat-agent/chat/message" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I am feeling anxious and stressed lately. What can I do?",
    "session_id": null
  }'
```

**Response:**
```json
{
  "session_id": "abc123",
  "message_id": "msg456",
  "response": "I understand you're feeling anxious. Based on your wellness data...",
  "context_used": true,
  "retrieved_context": [
    {
      "content": "Overall Wellness Score: 45/100...",
      "relevance_score": 0.92,
      "metadata": {...}
    }
  ]
}
```

### Example 2: Find Nearby Clinics (Agent Task)

```bash
curl -X POST "http://localhost:8000/api/v2/chat-agent/agent/task" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "find_clinics",
    "description": "Find mental health clinics near me",
    "input_params": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "clinic_type": "mental_health",
      "radius_km": 10
    }
  }'
```

**Response:**
```json
{
  "task_id": "task789",
  "status": "completed",
  "result": {
    "success": true,
    "count": 5,
    "clinics": [
      {
        "id": "clinic1",
        "name": "City Mental Health Center",
        "address": "123 Main St",
        "distance_km": 2.5,
        "phone": "+1-555-0100",
        "has_emergency": true
      }
    ]
  }
}
```

### Example 3: Book Appointment

```bash
curl -X POST "http://localhost:8000/api/v2/chat-agent/agent/task" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "book_appointment",
    "description": "Book an appointment at the nearest clinic",
    "input_params": {
      "clinic_id": "clinic1",
      "appointment_date": "2024-04-15T14:30:00",
      "appointment_type": "consultation",
      "reason": "Mental health checkup"
    }
  }'
```

### Example 4: Combined Chat with Agent Capability

```bash
curl -X POST "http://localhost:8000/api/v2/chat-agent/chat-with-agent" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need to find a nearby mental health clinic and book an appointment"
  }'
```

This endpoint automatically:
1. Sends message to AarogyaAI for empathetic response
2. Detects if agent action is needed
3. Executes agent task if relevant
4. Returns both AarogyaAI response and agent result

## RAG Pipeline Details

### How It Works

1. **Context Collection**
   - Wellness scores (stress, mood, sleep, etc.)
   - Assessment history
   - Risk level and crisis flags
   - Treatment information

2. **Embedding & Storage**
   - User wellness data is converted to text
   - Text is split into chunks
   - Chunks are embedded using Sentence-Transformers
   - Embeddings stored in ChromaDB with user metadata

3. **Retrieval**
   - When user sends message, similarity search finds relevant context
   - Top-5 relevant documents retrieved
   - Along with relevance scores

4. **Augmentation**
   - Retrieved context added to system prompt
   - LLM uses context to generate personalized response
   - Response considers user's mental state and history

### Updating Wellness Context

When new assessments are completed, update the wellness context:

```python
from app.services.chatbot_service import ChatbotService

service = ChatbotService(db_session)

await service.update_wellness_context(
    user_id=user_id,
    wellness_scores={
        "overall_wellness_score": 65,
        "stress_level": 45,
        "mood_score": 70,
        "sleep_quality_score": 60,
        "anxiety_level": 35,
        "mental_health_score": 68,
        "total_assessments": 15,
        "last_assessment_date": datetime.utcnow(),
    }
)
```

This automatically:
1. Updates UserWellnessContext in DB
2. Rebuilds context text
3. Re-indexes in ChromaDB vector store

## Agent System Details

### ReAct Pattern

The agent uses ReAct (Reasoning + Acting):

1. **Thought**: Agent thinks about what to do
2. **Action**: Decides which tool to use
3. **Observation**: Observes tool result
4. **Final Answer**: Provides result or next steps

### Supported Agent Tasks

| Task Type | Description | Tools Used |
|-----------|-------------|-----------|
| `find_location` | Find user's location from address | Geopy |
| `find_clinics` | Find nearby health clinics | Geopy + DB Query |
| `book_appointment` | Book appointment at clinic | DB Insert |
| `call_ambulance` | Emergency ambulance dispatch | Geopy + Emergency API |

### Task Execution Flow

```
1. User sends request → Chat endpoint
2. Message sent to AarogyaAI → AarogyaAI responds
3. Agent triggers (if keywords detected)
4. Agent task created in DB
5. Agent reasoning performed
6. Tools executed
7. Result stored in DB
8. Response returned to user
```

## Scaling Considerations

### For Production

1. **Vector Store**: Migrate from ChromaDB to Pinecone/Weaviate for larger scale
2. **LLM**: Consider self-hosted LLM for cost/latency
3. **Caching**: Cache frequently accessed wellness contexts
4. **Async Jobs**: Use Celery for long-running agent tasks
5. **Rate Limiting**: Implement per-user rate limits
6. **Monitoring**: Log all agent actions for audit trail

### Database Optimization

```sql
-- Index recommendations for performance
CREATE INDEX idx_chat_messages_session_user 
  ON chat_messages(session_id, user_id, created_at DESC);

CREATE INDEX idx_agent_tasks_user_status 
  ON agent_tasks(user_id, status, created_at DESC);

CREATE INDEX idx_user_wellness_context_updated 
  ON user_wellness_contexts(user_id, updated_at DESC);
```

## Error Handling

The system includes comprehensive error handling:

- **LLM Failures**: Graceful fallback to template responses
- **Geolocation Failures**: Fallback to user-provided address
- **Clinic Not Found**: Clear error message with suggestions
- **Appointment Conflicts**: Validation before booking
- **Coordinate Validation**: Latitude (-90 to 90), Longitude (-180 to 180)
- **Input Sanitization**: All user inputs validated before processing
- **Exception Logging**: Detailed internal logging without exposing details to clients

## Security Considerations

### Authentication & Authorization

1. **Chat Session Access**: All chat endpoints require authentication
   - Sessions are user-specific (verified in get_session_messages)
   - Users can only access their own chat history
   - Sessions automatically linked to authenticated user

2. **Agent Tasks**: Agent execution is user-scoped
   - Tasks track the user who initiated them
   - Results filtered by user_id
   - Concurrent requests don't share state (thread-safe)

### Input Validation

1. **Coordinates**: Validated for geographic ranges
   - Latitude: -90 to +90
   - Longitude: -180 to +180
   - Type checking (must be floats)

2. **Clinic Types**: Limited to allowed values
   - Valid: `general`, `mental_health`, `emergency`, `specialist`
   - Invalid inputs rejected with clear error message

3. **Dates**: ISO 8601 format validation
   - Format: `YYYY-MM-DDTHH:MM:SS` or ISO variation
   - Future dates enforced for appointments
   - Timezone-aware datetime handling

4. **URL Parameters**: Proper encoding for session IDs and task IDs
   - All user-provided IDs URL-encoded before API calls
   - Prevents injection attacks

### Error Message Safety

1. **Client Responses**: Generic error messages
   - ❌ NOT: `"Error: Invalid clinic_id: clinic123 (doesn't exist)"`
   - ✅ YES: `"The specified clinic could not be found"`

2. **Internal Logging**: Detailed errors for debugging
   - Full stack traces logged with logger.exception()
   - User context (user_id) included for audit trail
   - SQL errors caught with rollback on failure

3. **Sensitive Data**: PII never exposed
   - Wellness data not included in error messages
   - User IDs only in logs, not in API responses
   - Phone numbers handled safely in clinic records

### Data Storage Security

1. **RAG Persistent Storage**
   - Sentence transformer cache: Configurable location (not /tmp)
   - ChromaDB storage: Configurable location (not /tmp)
   - Environment variables: `SENTENCE_TRANSFORMERS_CACHE`, `CHROMA_PERSIST_DIR`
   - Default: `.mindsentry_cache/` in project root (persistent across reboots)

2. **Mass-Assignment Protection**
   - Wellness context updates use allowlist of safe fields
   - Can only update: wellness scores, assessment dates, treatment info
   - Cannot modify: risk_level, has_crisis_flag, user_id, id

3. **Database Transactions**
   - Appointment bookings wrapped in try/catch with rollback
   - Emergency dispatch logged but not stored in user data
   - Failed operations don't leave partial data

### Async/Concurrency Safety

1. **Agent Concurrency**
   - Eliminated shared mutable state (`self.current_user_id`)
   - User ID passed through method parameters
   - Tools defined per-request with user context
   - No cross-user request contamination

### Deployment Security Recommendations

```bash
# Do NOT use:
SENTENCE_TRANSFORMERS_CACHE=/tmp/transformers  # Lost on reboot
CHROMA_PERSIST_DIR=/tmp/chroma_db               # Lost on reboot

# Use instead:
SENTENCE_TRANSFORMERS_CACHE=/var/lib/mindsentry/transformers
CHROMA_PERSIST_DIR=/var/lib/mindsentry/chroma_db

# Or in development:
SENTENCE_TRANSFORMERS_CACHE=.mindsentry_cache/sentence_transformers
CHROMA_PERSIST_DIR=.mindsentry_cache/chroma_db
```



## Testing

### Test AarogyaAI Service

```python
# test_aarogyaai.py
import asyncio
from sqlmodel import Session
from app.services.chatbot_service import ChatbotService
from app.models.user_wellness_context import UserWellnessContext
from app.core.database import get_session

async def test_aarogyaai():
    db = next(get_session())
    service = ChatbotService(db)
    
    # Create test wellness context
    wellness = UserWellnessContext(
        user_id=1,
        overall_wellness_score=45,
        stress_level=70,
        mood_score=50,
    )
    db.add(wellness)
    db.commit()
    
    # Test chat
    result = await service.send_message(
        user_id=1,
        message_content="I'm feeling stressed"
    )
    
    print(f"Response: {result['response']}")
    print(f"Context Used: {result['context_used']}")

asyncio.run(test_aarogyaai())
```

### Test the Agent

```python
# test_agent.py
import asyncio
from app.services.agent_orchestrator import AgentOrchestrator
from app.core.database import get_session

async def test_agent():
    db = next(get_session())
    agent = AgentOrchestrator(db)
    
    result = await agent.execute_task(
        user_id=1,
        task_type="find_clinics",
        task_description="Find mental health clinics near me",
        input_params={
            "latitude": 40.7128,
            "longitude": -74.0060,
        }
    )
    
    print(f"Task: {result}")

asyncio.run(test_agent())
```

## Async/Await in Python

### Background

The AarogyaAI and agent services use `async/await` for non-blocking I/O. This is important for:
- Network calls (API requests to Groq, Geopy)
- Database operations
- Long-running tasks (agent reasoning)

### Key Points

1. **Always await async functions**
   ```python
   # ❌ Wrong
   agent.execute_task(...)  # Doesn't actually run!
   
   # ✅ Correct
   await agent.execute_task(...)
   ```

2. **Use asyncio.run() in scripts**
   ```python
   # ❌ Wrong
   result = test_agent()
   
   # ✅ Correct
   result = asyncio.run(test_agent())
   ```

3. **FastAPI handles async automatically**
   ```python
   # In route handlers, FastAPI manages the async context
   @app.post("/api/chat")
   async def chat_endpoint(request: ChatRequest):
       result = await chatbot_service.send_message(...)
       return result
   ```

4. **Method calls with ainvoke**
   ```python
   # For LLM operations, use ainvoke for async
   # ❌ Wrong: response = self.llm.invoke(prompt)
   # ✅ Correct: response = await self.llm.ainvoke(prompt)
   ```

5. **Session cleanup**
   ```python
   # After agent/chatbot tests, close sessions properly
   async def cleanup():
       if db.is_active:
           await db.close()
   ```

## Troubleshooting

### Issue: "GROQ_API_KEY not set"
**Solution**: Add `GROQ_API_KEY` to `.env` file

### Issue: "No clinics found"
**Solution**: Ensure health_clinics table is populated with sample data using the seed_clinics script

### Issue: "ChromaDB connection failed"
**Solution**: Check that the cache directory is writable:
```bash
# Default location
mkdir -p .mindsentry_cache/chroma_db
chmod 755 .mindsentry_cache

# Or set custom paths in .env
export CHROMA_PERSIST_DIR=/var/lib/mindsentry/chroma_db
export SENTENCE_TRANSFORMERS_CACHE=/var/lib/mindsentry/transformers
```

### Issue: "Geolocation failed"
**Solution**: Provide explicit latitude/longitude in input_params

### Issue: "Invalid appointment date" or "Appointment date must be in the future"
**Solution**: Use ISO 8601 format with future datetime:
- ✅ Correct: `"2024-04-15T14:30:00"` or `"2024-04-15T14:30:00+00:00"`
- ❌ Wrong: `"04/15/2024"` or `"April 15, 2024 2:30 PM"`
- Note: Dates in the past will be rejected

### Issue: "Coordinate out of range" or "Invalid coordinates"
**Solution**: Ensure latitude/longitude are within valid geographic ranges:
- Latitude: -90.0 to +90.0 (negative = South, positive = North)
- Longitude: -180.0 to +180.0 (negative = West, positive = East)

### Issue: TypeError in agent/chat test scripts
**Solution**: Make sure you're using `asyncio.run()` and `await`:
```python
# Run async functions:
result = asyncio.run(test_agent())  # ✅ Correct

# Don't do this:
result = test_agent()  # ❌ Wrong - returns coroutine object
```

### Issue: "Session cleanup failed" or lingering database connections
**Solution**: Ensure sessions are properly closed after tests:
```python
async def cleanup():
    db.close()
    print("Session cleaned up")
```

## Next Steps

1. **Deploy clinics database**: Populate with real clinic data
2. **Integrate maps**: Add Google Maps for visualization
3. **Emergency SMS**: Integrate with Twilio for ambulance calls
4. **Notifications**: Add email/SMS for appointment reminders
5. **Analytics**: Track chatbot effectiveness and agent success rates

## Support

For issues or questions:
1. Check logs: `docker logs mindsentry-backend`
2. Test endpoints with provided curl examples
3. Review database records for debugging
4. Check network connectivity for external APIs

---

**Last Updated**: March 2024
**Version**: 1.0.0
