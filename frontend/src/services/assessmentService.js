/**
 * AssessmentService
 * Higher-level workflow helpers that combine multiple ApiService calls.
 * Handles cross-screen state via AsyncStorage (current assessment ID).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from './api';

const CURRENT_ASSESSMENT_KEY = 'mindsentry_current_assessment_id';
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AssessmentService = {
  // ── Assessment ID storage (shared between CheckIn and CaptureScreen) ─────────
  storeCurrentId: async (id) => {
    try {
      await AsyncStorage.setItem(CURRENT_ASSESSMENT_KEY, id);
    } catch (_) {}
  },

  getCurrentId: async () => {
    try {
      return await AsyncStorage.getItem(CURRENT_ASSESSMENT_KEY);
    } catch (_) {
      return null;
    }
  },

  clearCurrentId: async () => {
    try {
      await AsyncStorage.removeItem(CURRENT_ASSESSMENT_KEY);
    } catch (_) {}
  },

  // ── Full check-in flow (mood + questions + optional media → analysis) ───────
  performCheckIn: async (mood, checkInText, options = {}) => {
    const { audioUri = null, photoUri = null } = options;

    // Step 1: Create assessment
    const assessment = await ApiService.createAssessment('checkin', `Mood: ${mood}`);

    // Step 2: Submit text generated from daily check-in questions
    const textPayload = checkInText?.trim() ? checkInText : `Mood: ${mood}`;
    await ApiService.submitText(assessment.id, textPayload);

    // Step 3: Optionally attach voice/photo to the same check-in
    if (audioUri) {
      await ApiService.uploadAudio(assessment.id, audioUri);
    }
    if (photoUri) {
      await ApiService.uploadPhoto(assessment.id, photoUri);
    }

    // Step 4: Run fusion analysis
    const result = await ApiService.runAnalysis(assessment.id);

    // Step 5: Fetch risk and recommendations
    const risk = await ApiService.getRiskScore(assessment.id);
    const recommendations = await ApiService.getRecommendations(assessment.id);

    return { assessment, result, risk, recommendations };
  },

  // ── Enhance existing session with audio / photo ──────────────────────────────
  performCapture: async (assessmentId, audioUri, photoUri) => {
    const uploads = [];

    if (audioUri) {
      uploads.push(ApiService.uploadAudio(assessmentId, audioUri));
    }
    if (photoUri) {
      uploads.push(ApiService.uploadPhoto(assessmentId, photoUri));
    }

    if (uploads.length > 0) {
      await Promise.all(uploads);
    }

    // Re-run analysis with the new modalities
    const result = await ApiService.runAnalysis(assessmentId);
    const risk = await ApiService.getRiskScore(assessmentId);
    const recommendations = await ApiService.getRecommendations(assessmentId);
    return { result, risk, recommendations };
  },

  // ── Wellness score derived from risk scores ──────────────────────────────────
  computeWellnessScore: (summary) => {
    if (!summary || (summary.total_assessments ?? 0) === 0) return null;
    const mood = summary.avg_mood_score ?? 0.5;
    const stress = summary.avg_stress_score ?? 0.5;
    // Weighted: mood accounts for 60%, stress reduction 40%
    return Math.round(((1 - stress) * 0.4 + mood * 0.6) * 100);
  },

  // ── Build 7-point chart data from trend array ────────────────────────────────
  buildChartData: (trend, field, labels = WEEK_LABELS) => {
    const len = labels.length;
    const slice = trend.slice(-len); // take most recent N entries

    const data = labels.map((_, i) => {
      const entry = slice[i];
      if (!entry || entry[field] == null) return 0;
      // Risk scores are 0..1 float; multiply to percent for display
      return Math.round(entry[field] * 100);
    });

    return { labels, datasets: [{ data, strokeWidth: 2 }] };
  },

  // ── Map recommendation type to friendly category label ───────────────────────
  recTypeToCategory: (type) => {
    const map = {
      breathing: 'Stress',
      journaling: 'Mood',
      rest: 'Sleep',
      social: 'Mood',
      professional: 'Stress',
    };
    return map[type] || 'Mood';
  },

  // ── Map recommendation to insight card shape ─────────────────────────────────
  recToInsight: (rec) => ({
    id: rec.id,
    title: rec.title,
    detail: rec.description,
    status: rec.priority === 'high' ? 'alert' : rec.priority === 'low' ? 'positive' : 'resolved',
    type: AssessmentService.recTypeToCategory(rec.recommendation_type),
    date: rec.created_at,
    recommendation_type: rec.recommendation_type,
  }),

  // ── Quick AI counselor reply based on emotion ─────────────────────────────────
  buildCounselorReply: (analysisResult, recommendations) => {
    const emotion = analysisResult.text_emotion || 'neutral';
    const stressScore = analysisResult.stress_score ?? 0.5;
    const crisisFlag = analysisResult.crisis_flag;

    if (crisisFlag) {
      return "I can hear that you're going through something really difficult right now. Please know you're not alone. If you feel in immediate danger, please call 988 or your local crisis line. I'm here to listen — can you tell me more about what's happening?";
    }

    const emotionReplies = {
      joy: "That's wonderful to hear! Positive emotions have real health benefits. What's been making you feel joyful lately?",
      anger: "I hear you — feeling angry can be really draining. Let's try to understand what's behind that feeling. What's been frustrating you?",
      disgust: "It sounds like something is really bothering you. Your feelings are valid. Would you like to explore what's been on your mind?",
      fear: "Feeling anxious or fearful is completely normal. Let's take a breath together. What feels most uncertain or scary right now?",
      sadness: "I'm sorry you're feeling this way. Sadness is a signal worth listening to. I'm here — would you like to talk about what's weighing on you?",
      surprise: "It sounds like something unexpected happened. How are you processing it?",
      neutral: "Thank you for sharing. I'm here to support you. How would you describe how you're feeling in a little more detail?",
    };

    let reply = emotionReplies[emotion] || emotionReplies.neutral;

    if (stressScore > 0.6 && recommendations.length > 0) {
      const topRec = recommendations[0];
      reply += ` Also, based on your check-in: ${topRec.description}`;
    }

    return reply;
  },
};
