/**
 * Chat Agent Service — API client for MindSentry ArogyaAI chatbot.
 *
 * Sends messages to /chat-v2 and receives structured responses
 * with ui_payload items (clinic cards, emergency buttons, etc.)
 */
import * as api from './api';
import { AuthService } from './authService';

const CHAT_TIMEOUT_MS = 120000;

class ChatAgentService {
  /**
   * Send a chat message to ArogyaAI.
   *
   * @param {string} message - The user's message
   * @param {Object|string|null} optionsOrSessionId - Options object or legacy session ID
   * @param {Object|null} locationArg - Legacy location argument
   * @param {string|null} sourceArg - Legacy source argument
   * @returns {Promise<Object>} - Chatbot response with ui_payload
   */
  static async sendChatMessage(message, optionsOrSessionId = {}, locationArg = null, sourceArg = null) {
    try {
      const isOptionsObject = optionsOrSessionId && typeof optionsOrSessionId === 'object' && !Array.isArray(optionsOrSessionId);
      const sessionId = isOptionsObject ? (optionsOrSessionId.sessionId ?? optionsOrSessionId.session_id ?? null) : (optionsOrSessionId || null);
      const location = isOptionsObject ? (optionsOrSessionId.location ?? null) : locationArg;
      const source = isOptionsObject ? (optionsOrSessionId.source ?? null) : sourceArg;

      const payload = { message, source: source || 'chat_screen' };
      if (sessionId) payload.session_id = sessionId;
      if (location) payload.location = location;

      console.log('[ChatAgent] Sending to /chat-v2:', { message: message.substring(0, 50), sessionId, hasLocation: !!location });
      const response = await api.post('/chat-v2', payload, { timeoutMs: CHAT_TIMEOUT_MS });
      return response;
    } catch (error) {
      console.error('[ChatAgent] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Submit an approval decision for a pending assistant action.
   *
   * Uses the legacy chat route because approval handling is implemented there.
   */
  static async submitApproval(sessionId, actionId, approved, messageText = null) {
    if (!sessionId) {
      throw new Error('Session ID is required to submit approval.');
    }
    if (!actionId) {
      throw new Error('Action ID is required to submit approval.');
    }

    const payload = {
      message: messageText || (approved ? 'Yes, please continue with that action.' : 'No, please do not continue with that action.'),
      session_id: sessionId,
      approval: {
        approved: !!approved,
        action_id: actionId,
      },
      source: 'chat_screen',
    };

    try {
      const response = await api.post('/api/v3/chat/message', payload, { timeoutMs: CHAT_TIMEOUT_MS });
      return response;
    } catch (error) {
      console.error('[ChatAgent] Error submitting approval:', error);
      throw error;
    }
  }

  /**
   * Get recent chat sessions for the current user.
   */
  static async getUserSessions(limit = 10) {
    try {
      const response = await api.get(`/chat-v2/sessions?limit=${limit}`);
      return response;
    } catch (error) {
      console.error('[ChatAgent] Error getting sessions:', error);
      throw error;
    }
  }

  /**
   * Get messages for a specific chat session.
   */
  static async getSessionMessages(sessionId, limit = 50) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      const response = await api.get(
        `/chat-v2/sessions/${encodeURIComponent(sessionId)}/messages?limit=${limit}`,
        { timeoutMs: CHAT_TIMEOUT_MS }
      );
      return response;
    } catch (error) {
      console.error('[ChatAgent] Error getting messages:', error);
      throw error;
    }
  }
}

export default ChatAgentService;
