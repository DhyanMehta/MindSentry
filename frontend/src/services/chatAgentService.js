/**
 * Assistant Service - API client for MindSentry LangGraph assistant.
 */
import * as api from './api';

const CHAT_TIMEOUT_MS = 120000;

const encodeURLComponent = (str) => {
  if (typeof str !== 'string') return '';
  return encodeURIComponent(str);
};

const buildQueryString = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.append(key, String(value));
    }
  });
  return query.toString() ? `?${query.toString()}` : '';
};

class ChatAgentService {
  static async sendChatMessage(message, sessionId = null, approval = null) {
    try {
      const response = await api.post('/api/v3/chat/message', {
        message,
        session_id: sessionId,
        approval,
      }, { timeoutMs: CHAT_TIMEOUT_MS });
      return response;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  static async getUserSessions(limit = 10) {
    try {
      const queryString = buildQueryString({ limit });
      const response = await api.get(`/api/v3/chat/sessions${queryString}`);
      return response;
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      throw error;
    }
  }

  static async getSessionMessages(sessionId, limit = 50) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      const encodedSessionId = encodeURLComponent(sessionId);
      const queryString = buildQueryString({ limit });
      const response = await api.get(
        `/api/v3/chat/sessions/${encodedSessionId}/messages${queryString}`,
        { timeoutMs: CHAT_TIMEOUT_MS }
      );
      return response;
    } catch (error) {
      console.error('Error getting session messages:', error);
      throw error;
    }
  }

  static async submitApproval(sessionId, actionId, approved, message = null) {
    try {
      const response = await api.post('/api/v3/chat/message', {
        message: message || (approved ? 'Yes, please continue.' : 'No, do not continue.'),
        session_id: sessionId,
        approval: {
          approved,
          action_id: actionId,
        },
      }, { timeoutMs: CHAT_TIMEOUT_MS });
      return response;
    } catch (error) {
      console.error('Error submitting approval:', error);
      throw error;
    }
  }
}

export default ChatAgentService;
