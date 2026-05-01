# MindSentry — Copilot Fix Prompt

Paste this entire prompt into GitHub Copilot Chat (Agent mode, `@workspace`). It will walk through every issue and apply all fixes in one session.

---

## SYSTEM CONTEXT

You are fixing the MindSentry codebase. Apply every change below exactly as described. Do not skip any item. After all edits are done, confirm each fix with a one-line summary.

---

## BACKEND FIXES

### FIX 1 — Replace `datetime.utcnow()` with timezone-aware datetime (security.py)

**File:** `backend/app/core/security.py`

Replace all occurrences of `datetime.utcnow()` with `datetime.now(timezone.utc)`.

1. Add `timezone` to the import line at the top:
   ```python
   from datetime import datetime, timedelta, timezone
   ```
2. Replace every `datetime.utcnow()` call with `datetime.now(timezone.utc)`.

---

### FIX 2 — Reduce JWT expiry from 30 days to 1 day (.env.example)

**File:** `backend/.env.example`

Change:
```
ACCESS_TOKEN_EXPIRE_MINUTES=43200
```
To:
```
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

Also update `backend/app/core/config.py` — find the field `access_token_expire_minutes` and change its default value to `1440` if it is currently `43200`.

---

### FIX 3 — Add rate limiting on /auth/login (auth.py)

**File:** `backend/app/api/auth.py`

1. Add `slowapi` rate limiting. At the top of the file add:
   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address
   limiter = Limiter(key_func=get_remote_address)
   ```
2. Decorate the login endpoint with `@limiter.limit("10/minute")` and add `request: Request` as the first parameter. Example:
   ```python
   @router.post("/login", response_model=TokenResponse)
   @limiter.limit("10/minute")
   def login(request: Request, user_data: UserLogin, session: DBSession = Depends(get_session)):
       ...
   ```
3. In `backend/app/main.py`, register the limiter:
   ```python
   from slowapi import _rate_limit_exceeded_handler
   from slowapi.errors import RateLimitExceeded
   from app.api.auth import limiter
   app.state.limiter = limiter
   app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
   ```
4. Add `slowapi` to `backend/requirements.txt` (or create the file if absent).

---

### FIX 4 — Fix `format_scores` reading wrong key (nodes.py)

**File:** `backend/app/services/agent_v2/nodes.py`

In the `format_scores` function, `_serialize_analysis` in `context.py` returns the key `"date"`, but `format_scores` reads `"created_at"`. Fix `format_scores` to read `"date"`:

Change:
```python
"date": s.get("created_at"),
```
To:
```python
"date": s.get("date"),
```

---

### FIX 5 — Fix OpenAI fallback never being called (llm.py)

**File:** `backend/app/services/agent_v2/llm.py`

In `safe_llm_invoke`, when the call to `safe_llm_call` returns an error string, the code sets the preferred provider to "openai" but never actually retries with OpenAI. Fix it by adding a retry with the fallback provider:

Replace the block:
```python
result = safe_llm_call(llm, messages)
if isinstance(result, str) and result.startswith("I'm having trouble"):
    if selected_provider == "groq":
        _set_preferred_provider("openai")
    return result, selected_provider
```

With:
```python
result = safe_llm_call(llm, messages)
if isinstance(result, str) and result.startswith("I'm having trouble"):
    if selected_provider == "groq":
        _set_preferred_provider("openai")
        try:
            fallback_llm = get_llm("openai")
            result = safe_llm_call(fallback_llm, messages)
        except Exception as exc:
            logger.warning("OpenAI fallback also failed: %s", exc)
        return result, "openai"
    return result, selected_provider
```

---

### FIX 6 — Fix ThreadPoolExecutor shutdown blocking the timeout (llm.py)

**File:** `backend/app/services/agent_v2/llm.py`

The `with ThreadPoolExecutor(...) as executor:` block calls `__exit__` which does `shutdown(wait=True)`, blocking until the thread finishes and defeating the timeout. Fix by not using the context manager:

