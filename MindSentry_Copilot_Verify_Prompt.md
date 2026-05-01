# MindSentry — Copilot Verification & Auto-Fix Prompt

Paste this entire prompt into GitHub Copilot Chat (Agent mode, `@workspace`) AFTER running the fix prompt. It will check every fix and apply any that were missed.

---

## SYSTEM CONTEXT

You are auditing and verifying the MindSentry codebase to confirm all known issues have been fixed. For each check below: verify the condition, report PASS or FAIL, and if FAIL — apply the fix immediately without asking for confirmation.

---

## VERIFICATION CHECKLIST

---

### CHECK 1 — `datetime.utcnow()` removed
**File:** `backend/app/core/security.py`

Search the entire `backend/` directory for `datetime.utcnow()`.

- PASS: Zero occurrences found.
- FAIL: Replace every occurrence with `datetime.now(timezone.utc)` and add `timezone` to the `from datetime import ...` line.

---

### CHECK 2 — JWT expiry is 1 day (not 30 days)
**File:** `backend/.env.example` and `backend/app/core/config.py`

- PASS: `ACCESS_TOKEN_EXPIRE_MINUTES` is `1440` in `.env.example`.
- FAIL: Change it to `1440` in `.env.example`. Also find the default value in `config.py` and change it to `1440`.

---

### CHECK 3 — Rate limiting on `/auth/login`
**File:** `backend/app/api/auth.py`

Search for `@limiter.limit` on the login endpoint. Also check `backend/app/main.py` for `app.state.limiter`.

- PASS: Both are present.
- FAIL: Apply the slowapi rate limiting setup from the fix prompt (FIX 3).

---

### CHECK 4 — `format_scores` reads `"date"` not `"created_at"`
**File:** `backend/app/services/agent_v2/nodes.py`

Find the `format_scores` function and check the key it reads for the date field.

- PASS: `s.get("date")` is used.
- FAIL: Change `s.get("created_at")` to `s.get("date")`.

---

### CHECK 5 — OpenAI fallback actually retries
**File:** `backend/app/services/agent_v2/llm.py`

Find `safe_llm_invoke`. After the first `safe_llm_call` fails (returns the "I'm having trouble" string), check whether the code calls `get_llm("openai")` and retries.

- PASS: A retry with OpenAI exists in the failure branch.
- FAIL: Apply the retry logic from FIX 5.

---

### CHECK 6 — `ThreadPoolExecutor` uses `shutdown(wait=False)`
**File:** `backend/app/services/agent_v2/llm.py`

Find `safe_llm_call`. Check that it does NOT use `with ThreadPoolExecutor(...) as executor:` (which calls `shutdown(wait=True)` on exit). It should explicitly call `executor.shutdown(wait=False)` in a `finally` block.

- PASS: `shutdown(wait=False)` is used.
- FAIL: Replace the executor usage as described in FIX 6.

---

### CHECK 7 — LLM timeout is at least 30 seconds
**File:** `backend/app/services/agent_v2/llm.py`

Find `future.result(timeout=...)`.

- PASS: Value is `30` or greater.
- FAIL: Change to `timeout=30`.

---

### CHECK 8 — No bare `state["user_id"]` access
**File:** `backend/app/services/agent_v2/nodes.py`

Search the file for `state["user_id"]` (with square brackets, not `.get`).

- PASS: Zero occurrences.
- FAIL: Replace every `state["user_id"]` with `state.get("user_id")` and add a None guard where the value is passed to a function.

---

### CHECK 9 — Graph is not caching DB session across requests
**File:** `backend/app/services/agent_v2/graph.py`

Check whether `_build_graph()` is called inside `__init__` with the graph stored as `self.graph`, or whether a new graph is built per `invoke` call.

- PASS: Graph is rebuilt per `invoke` call (not stored as `self.graph`).
- FAIL: Move `self.graph = self._build_graph()` out of `__init__` and into `invoke`.

---

### CHECK 10 — `latest_analysis` includes a `"summary"` key
**File:** `backend/app/services/agent_v2/context.py`

Find `_serialize_analysis`. Check that the returned dict contains a `"summary"` key.

- PASS: `"summary"` key exists and is a non-empty string when scores exist.
- FAIL: Add the computed summary as described in FIX 10.

---

### CHECK 11 — `/chat-v2` persists messages to DB
**File:** `backend/app/api/routes/chat_v2.py`

After `result = service.invoke(state)`, check for `db.add(...)` and `db.commit()` calls that save the user message and assistant response.

- PASS: Both messages are saved.
- FAIL: Apply FIX 11 to add message persistence.

---

### CHECK 12 — `"intent"` key declared in `ChatAgentState`
**File:** `backend/app/services/agent_v2/state.py`

Find the `ChatAgentState` TypedDict definition. Check for `intent: Dict[str, Any]`.

