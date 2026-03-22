/**
 * useChatAgent Hook - Manages chat state and agent interactions
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import ChatAgentService from '../services/chatAgentService';

export const useChatAgent = () => {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agentResult, setAgentResult] = useState(null);
  const messagesEndRef = useRef(null);

  const appendMessage = useCallback((nextMessage) => {
    setMessages(prev => {
      if (!nextMessage?.id) return [...prev, nextMessage];
      const exists = prev.some(item => item.id === nextMessage.id);
      return exists ? prev : [...prev, nextMessage];
    });
  }, []);

  const formatClinicsSummary = useCallback((result) => {
    const clinics = Array.isArray(result?.clinics) ? result.clinics : [];
    const top = clinics.slice(0, 5);
    if (!top.length) {
      return result?.message || 'No nearby clinics found.';
    }

    const lines = top.map((c, idx) => {
      const distance = typeof c.distance_km === 'number' ? `${c.distance_km} km` : 'distance unavailable';
      return `${idx + 1}. ${c.name || 'Clinic'} - ${distance}`;
    });

    const suffix = (result?.total_count && result.total_count > top.length)
      ? `\nShowing nearest ${top.length} of ${result.total_count} results.`
      : '';

    return `Nearest clinics:\n${lines.join('\n')}${suffix}`;
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Send a message to AarogyaAI
   */
  const sendMessage = useCallback(async (messageText) => {
    if (!messageText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Add user message to UI immediately
      appendMessage({
        id: `msg-${Date.now()}`,
        role: 'user',
        content: messageText,
        createdAt: new Date(),
      });

      // Send with agent capability
      const response = await ChatAgentService.sendChatWithAgent(messageText, sessionId);

      // Update session ID if new
      if (response.session_id && !sessionId) {
        setSessionId(response.session_id);
      }

      // Add assistant response
      appendMessage({
        id: response.message_id,
        role: 'assistant',
        content: response.chatbot_response,
        contextUsed: response.context_used,
        retrievedContext: response.retrieved_context || [],
        createdAt: new Date(),
      });

      // Store agent result if triggered
      if (response.agent_triggered) {
        setAgentResult(response.agent_result);

        // Add agent result as system message
        if (response.agent_result?.result?.success) {
          const resultPayload = response.agent_result.result;
          const agentSummary = resultPayload?.clinics
            ? formatClinicsSummary(resultPayload)
            : `Agent Action: ${resultPayload.message}`;

          appendMessage({
            id: `agent-${response.agent_result.task_id}`,
            role: 'system',
            content: agentSummary,
            agentData: resultPayload,
            createdAt: new Date(),
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to send message');
      console.error('Send message error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  /**
   * Find nearby clinics
   */
  const findNearbyClinics = useCallback(async (latitude, longitude, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ChatAgentService.findNearbyClinics(latitude, longitude, options);
      setAgentResult(response);

      if (response.result?.success) {
        appendMessage({
          id: `clinics-${response.task_id}`,
          role: 'system',
          content: formatClinicsSummary(response.result),
          agentData: response.result,
          createdAt: new Date(),
        });
      } else {
        setError(response.error || 'Failed to find clinics');
      }

      return response;
    } catch (err) {
      setError(err.message || 'Error finding clinics');
      console.error('Find clinics error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Book an appointment
   */
  const bookAppointment = useCallback(async (clinicId, appointmentDate, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ChatAgentService.bookAppointment(
        clinicId,
        appointmentDate,
        options
      );
      setAgentResult(response);

      if (response.result?.success) {
        const appointmentInfo = response.result.data;
        appendMessage({
          id: `appointment-${response.task_id}`,
          role: 'system',
          content: `Appointment booked at ${appointmentInfo.clinic_name} on ${appointmentInfo.appointment_date}`,
          agentData: appointmentInfo,
          createdAt: new Date(),
        });
      } else {
        setError(response.error || 'Failed to book appointment');
      }

      return response;
    } catch (err) {
      setError(err.message || 'Error booking appointment');
      console.error('Book appointment error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Call emergency ambulance
   */
  const callAmbulance = useCallback(async (latitude, longitude, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ChatAgentService.callAmbulance(latitude, longitude, options);
      setAgentResult(response);

      if (response.result?.success) {
        const emergencyInfo = response.result.data;
        appendMessage({
          id: `ambulance-${response.task_id}`,
          role: 'system',
          content: `🚑 Emergency services dispatched. ${emergencyInfo.message}`,
          agentData: emergencyInfo,
          createdAt: new Date(),
        });
      } else {
        setError(response.error || 'Failed to call ambulance');
      }

      return response;
    } catch (err) {
      setError(err.message || 'Error calling ambulance');
      console.error('Call ambulance error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load previous session messages
   */
  const loadSessionMessages = useCallback(async (sid) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ChatAgentService.getSessionMessages(sid);
      setSessionId(sid);
      setMessages(response.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.created_at),
      })));
    } catch (err) {
      setError(err.message || 'Failed to load messages');
      console.error('Load messages error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Close current session
   */
  const closeSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await ChatAgentService.closeSession(sessionId);
      setSessionId(null);
      setMessages([]);
    } catch (err) {
      setError(err.message || 'Failed to close session');
      console.error('Close session error:', err);
    }
  }, [sessionId]);

  /**
   * Clear messages and start new session
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setAgentResult(null);
  }, []);

  return {
    // State
    sessionId,
    messages,
    loading,
    error,
    agentResult,
    messagesEndRef,

    // Actions
    sendMessage,
    findNearbyClinics,
    bookAppointment,
    callAmbulance,
    loadSessionMessages,
    closeSession,
    clearMessages,
    setError,
  };
};

export default useChatAgent;