Replace `safe_llm_call` with:
```python
def safe_llm_call(llm, prompt):
    executor = ThreadPoolExecutor(max_workers=1)
    try:
        future = executor.submit(llm.invoke, prompt)
        return future.result(timeout=30)
    except FuturesTimeoutError:
        print("[LLM ERROR] timeout after 30s")
        return "I'm having trouble responding right now. Please try again."
    except Exception as e:
        print(f"[LLM ERROR] {e}")
        return "I'm having trouble responding right now. Please try again."
    finally:
        executor.shutdown(wait=False)
```

---

### FIX 7 — Increase LLM timeout from 5s to 30s (llm.py)

Already done in FIX 6 above (changed `timeout=5` to `timeout=30`). No additional change needed here.

---

### FIX 8 — Guard `state["user_id"]` against KeyError (nodes.py)

**File:** `backend/app/services/agent_v2/nodes.py`

In `context_builder_node`, the line:
```python
context = get_user_score_data(db, state["user_id"])
```
will raise `KeyError` if `user_id` is missing. Change to:
```python
user_id = state.get("user_id")
if user_id is None:
    context = None
    context_fetched = False
else:
    context = get_user_score_data(db, user_id)
    if context and context.get("has_scores"):
        context_fetched = True
    else:
        context = None
```

Also in `intent_reasoning_node`, guard:
```python
memory_key = get_memory_key(state.get("user_id"), session_id)
```
This is already using `.get()`, so confirm it is safe. If any other direct `state["user_id"]` access exists anywhere in `nodes.py`, change it to `state.get("user_id")`.

---

### FIX 9 — Stop capturing DB session in closure; inject per-request (graph.py)

**File:** `backend/app/services/agent_v2/graph.py`

The current design captures `self.db` in the lambda closure and caches the compiled graph. This breaks if the graph is ever cached across requests. Fix by rebuilding the graph per request, or by passing `db` through state.

**Simplest fix:** Remove graph caching — build a fresh graph on every `invoke` call:

Change `__init__` to not build the graph eagerly:
```python
def __init__(self, db: Session) -> None:
    self.db = db

def invoke(self, state: ChatAgentState) -> ChatAgentState:
    print("[GRAPH] invoke called once for request")
    graph = self._build_graph()
    return graph.invoke(state)
```

This ensures `self.db` is always the current session. (Graph compilation is fast for this simple linear graph.)

---

### FIX 10 — Fix "summary" key missing from latest_analysis (context_preparation.py)

**File:** `backend/app/services/agent_v2/context_preparation.py`  
**File:** `backend/app/services/agent_v2/context.py`

`_serialize_analysis` in `context.py` does NOT include a `"summary"` key, so `latest_analysis.get("summary")` is always `None`. Fix by adding a computed summary to `_serialize_analysis`:

In `context.py`, inside `_serialize_analysis`, add before the return statement:
```python
wellness = _compute_wellness_score(row)
stress = _score_to_percent(row.stress_score)
mood = _score_to_percent(row.mood_score)
summary_parts = []
if wellness is not None:
    summary_parts.append(f"wellness {wellness}/100")
if stress is not None:
    summary_parts.append(f"stress {stress}/100")
if mood is not None:
    summary_parts.append(f"mood {mood}/100")
summary = ", ".join(summary_parts) if summary_parts else "no data available"
```

Then add `"summary": summary` to the returned dict.

---

### FIX 11 — Persist messages to DB in /chat-v2 (chat_v2.py)

**File:** `backend/app/api/routes/chat_v2.py`

After `result = service.invoke(state)`, save the user message and assistant response to the database. Add an import for a message model (create a simple one if it does not exist, or use whatever chat message model exists in the project):

Check `backend/app/models/` for an existing chat/message model. If one exists, import it and after `result = service.invoke(state)` add:

```python
from app.models.assistant_models import AssistantMessage  # adjust import path as needed
from datetime import datetime, timezone

user_msg = AssistantMessage(
    user_id=current_user.id,
    session_id=req.session_id,
    role="user",
    content=req.message,
    created_at=datetime.now(timezone.utc),
)
assistant_msg = AssistantMessage(
    user_id=current_user.id,
    session_id=req.session_id,
    role="assistant",
    content=response_text,
    created_at=datetime.now(timezone.utc),
)
db.add(user_msg)
db.add(assistant_msg)
db.commit()
```