- PASS: Key is present.
- FAIL: Add `intent: Dict[str, Any]` to the TypedDict.

---

### CHECK 13 — Memory window is at least 20 messages
**File:** `backend/app/services/agent_v2/conversation_memory.py`

Find `_MAX_MESSAGES`.

- PASS: Value is `20` or greater.
- FAIL: Change to `_MAX_MESSAGES = 20`.

---

### CHECK 14 — `sanitize_response` uses `re.DOTALL`
**File:** `backend/app/services/agent_v2/health_safety.py`

Find the `re.search` and `re.sub` calls inside `sanitize_response`.

- PASS: Both use `re.DOTALL` flag.
- FAIL: Add `re.DOTALL` to both calls as shown in FIX 14.

---

### CHECK 15 — Crisis messages bypass LLM
**File:** `backend/app/services/agent_v2/health_safety.py`  
**File:** `backend/app/services/agent_v2/nodes.py`

1. Check that `health_safety.py` has an `is_crisis_message` function and `CRISIS_RESPONSE` constant.
2. Check that `handle_health_query` in `nodes.py` calls `is_crisis_message` at the top and returns `CRISIS_RESPONSE` immediately.

- PASS: Both present.
- FAIL: Apply FIX 15.

---

### CHECK 16 — `_strip_markdown` handles `#` headings and `- `/ `* ` bullets
**File:** `backend/app/services/agent_v2/response_normalizer.py`

Find `_strip_markdown`. Check for `re.sub` calls targeting `^#{1,6}` and `^[\-\*]\s+`.

- PASS: Both patterns present.
- FAIL: Replace `_strip_markdown` as shown in FIX 16.

---

### CHECK 17 — `_enforce_length` limit is 800 characters
**File:** `backend/app/services/agent_v2/response_normalizer.py`

Find `_enforce_length` call inside `normalize_response_text`.

- PASS: `max_chars=800` (or higher).
- FAIL: Change to `max_chars=800`.

---

### CHECK 18 — "That sounds difficult." not prepended to non-distress health responses
**File:** `backend/app/services/agent_v2/response_normalizer.py`

Find the block that prepends `"That sounds difficult."`. Check that it is conditioned on distress words in the query, not applied unconditionally.

- PASS: Distress word check exists before prepending.
- FAIL: Apply FIX 18.

---

### CHECK 19 — Overly broad health tokens removed
**File:** `backend/app/services/agent_v2/nodes.py`

Find `_HEALTH_TOKENS`. Confirm that `"feel"`, `"tired"`, `"exercise"`, `"stress"`, `"diet"` are NOT in the set.

- PASS: None of those words are present.
- FAIL: Remove them from the set.

---

### CHECK 20 — `created_at` is a `DateTime` column, not `String`
**File:** `backend/app/models/analysis_result.py` (and `recommendation.py`)

Find `created_at` column declarations. Check they use `Column(DateTime, ...)`, not `Column(String, ...)`.

- PASS: `DateTime` used.
- FAIL: Change to `DateTime` and add `from sqlalchemy import DateTime` + `from datetime import datetime`.

---

### CHECK 21 — `RiskScore` query has `ORDER BY`
**File:** `backend/app/services/agent_v2/context.py`

Find the `RiskScore` query in `get_user_score_data`. Check for `.order_by(...)`.

- PASS: `order_by` is present.
- FAIL: Add `.order_by(desc(RiskScore.id))` and ensure `desc` is imported.

---

### CHECK 22 — `_dedupe_sentences` preserves newlines
**File:** `backend/app/services/agent_v2/response_normalizer.py`

Find `_dedupe_sentences`. Check that it splits on `"\n"` and rejoins with `"\n"` (not `" ".join`).

- PASS: Newlines preserved.
- FAIL: Apply FIX 22.

---

### CHECK 23 — Conversation history passed as message objects
**File:** `backend/app/services/agent_v2/nodes.py`

Find where `AGENT_PROMPT.format_messages(...)` is called in handlers. Check whether `HumanMessage`/`AIMessage` history objects are prepended to the messages list.

- PASS: `_build_history_messages` (or equivalent) is called and prepended.
- FAIL: Apply FIX 23.

---

### CHECK 24 — System prompt allows memory and context usage
**File:** `backend/app/services/agent_v2/nodes.py`

Find `AGENT_PROMPT`. Check that the system message does NOT contain `"Answer ONLY based on user query"`.

- PASS: That phrase is absent.
- FAIL: Replace the system prompt as shown in FIX 24.

---

### CHECK 25 — No large commented-out blocks or dead functions in nodes.py
**File:** `backend/app/services/agent_v2/nodes.py`

