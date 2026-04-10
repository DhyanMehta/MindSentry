/**
 * useChatAgent Hook - manages MindSentry assistant chat state.
 */
import { useState, useCallback } from 'react';
import ChatAgentService from '../services/chatAgentService';

export const useChatAgent = () => {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [reminderPrompt, setReminderPrompt] = useState(null);
  const appendMessage = useCallback((nextMessage) => {
    setMessages(prev => {
      if (!nextMessage?.id) return [...prev, nextMessage];
      const exists = prev.some(item => item.id === nextMessage.id);
      return exists ? prev : [...prev, nextMessage];
    });
  }, []);

  const formatClinicsSummary = useCallback((clinics = []) => {
    const top = clinics.slice(0, 5);
    if (!top.length) {
      return 'No nearby clinics found.';
    }

    const lines = top.map((c, idx) => {
      const distance = typeof c.distance_km === 'number' ? `${c.distance_km} km` : 'distance unavailable';
      return `${idx + 1}. ${c.name || 'Clinic'} - ${distance}`;
    });

    return `Nearest clinics:\n${lines.join('\n')}`;
  }, []);

  const applyAssistantResponse = useCallback((response) => {
    if (response.session_id && !sessionId) {
      setSessionId(response.session_id);
    }

    appendMessage({
      id: response.message_id || `assistant-${Date.now()}`,
      role: 'assistant',
      content: response.response,
      contextUsed: Array.isArray(response.used_data) && response.used_data.length > 0,
      uiPayload: response.ui_payload || [],
      answerIntent: response.answer_intent || null,
      answerTopic: response.answer_topic || null,
      createdAt: new Date(),
    });

    const uiItems = Array.isArray(response.ui_payload) ? response.ui_payload : [];
    const approvalItem = uiItems.find((x) => x?.type === 'approval_prompt' && x?.action_id);
    setPendingApproval(approvalItem || null);
    const reminderItem = uiItems.find((x) => x?.type === 'reminder_prompt');
    setReminderPrompt(reminderItem || null);

    const clinicItem = uiItems.find((x) => x?.type === 'clinic_cards');
    if (clinicItem?.clinics?.length) {
      appendMessage({
        id: `clinics-${Date.now()}`,
        role: 'system',
        content: formatClinicsSummary(clinicItem.clinics),
        agentData: clinicItem.clinics,
        createdAt: new Date(),
      });
    }

    if (Array.isArray(response.warnings) && response.warnings.length) {
      appendMessage({
        id: `warning-${Date.now()}`,
        role: 'system',
        content: response.warnings.join('\n'),
        createdAt: new Date(),
      });
    }

    return response;
  }, [appendMessage, formatClinicsSummary, sessionId]);

  const sendStructuredMessage = useCallback(async (messageText, displayText = messageText, source = 'support_tab') => {
    if (!messageText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      appendMessage({
        id: `msg-${Date.now()}`,
        role: 'user',
        content: displayText,
        createdAt: new Date(),
      });

      const response = await ChatAgentService.sendChatMessage(
        messageText,
        sessionId,
        null,
        source || 'support_tab',
      );
      return applyAssistantResponse(response);
    } catch (err) {
      setError(err.message || 'Failed to send message');
      console.error('Send message error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [appendMessage, applyAssistantResponse, sessionId]);

  const sendMessage = useCallback(async (messageText, source = 'support_tab') => {
    const normalizedSource = typeof source === 'string' ? source : (source?.source || 'support_tab');
    return sendStructuredMessage(messageText, messageText, normalizedSource);
  }, [sendStructuredMessage]);

  const findNearbyClinics = useCallback(async (latitude, longitude, options = {}) => {
    const specialty = options?.clinicType || 'none';
    const radius = options?.radiusKm || 10;
    return sendStructuredMessage(
      `[clinic_search] latitude=${latitude} longitude=${longitude} specialty=${String(specialty).replace(/\s+/g, '_')} radius_km=${radius}`,
      `Find nearby ${specialty === 'none' ? 'clinics' : specialty.replace(/_/g, ' ')} near my current location.`
    );
  }, [sendStructuredMessage]);

  const submitApproval = useCallback(async (approved) => {
    if (!pendingApproval || !sessionId) return null;
    setLoading(true);
    setError(null);
    try {
      const response = await ChatAgentService.submitApproval(
        sessionId,
        pendingApproval.action_id,
        approved,
        approved ? 'Yes, please continue with that action.' : 'No, please do not continue with that action.'
      );
      return applyAssistantResponse(response);
    } catch (err) {
      setError(err.message || 'Failed to submit approval');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pendingApproval, sessionId, applyAssistantResponse]);

  const requestAppointment = useCallback(async (clinic, appointmentDate, appointmentReason) => {
    const clinicId = clinic?.clinic_id || clinic?.id;
    if (!clinicId) {
      setError('Please select a clinic first.');
      return null;
    }

    const safeNotes = String(appointmentReason || '').replace(/\s+/g, ' ').trim();
    const message = `[appointment_request] clinic_id=${clinicId} preferred_datetime=${appointmentDate}${safeNotes ? ` notes=${safeNotes}` : ''}`;
    const displayMessage = `Request an appointment at ${clinic.name || 'the selected clinic'} for ${appointmentDate}.`;
    return sendStructuredMessage(message, displayMessage);
  }, [sendStructuredMessage]);

  const requestReminder = useCallback(async (title, remindAt, context = '') => {
    if (!title || !remindAt) {
      setError('Reminder title and time are required.');
      return null;
    }
    const safeTitle = String(title).replace(/\s+/g, ' ').trim();
    const safeContext = String(context || '').replace(/\s+/g, ' ').trim();
    const message = `[reminder_request] title=${safeTitle} remind_at=${remindAt}${safeContext ? ` context=${safeContext}` : ''}`;
    return sendStructuredMessage(message, `Create a reminder: ${safeTitle} at ${remindAt}.`);
  }, [sendStructuredMessage]);

  const loadSessionMessages = useCallback(async (sid) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ChatAgentService.getSessionMessages(sid);
      const history = Array.isArray(response) ? response : (response.messages || []);
      setSessionId(sid);
      setMessages(history.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.message || msg.content,
        createdAt: new Date(msg.created_at),
      })));
    } catch (err) {
      setError(err.message || 'Failed to load messages');
      console.error('Load messages error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setPendingApproval(null);
    setReminderPrompt(null);
  }, []);

  return {
    sessionId,
    messages,
    loading,
    error,
    pendingApproval,
    reminderPrompt,
    sendMessage,
    findNearbyClinics,
    submitApproval,
    requestAppointment,
    requestReminder,
    loadSessionMessages,
    clearMessages,
    setError,
  };
};

export default useChatAgent;