If no message model exists, create `backend/app/models/chat_message.py`:
```python
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime
from app.core.database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    session_id = Column(String(128), nullable=True, index=True)
    role = Column(String(16), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
```
Then import and use `ChatMessage` in `chat_v2.py` as shown above.

---

### FIX 12 — Add `intent` key to `ChatAgentState` TypedDict (state.py)

**File:** `backend/app/services/agent_v2/state.py`

The nodes write `"intent"` into state but it is not declared in `ChatAgentState`. Add it:

```python
class ChatAgentState(TypedDict, total=False):
    input: str
    user_id: int
    session_id: Optional[str]
    memory_key: str
    memory_history: list[Dict[str, Any]]
    memory_signals: Dict[str, Any]
    memory_context: Dict[str, Any]
    source: Optional[str]
    intent: Dict[str, Any]          # ← ADD THIS LINE
    intent_data: Dict[str, Any]
    context: Optional[Dict[str, Any]]
    output: Any
    llm_provider: str
```

---

### FIX 13 — Fix in-process memory dying on restart / multi-worker (conversation_memory.py)

**File:** `backend/app/services/agent_v2/conversation_memory.py`

The current `_MEMORY_STORE` is a plain Python dict — it is lost on every restart and is not shared across workers. Replace it with Redis if available, or at minimum document the limitation and increase the window size.

**Minimum fix (increase window + document):**

Change `_MAX_MESSAGES = 10` to `_MAX_MESSAGES = 20` so at least 10 full exchanges (20 turns) are kept before eviction.

Add a module-level comment:
```python
# NOTE: _MEMORY_STORE is in-process only. It does not survive restarts and does not
# work correctly with multiple uvicorn workers. For production, replace with Redis:
#   redis_client.setex(key, ttl=3600, value=json.dumps(history))
```

**If Redis is already a dependency**, replace `_MEMORY_STORE` with a Redis-backed implementation using `redis.Redis` and JSON serialisation.

---

### FIX 14 — Fix `sanitize_response` regex not matching multiline text (health_safety.py)

**File:** `backend/app/services/agent_v2/health_safety.py`

Add `re.DOTALL` flag to the pattern so it matches across newlines:

```python
pattern = rf"\b(you have|you're|you are) .*? {claim}\b"
if re.search(pattern, text.lower(), re.DOTALL):
    text = re.sub(
        pattern,
        "these symptoms might be worth discussing with a healthcare provider",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
```

---

### FIX 15 — Add hardcoded bypass for crisis keywords (health_safety.py)

**File:** `backend/app/services/agent_v2/health_safety.py`

Crisis messages (suicidal, self-harm) must NEVER be routed through the LLM. Add a crisis bypass function and call it before the LLM is invoked.

Add this function:
```python
CRISIS_KEYWORDS = {"suicidal", "suicide", "self-harm", "self harm", "kill myself", "end my life", "overdose"}
CRISIS_RESPONSE = (
    "I can hear that you're going through something really painful right now. "
    "Please reach out to a crisis helpline immediately — you don't have to face this alone.\n\n"
    "• iCall (India): 9152987821\n"
    "• Vandrevala Foundation: 1860-2662-345 (24/7)\n"
    "• International: https://www.findahelpline.com\n\n"
    "Your safety is the most important thing."
)

def is_crisis_message(query: str) -> bool:
    lower = query.lower()
    return any(kw in lower for kw in CRISIS_KEYWORDS)
```

**File:** `backend/app/services/agent_v2/nodes.py`

In `handle_health_query`, add at the very top of the function body, before any LLM call:
```python
from app.services.agent_v2.health_safety import is_crisis_message, CRISIS_RESPONSE
if is_crisis_message(query):
    return {"response": CRISIS_RESPONSE}
```

---

### FIX 16 — Fix `_strip_markdown` missing headings and bullet lines (response_normalizer.py)

**File:** `backend/app/services/agent_v2/response_normalizer.py`

Replace the `_strip_markdown` function with one that also handles `#` headings and `- ` / `* ` list prefixes:

```python
def _strip_markdown(text: str) -> str:
    cleaned = text or ""
    # Remove inline tokens
    for token in ["**", "__", "```", "`"]:
        cleaned = cleaned.replace(token, "")
    # Remove heading markers (e.g. ## Title → Title)
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    # Remove unordered list markers at start of line
    cleaned = re.sub(r"^[\-\*]\s+", "", cleaned, flags=re.MULTILINE)
    # Remove markdown links [text](url) → text
    cleaned = re.sub(r"\[(.*?)\]\((.*?)\)", r"\1", cleaned)
    return cleaned
```

---

### FIX 17 — Increase `_enforce_length` limit and guard against mid-sentence cuts on crisis content (response_normalizer.py)

**File:** `backend/app/services/agent_v2/response_normalizer.py`

Change `max_chars=420` to `max_chars=800` in the `_enforce_length` call inside `normalize_response_text`:

```python
cleaned = _enforce_length(cleaned, max_chars=800)
```

Also update the default parameter in `_enforce_length`:
```python
def _enforce_length(text: str, max_chars: int = 800) -> str:
```

---

### FIX 18 — Remove unconditional "That sounds difficult." prefix (response_normalizer.py)

**File:** `backend/app/services/agent_v2/response_normalizer.py`

The current code prepends `"That sounds difficult. "` to ALL health responses, even factual / informational ones. Change the condition so it only prepends when the user's query contains an emotional distress signal:

Replace:
```python
elif "i hear" not in lower and "that sounds" not in lower and "i understand" not in lower:
    if cleaned.startswith("-"):
        cleaned = "That sounds difficult. Here are a few small steps:\n" + cleaned
    else:
        cleaned = "That sounds difficult. " + cleaned
```

With:
```python
elif "i hear" not in lower and "that sounds" not in lower and "i understand" not in lower:
    distress_words = {"anxious", "scared", "worried", "panic", "sad", "depressed", "overwhelmed", "stressed"}
    query_lower = (state.get("input") or "").lower() if isinstance(state, dict) else ""
    if any(w in query_lower for w in distress_words):
        if cleaned.startswith("-"):
            cleaned = "That sounds difficult. Here are a few small steps:\n" + cleaned
        else:
            cleaned = "That sounds difficult. " + cleaned
```

Because `normalize_response_text` does not receive `state`, pass `query` (already a parameter) through instead:

Change the condition to check `query` (the parameter already available):
```python
distress_words = {"anxious", "scared", "worried", "panic", "sad", "depressed", "overwhelmed", "stressed"}
if any(w in (query or "").lower() for w in distress_words):
    ...prepend...
```

---

### FIX 19 — Fix false HEALTH_QUERY from generic words (nodes.py)

**File:** `backend/app/services/agent_v2/nodes.py`

Remove overly broad tokens from `_HEALTH_TOKENS` that cause false positives:

Remove: `"feel"`, `"tired"`, `"exercise"`, `"stress"`, `"diet"`

Updated set:
```python
_HEALTH_TOKENS = {
    "health",
    "feeling",
    "sick",
    "pain",
    "fever",
    "headache",
    "anxiety",
    "panic",
    "sleep",
    "workout",
    "unwell",
    "nausea",
}
```

---

### FIX 20 — Fix `created_at` stored as String but ordered with ORDER BY (models)

**File:** `backend/app/models/analysis_result.py` (and any other model that stores `created_at` as a `String` column)

If `created_at` is declared as `Column(String, ...)`, change it to `Column(DateTime, ...)` with `default=datetime.utcnow`. Add the import:
```python
from sqlalchemy import DateTime
from datetime import datetime
```

Change the column:
```python
created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

Do the same for any other model (`recommendation.py`, `risk_score.py`, etc.) that has `created_at` as a String.

---

### FIX 21 — Add ORDER BY to RiskScore query (context.py)

**File:** `backend/app/services/agent_v2/context.py`

The `RiskScore` query has no `ORDER BY`, so an arbitrary row is returned. Fix:

Change:
```python
latest_risk = db.exec(
    select(RiskScore).where(RiskScore.assessment_id == latest_analysis.assessment_id)
).first()
```

To:
```python
from sqlalchemy import desc
latest_risk = db.exec(
    select(RiskScore)
    .where(RiskScore.assessment_id == latest_analysis.assessment_id)
    .order_by(desc(RiskScore.id))
).first()
```

---

### FIX 22 — Fix `_dedupe_sentences` collapsing bullet lists (response_normalizer.py)

**File:** `backend/app/services/agent_v2/response_normalizer.py`

`_dedupe_sentences` joins all sentences with `" ".join(...)`, which destroys newlines in bullet lists. Fix by preserving newlines:

```python
def _dedupe_sentences(text: str) -> str:
    seen = set()
    output = []
    # Split on newlines first to preserve structure, then dedupe within lines
    for line in text.split("\n"):
        sentences = _SENTENCE_SPLIT.split(line)
        deduped_line = []
        for sentence in sentences:
            normalized = sentence.strip().lower()
            if not normalized:
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            deduped_line.append(sentence.strip())
        if deduped_line:
            output.append(" ".join(deduped_line))
    return "\n".join(output).strip()