1. Search for `# OLD RESPONSE IMPLEMENTATION` comment block.
2. Check for standalone `response_node` and `agent_llm_node` functions that only call `response_router`.
3. Check for `_safe_reasoning_context`, `_get_secondary_context_summary`, `_safe_json_loads` functions that are defined but never called.

- PASS: All absent.
- FAIL: Delete the commented block and all three dead functions.

---

### CHECK 26 — `memory_context` formatted as readable text in prompts
**File:** `backend/app/services/agent_v2/context_preparation.py`

Find `f"MEMORY_CONTEXT:\n{memory_context}"`. Check that `memory_context` is passed through a formatting function, not stringified raw.

- PASS: A formatting function (e.g. `_format_memory_context`) is called.
- FAIL: Apply FIX 26.

---

### CHECK 27 — `session_id` included in POST payload
**File:** `frontend/src/services/chatAgentService.js`

Find the `payload` object inside `sendChatMessage`. Check for `session_id: sessionId`.

- PASS: Present.
- FAIL: Add `session_id: sessionId` to the payload.

---

### CHECK 28 — `CounselorChatScreen` registered in navigator
**File:** `frontend/src/navigation/AppNavigator.js`

Search for `CounselorChat` or `CounselorChatScreen` in the Stack navigator.

- PASS: Screen is registered.
- FAIL: Import `CounselorChatScreen` and add `<Stack.Screen name="CounselorChat" component={CounselorChatScreen} />`.

---

### CHECK 29 — `navigationRef` removed from AuthContext
**File:** `frontend/src/context/AuthContext.js`

Search for `navigationRef`.

- PASS: Zero occurrences.
- FAIL: Delete the `const navigationRef = useRef()` line and any usage.

---

### CHECK 30 — `mockData.js` guarded by `__DEV__`
**File:** `frontend/src/data/mockData.js`

Check the first few lines for a `__DEV__` check.

- PASS: Check present.
- FAIL: Add `if (!__DEV__) { throw new Error('mockData must not be imported in production.'); }` at the top.

---

### CHECK 31 — `extra.apiUrl` not empty in app.json
**File:** `frontend/app.json`

Find `"apiUrl"` in the `extra` block.

- PASS: Value is a non-empty URL string.
- FAIL: Set it to `"https://api.mindsentry.com"` or the correct production URL.

---

### CHECK 32 — `react-native-worklets` removed
**File:** `frontend/package.json`

Search for `"react-native-worklets"`.

- PASS: Not present.
- FAIL: Remove the entry and run `npm install`.

---

## FINAL SUMMARY

After all checks complete, output a table:

| # | Description | Status |
|---|-------------|--------|
| 1 | datetime.utcnow removed | PASS/FAIL |
| 2 | JWT expiry 1 day | PASS/FAIL |
| 3 | Rate limiting on /auth/login | PASS/FAIL |
| 4 | format_scores reads "date" key | PASS/FAIL |
| 5 | OpenAI fallback retries | PASS/FAIL |
| 6 | ThreadPoolExecutor no wait=True | PASS/FAIL |
| 7 | LLM timeout ≥ 30s | PASS/FAIL |
| 8 | No bare state["user_id"] | PASS/FAIL |
| 9 | Graph not caching DB session | PASS/FAIL |
| 10 | latest_analysis has "summary" key | PASS/FAIL |
| 11 | /chat-v2 persists messages | PASS/FAIL |
| 12 | "intent" key in ChatAgentState | PASS/FAIL |
| 13 | Memory window ≥ 20 | PASS/FAIL |
| 14 | sanitize_response uses DOTALL | PASS/FAIL |
| 15 | Crisis messages bypass LLM | PASS/FAIL |
| 16 | _strip_markdown handles headings/bullets | PASS/FAIL |
| 17 | _enforce_length limit 800 | PASS/FAIL |
| 18 | "That sounds difficult." conditional | PASS/FAIL |
| 19 | Broad health tokens removed | PASS/FAIL |
| 20 | created_at is DateTime not String | PASS/FAIL |
| 21 | RiskScore query has ORDER BY | PASS/FAIL |
| 22 | _dedupe_sentences preserves newlines | PASS/FAIL |
| 23 | History as message objects | PASS/FAIL |
| 24 | System prompt allows memory | PASS/FAIL |
| 25 | Dead code removed from nodes.py | PASS/FAIL |
| 26 | memory_context formatted as text | PASS/FAIL |
| 27 | session_id in POST payload | PASS/FAIL |
| 28 | CounselorChatScreen registered | PASS/FAIL |
| 29 | navigationRef removed | PASS/FAIL |
| 30 | mockData guarded by __DEV__ | PASS/FAIL |
| 31 | apiUrl not empty in app.json | PASS/FAIL |
| 32 | react-native-worklets removed | PASS/FAIL |

Count total PASS and FAIL. If any FAIL remain after auto-fix attempts, list them with the reason the fix could not be applied automatically.
