/**
 * Chat Agent Service - API client for AarogyaAI chat and agent communications
 */
import * as api from './api';

const CHAT_TIMEOUT_MS = 120000;
const AGENT_TIMEOUT_MS = 180000;

// Utility function for URL encoding
const encodeURLComponent = (str) => {
  if (typeof str !== 'string') return '';
  return encodeURIComponent(str);
};

// Utility to build query string safely
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
  /**
   * Send a message to the AarogyaAI assistant
   * @param {string} message - User message
   * @param {string} sessionId - Optional existing session ID
   * @returns {Promise<Object>} AarogyaAI response with context
   */
  static async sendChatMessage(message, sessionId = null) {
    try {
      const response = await api.post('/api/v2/chat-agent/chat/message', {
        message,
        session_id: sessionId,
      }, { timeoutMs: CHAT_TIMEOUT_MS });
      return response;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  /**
   * Send message with automatic agent capability detection
   * @param {string} message - User message
   * @param {string} sessionId - Optional session ID
   * @returns {Promise<Object>} Chat response + agent result if triggered
   */
  static async sendChatWithAgent(message, sessionId = null) {
    try {
      const response = await api.post('/api/v2/chat-agent/chat-with-agent', {
        message,
        session_id: sessionId,
      }, { timeoutMs: AGENT_TIMEOUT_MS });
      return response;
    } catch (error) {
      console.error('Error sending chat with agent:', error);
      throw error;
    }
  }

  /**
   * Get all chat sessions for current user
   * @param {number} limit - Max number of sessions to retrieve
   * @returns {Promise<Array>} List of chat sessions
   */
  static async getUserSessions(limit = 10) {
    try {
      const queryString = buildQueryString({ limit });
      const response = await api.get(`/api/v2/chat-agent/chat/sessions${queryString}`);
      return response;
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      throw error;
    }
  }

  /**
   * Get all messages in a specific chat session
   * @param {string} sessionId - Session ID
   * @param {number} limit - Max messages to retrieve
   * @returns {Promise<Object>} Messages in session
   */
  static async getSessionMessages(sessionId, limit = 50) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      const encodedSessionId = encodeURLComponent(sessionId);
      const queryString = buildQueryString({ limit });
      const response = await api.get(
        `/api/v2/chat-agent/chat/sessions/${encodedSessionId}/messages${queryString}`,
        { timeoutMs: CHAT_TIMEOUT_MS }
      );
      return response;
    } catch (error) {
      console.error('Error getting session messages:', error);
      throw error;
    }
  }

  /**
   * Close a chat session
   * @param {string} sessionId - Session ID to close
   * @returns {Promise<Object>} Closure confirmation
   */
  static async closeSession(sessionId) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      const encodedSessionId = encodeURLComponent(sessionId);
      const response = await api.post(
        `/api/v2/chat-agent/chat/sessions/${encodedSessionId}/close`,
        {},
        { timeoutMs: CHAT_TIMEOUT_MS }
      );
      return response;
    } catch (error) {
      console.error('Error closing session:', error);
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // AGENT TASKS
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Execute an agent task
   * @param {Object} taskRequest - Task request object
   * @returns {Promise<Object>} Agent response
   */
  static async executeAgentTask(taskRequest) {
    try {
      const response = await api.post(
        '/api/v2/chat-agent/agent/task',
        taskRequest,
        { timeoutMs: AGENT_TIMEOUT_MS }
      );
      return response;
    } catch (error) {
      console.error('Error executing agent task:', error);
      throw error;
    }
  }

  /**
   * Find nearby clinics
   * @param {number} latitude - User latitude
   * @param {number} longitude - User longitude
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Agent task result with clinics
   */
  static async findNearbyClinics(latitude, longitude, options = {}) {
    return this.executeAgentTask({
      task_type: 'find_clinics',
      description: `Find health clinics near coordinates ${latitude}, ${longitude}`,
      input_params: {
        latitude,
        longitude,
        clinic_type: options.clinicType || null,
        has_emergency: options.hasEmergency || false,
        radius_km: options.radiusKm || 10.0,
      },
    });
  }

  /**
   * Book an appointment at a clinic
   * @param {string} clinicId - Clinic ID
   * @param {string} appointmentDate - Date in ISO format
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Booking confirmation
   */
  static async bookAppointment(clinicId, appointmentDate, options = {}) {
    return this.executeAgentTask({
      task_type: 'book_appointment',
      description: `Book appointment at clinic on ${appointmentDate}`,
      input_params: {
        clinic_id: clinicId,
        appointment_date: appointmentDate,
        appointment_type: options.type || 'consultation',
        reason: options.reason || null,
      },
    });
  }

  /**
   * Call emergency ambulance
   * @param {number} latitude - User latitude
   * @param {number} longitude - User longitude
   * @param {Object} options - Emergency options
   * @returns {Promise<Object>} Ambulance dispatch confirmation
   */
  static async callAmbulance(latitude, longitude, options = {}) {
    return this.executeAgentTask({
      task_type: 'call_ambulance',
      description: 'Emergency ambulance needed',
      input_params: {
        latitude,
        longitude,
        urgency: options.urgency || 'high',
        description: options.description || null,
      },
    });
  }

  /**
   * Get user's agent tasks
   * @param {string} status - Filter by status (pending, executing, completed, failed)
   * @param {number} limit - Max tasks to retrieve
   * @returns {Promise<Object>} List of agent tasks
   */
  static async getUserAgentTasks(status = null, limit = 20) {
    try {
      const queryParams = { limit };
      if (status) {
        queryParams.status = status;
      }
      const queryString = buildQueryString(queryParams);
      const response = await api.get(
        `/api/v2/chat-agent/agent/tasks${queryString}`,
        { timeoutMs: CHAT_TIMEOUT_MS }
      );
      return response;
    } catch (error) {
      console.error('Error getting agent tasks:', error);
      throw error;
    }
  }

  /**
   * Get details of a specific agent task
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task details with result
   */
  static async getAgentTaskDetails(taskId) {
    try {
      if (!taskId || typeof taskId !== 'string') {
        throw new Error('Invalid task ID');
      }
      const encodedTaskId = encodeURLComponent(taskId);
      const response = await api.get(
        `/api/v2/chat-agent/agent/tasks/${encodedTaskId}`,
        { timeoutMs: CHAT_TIMEOUT_MS }
      );
      return response;
    } catch (error) {
      console.error('Error getting task details:', error);
      throw error;
    }
  }
}

export default ChatAgentService;