```

---

### FIX 23 — Fix conversation history passed as flat text instead of message objects (nodes.py)

**File:** `backend/app/services/agent_v2/nodes.py`

In `handle_score_query`, `handle_health_query`, and `handle_general_query`, the memory context is passed as a raw dict stringified into the context string. Fix `build_memory_context` usage so that recent_turns are formatted into proper `HumanMessage` / `AIMessage` objects when building the messages list.

In each handler that calls `AGENT_PROMPT.format_messages(query=..., context=...)`, prepend history messages from `state["memory_history"]`:

```python
from langchain_core.messages import HumanMessage, AIMessage

def _build_history_messages(state: ChatAgentState):
    history = state.get("memory_history") or []
    messages = []
    for turn in history[-6:]:  # last 3 exchanges
        role = turn.get("role")
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        if role == "user":
            messages.append(HumanMessage(content=text))
        elif role == "assistant":
            messages.append(AIMessage(content=text))
    return messages
```

Then in each handler, replace:
```python
messages = AGENT_PROMPT.format_messages(query=query, context=llm_context)
```
With:
```python
history_messages = _build_history_messages(state)
prompt_messages = AGENT_PROMPT.format_messages(query=query, context=llm_context)
messages = history_messages + prompt_messages
```

---

### FIX 24 — Fix system prompt fighting memory (nodes.py)

**File:** `backend/app/services/agent_v2/nodes.py`

The system prompt contains `"Answer ONLY based on user query"` which actively prevents the LLM from using conversation memory. Change it to allow context and memory usage:

Replace the system message content:
```python
"""You are a supportive mental wellness assistant for the MindSentry app.

Guidelines:
- Use the provided conversation history and context to give coherent, continuous responses.
- Reference what the user has shared earlier in the conversation when relevant.
- Use wellness score data ONLY if it is included in the context or the user asks for it.
- For health concerns, be empathetic, practical, and always suggest professional help when appropriate.
- Never diagnose. Never make definitive medical claims.
- Be concise and warm.
"""
```

---

### FIX 25 — Remove dead `response_node` and `agent_llm_node` duplicates and commented code (nodes.py)

**File:** `backend/app/services/agent_v2/nodes.py`

1. Delete the entire large commented-out block (`# OLD RESPONSE IMPLEMENTATION (DO NOT DELETE)` ... all commented lines).
2. Delete the duplicate `response_node` function that just calls `response_router`.
3. Delete the `agent_llm_node` function that also just calls `response_router`.
4. Delete the three functions that are defined but never called: `_safe_reasoning_context`, `_get_secondary_context_summary`, `_safe_json_loads`.

---

### FIX 26 — Fix memory_context dict raw-stringified into LLM prompt (context_preparation.py)

**File:** `backend/app/services/agent_v2/context_preparation.py`

`memory_context` is a Python dict passed directly into the context string as `f"MEMORY_CONTEXT:\n{memory_context}"`, which produces ugly output like `{'memory_signals': {...}, 'recent_turns': [...]}`. Format it as readable text:

Add a helper function before `prepare_score_analysis_context`:
```python
def _format_memory_context(memory_context: dict) -> str:
    if not memory_context:
        return ""
    parts = []
    signals = memory_context.get("memory_signals", {})
    if signals.get("is_follow_up"):
        parts.append("This is a follow-up to an earlier question.")
    tone = signals.get("emotional_tone", "neutral")
    if tone != "neutral":
        parts.append(f"User's recent emotional tone: {tone}.")
    turns = memory_context.get("recent_turns", [])
    if turns:
        parts.append("Recent conversation:")
        for turn in turns[-4:]:
            role = turn.get("role", "unknown").capitalize()
            text = turn.get("text", "")
            parts.append(f"  {role}: {text}")
    guidance = memory_context.get("response_guidance", [])
    if guidance:
        parts.append("Guidance: " + " ".join(guidance))
    return "\n".join(parts)
```

