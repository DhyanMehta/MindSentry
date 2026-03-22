import { AuthService } from './authService';
import { requestJson, requestFormData } from './httpClient';

/**
 * Makes an authenticated JSON API request
 */
const makeRequest = async (endpoint, options = {}) => {
  const accessToken = await AuthService.getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const { data, status } = await requestJson(endpoint, {
      ...options,
      headers,
    });

    if (status === 401 && accessToken) {
      await AuthService.logout();
      throw new Error('Session expired. Please log in again.');
    }

    return data;
  } catch (error) {
    if (error?.status === 401 && accessToken) {
      await AuthService.logout();
      throw new Error('Session expired. Please log in again.');
    }

    throw error;
  }
};

/**
 * Makes an authenticated multipart/form-data request (for file uploads)
 * Do NOT set Content-Type header — fetch sets it automatically with the boundary
 */
const makeFormRequest = async (endpoint, formData) => {
  const accessToken = await AuthService.getAccessToken();

  const headers = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const { data, status } = await requestFormData(endpoint, formData, {
      method: 'POST',
      headers,
    });

    if (status === 401) {
      await AuthService.logout();
      throw new Error('Session expired. Please log in again.');
    }

    return data;
  } catch (error) {
    if (error?.status === 401) {
      await AuthService.logout();
      throw new Error('Session expired. Please log in again.');
    }

    throw error;
  }
};

export const ApiService = {
  // ── Assessments ─────────────────────────────────────────────────────────────
  createAssessment: (sessionType = 'checkin', notes = '') =>
    makeRequest('/assessments/', {
      method: 'POST',
      body: JSON.stringify({ session_type: sessionType, notes }),
    }),

  getAssessments: () => makeRequest('/assessments/'),

  getAssessment: (id) => makeRequest(`/assessments/${id}`),

  // ── Text Analysis ────────────────────────────────────────────────────────────
  submitText: (assessmentId, rawText, language = 'en') =>
    makeRequest('/text/submit', {
      method: 'POST',
      body: JSON.stringify({ assessment_id: assessmentId, raw_text: rawText, language }),
    }),

  getTextEntry: (assessmentId) => makeRequest(`/text/${assessmentId}`),

  // ── Audio Upload ─────────────────────────────────────────────────────────────
  uploadAudio: async (assessmentId, audioUri) => {
    const formData = new FormData();
    const filename = audioUri.split('/').pop() || 'recording.m4a';
    const ext = filename.split('.').pop()?.toLowerCase() || 'm4a';
    const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg' };
    const mimeType = mimeMap[ext] || 'audio/mp4';
    formData.append('file', { uri: audioUri, name: filename, type: mimeType });
    return makeFormRequest(`/audio/upload/${assessmentId}`, formData);
  },

  getAudioEntry: (assessmentId) => makeRequest(`/audio/${assessmentId}`),

  // ── Video / Photo Upload ─────────────────────────────────────────────────────
  uploadPhoto: async (assessmentId, photoUri) => {
    const formData = new FormData();
    const filename = photoUri.split('/').pop() || 'photo.jpg';
    formData.append('file', { uri: photoUri, name: filename, type: 'image/jpeg' });
    return makeFormRequest(`/video/upload/${assessmentId}`, formData);
  },

  getVideoEntry: (assessmentId) => makeRequest(`/video/${assessmentId}`),

  // ── Analysis ──────────────────────────────────────────────────────────────────
  runAnalysis: (assessmentId) =>
    makeRequest(`/analysis/run/${assessmentId}`, { method: 'POST' }),

  getAnalysisResult: (assessmentId) => makeRequest(`/analysis/result/${assessmentId}`),

  getInferenceTracking: (assessmentId) => makeRequest(`/analysis/inference/${assessmentId}`),

  getRiskScore: (assessmentId) => makeRequest(`/analysis/risk/${assessmentId}`),

  getSafetyFlags: (assessmentId) => makeRequest(`/analysis/safety/${assessmentId}`),

  getRecommendations: (assessmentId) =>
    makeRequest(`/analysis/recommendations/${assessmentId}`),

  // ── History ───────────────────────────────────────────────────────────────────
  getHistoryAssessments: (limit = 20, offset = 0) =>
    makeRequest(`/history/assessments?limit=${limit}&offset=${offset}`),

  getHistoryTrend: (limit = 10) => makeRequest(`/history/trend?limit=${limit}`),

  getHistorySummary: () => makeRequest('/history/summary'),

  // ── Questionnaires ────────────────────────────────────────────────────────────
  getQuestionnaireTemplates: () => makeRequest('/questionnaires/templates'),

  submitQuestionnaire: (assessmentId, templateId, items) =>
    makeRequest('/questionnaires/submit', {
      method: 'POST',
      body: JSON.stringify({ assessment_id: assessmentId, template_id: templateId, items }),
    }),

  // ── Auth ──────────────────────────────────────────────────────────────────────
  getUserProfile: () => makeRequest('/auth/me'),

  updateUserProfile: (updates) =>
    makeRequest('/auth/me', { method: 'PUT', body: JSON.stringify(updates) }),
};

/**
 * Generic HTTP methods for API requests (used by ChatAgentService and other services)
 */
export const post = (endpoint, body, options = {}) =>
  makeRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });

export const get = (endpoint, options = {}) =>
  makeRequest(endpoint, {
    method: 'GET',
    ...options,
  });

export const put = (endpoint, body, options = {}) =>
  makeRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
    ...options,
  });

export const patch = (endpoint, body, options = {}) =>
  makeRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
    ...options,
  });

export const deleteRequest = (endpoint, options = {}) =>
  makeRequest(endpoint, {
    method: 'DELETE',
    ...options,
  });