Then replace every `f"MEMORY_CONTEXT:\n{memory_context}"` with:
```python
f"MEMORY_CONTEXT:\n{_format_memory_context(memory_context)}"
```

---

## FRONTEND FIXES

### FIX 27 — Include `session_id` in POST body (chatAgentService.js)

**File:** `frontend/src/services/chatAgentService.js`

In `sendChatMessage`, `session_id` is accepted as a parameter but never included in the payload. Fix:

```javascript
const payload = {
    message,
    user_id: user?.id ?? null,
    source: source || 'support_tab',
    session_id: sessionId,   // ← ADD THIS
};
```

---

### FIX 28 — Register `CounselorChatScreen` in navigator (AppNavigator.js)

**File:** `frontend/src/navigation/AppNavigator.js`

Add the import and register the screen inside the Stack navigator:

1. Add import at the top:
   ```javascript
   import CounselorChatScreen from '../screens/CounselorChatScreen';
   ```
2. Inside the Stack navigator (wherever `ChatBotScreen` and other modal screens are registered), add:
   ```javascript
   <Stack.Screen name="CounselorChat" component={CounselorChatScreen} />
   ```

---

### FIX 29 — Remove unused `navigationRef` from AuthContext.js

**File:** `frontend/src/context/AuthContext.js`

Find the line:
```javascript
const navigationRef = useRef();
```
Delete it. Also delete any usage of `navigationRef` in the same file.

---

### FIX 30 — Guard `mockData.js` behind a dev-only flag (mockData.js)

**File:** `frontend/src/data/mockData.js`

Wrap all exports with a dev check so they are unreachable in production:

```javascript
if (!__DEV__) {
    throw new Error('mockData must not be imported in production builds.');
}
// ... existing exports below
```

Also search the entire `src/` directory for any `import ... from '../data/mockData'` or similar. For each one found, wrap the import or the code path using it with `if (__DEV__) { ... }`.

---

### FIX 31 — Fix `extra.apiUrl` empty in app.json

**File:** `frontend/app.json`

Change:
```json
"extra": {
    "apiUrl": ""
}
```
To:
```json
"extra": {
    "apiUrl": "https://api.mindsentry.com"
}
```

Or if a staging URL is appropriate, use that. The empty string causes the production fallback in `apiConfig.js` to resolve to a non-existent domain when `EXPO_PUBLIC_API_URL` is not set.

---

### FIX 32 — Remove `react-native-worklets` conflicting package (package.json)

**File:** `frontend/package.json`

Remove `"react-native-worklets": "0.5.1"` from dependencies — it conflicts with `react-native-reanimated@~4.1.1` which bundles its own worklets runtime. Run `npm install` after removing it.

---

### FIX 33 — Fix duplicate API config files

**File:** `frontend/src/config/api.config.js`

The file already re-exports from `apiConfig.js`. This is fine as a compatibility shim. Add a comment to make the intent clear and ensure no code imports directly from `api.config.js` for new code:

```javascript
/**
 * @deprecated Import directly from './apiConfig' in new code.
 * This file exists for backward compatibility only.
 */
export { API_CONFIG, API_BASE_URL, buildApiUrl, getApiBaseUrl } from './apiConfig';
```

Then search the codebase for all `import ... from '.*api\.config'` and update them to import from `./apiConfig` directly.

---

## FINAL STEPS

After all edits above are complete:

1. Run `cd backend && pip install -r requirements.txt` to ensure `slowapi` and all deps are installed.
2. Run `cd frontend && npm install` after removing `react-native-worklets`.
3. Confirm no Python files still contain `datetime.utcnow()`.
4. Confirm no file still accesses `state["user_id"]` without `.get()`.
5. Confirm `chat_v2.py` now writes messages to the database.
6. Confirm `nodes.py` has no commented-out blocks remaining.
