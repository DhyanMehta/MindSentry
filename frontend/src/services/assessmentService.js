/**
 * AssessmentService
 * Higher-level workflow helpers that combine multiple ApiService calls.
 * Handles cross-screen state via AsyncStorage (current assessment ID).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from './api';

const CURRENT_ASSESSMENT_KEY = 'mindsentry_current_assessment_id';
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAILY_CHECKIN_TEMPLATE_CODE = 'daily_checkin_v1';
let dailyCheckInTemplatePromise = null;

const QUESTION_VALUE_MAPS = {
  mood_overall: {
    Calm: 1,
    Positive: 0,
    Focused: 1,
    Anxious: 4,
    Tired: 3,
  },
  sleep_quality: {
    Poor: 4,
    'Below average': 3,
    Average: 2,
    Good: 1,
    Excellent: 0,
  },
  stress_load: {
    'Very low': 0,
    Low: 1,
    Moderate: 2,
    High: 3,
    'Very high': 4,
  },
  focus_consistency: {
    'Very low': 4,
    Low: 3,
    Okay: 2,
    Strong: 1,
    Excellent: 0,
  },
  social_energy: {
    Isolated: 4,
    'Somewhat distant': 3,
    Neutral: 2,
    Connected: 1,
    'Very connected': 0,
  },
  physical_energy: {
    Exhausted: 4,
    Low: 3,
    Moderate: 2,
    Good: 1,
    'Very high': 0,
  },
};

const fetchDailyCheckInTemplate = async () => {
  if (dailyCheckInTemplatePromise) {
    return dailyCheckInTemplatePromise;
  }

  dailyCheckInTemplatePromise = (async () => {
    const templates = await ApiService.getQuestionnaireTemplates();
    const template = (templates || []).find((item) => item.code === DAILY_CHECKIN_TEMPLATE_CODE);
    if (!template?.id) {
      dailyCheckInTemplatePromise = null;
      throw new Error('Daily check-in questionnaire is unavailable right now.');
    }

    const questions = await ApiService.getQuestionnaireQuestions(template.id);
    const questionsByCode = Object.fromEntries(
      (questions || [])
        .filter((question) => question?.question_code)
        .map((question) => [question.question_code, question])
    );

    return { template, questionsByCode };
  })();

  try {
    return await dailyCheckInTemplatePromise;
  } catch (error) {
    dailyCheckInTemplatePromise = null;
    throw error;
  }
};

const buildQuestionnaireItems = ({ mood, answers, daySummary, foodSummary }, questionsByCode) => {
  const payloads = [
    { code: 'mood_overall', answerValue: mood, scoredValue: QUESTION_VALUE_MAPS.mood_overall?.[mood] ?? null },
    { code: 'sleep_quality', answerValue: answers.sleep_quality, scoredValue: QUESTION_VALUE_MAPS.sleep_quality?.[answers.sleep_quality] ?? null },
    { code: 'stress_load', answerValue: answers.stress_load, scoredValue: QUESTION_VALUE_MAPS.stress_load?.[answers.stress_load] ?? null },
    { code: 'focus_consistency', answerValue: answers.focus_consistency, scoredValue: QUESTION_VALUE_MAPS.focus_consistency?.[answers.focus_consistency] ?? null },
    { code: 'social_energy', answerValue: answers.social_energy, scoredValue: QUESTION_VALUE_MAPS.social_energy?.[answers.social_energy] ?? null },
    { code: 'physical_energy', answerValue: answers.physical_energy, scoredValue: QUESTION_VALUE_MAPS.physical_energy?.[answers.physical_energy] ?? null },
    { code: 'day_summary', answerText: daySummary?.trim() || '', scoredValue: null },
    { code: 'food_summary', answerText: foodSummary?.trim() || '', scoredValue: null },
  ];

  return payloads
    .map((entry) => {
      const question = questionsByCode[entry.code];
      if (!question?.id) return null;
      return {
        question_id: question.id,
        answer_value: entry.answerValue ?? null,
        answer_text: entry.answerText ?? null,
        scored_value: entry.scoredValue,
      };
    })
    .filter(Boolean);
};

const buildCheckInNarrative = ({ mood, answers, daySummary, foodSummary, audioUri, photoUri, videoUri }) => {
  const parts = [`Mood: ${mood}.`];
  const prompts = {
    sleep_quality: 'Sleep quality',
    stress_load: 'Stress load',
    focus_consistency: 'Focus consistency',
    social_energy: 'Social support',
    physical_energy: 'Physical energy',
  };

  Object.entries(prompts).forEach(([key, label]) => {
    if (answers?.[key]) {
      parts.push(`${label}: ${answers[key]}.`);
    }
  });

  if (daySummary?.trim()) {
    parts.push(`Daily activities: ${daySummary.trim()}.`);
  }
  if (foodSummary?.trim()) {
    parts.push(`Food and hydration: ${foodSummary.trim()}.`);
  }
  if (audioUri) {
    parts.push('Voice sample captured.');
  }
  if (videoUri) {
    parts.push('Guided face movement video captured.');
  } else if (photoUri) {
    parts.push('Face image captured.');
  }

  return parts.join(' ');
};

const fetchAnalysisBundle = async (assessmentId) => {
  // 1. Run analysis first to generate the scores and recommendations in the backend
  let result;
  try {
    result = await ApiService.runAnalysis(assessmentId);
  } catch (err) {
    console.error('[AssessmentService] runAnalysis failed:', err);
    throw new Error(`Analysis failed: ${err?.message || 'Unknown error'}`);
  }

  // 2. Fetch the newly generated risk and recommendations now that they exist
  const [risk, recommendations] = await Promise.all([
    ApiService.getRiskScore(assessmentId),
    ApiService.getRecommendations(assessmentId),
  ]);

  let inference = null;
  try {
    inference = await ApiService.getInferenceTracking(assessmentId);
  } catch (_) {
    inference = null;
  }

  return { result, risk, recommendations, inference };
};

export const AssessmentService = {
  storeCurrentId: async (id) => {
    try {
      await AsyncStorage.setItem(CURRENT_ASSESSMENT_KEY, id);
    } catch (_) { }
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
    } catch (_) { }
  },

  getOrCreateActiveAssessment: async (notes = '') => {
    const currentId = await AssessmentService.getCurrentId();
    if (currentId) {
      try {
        const assessment = await ApiService.getAssessment(currentId);
        if (assessment?.status !== 'completed') {
          return assessment;
        }
      } catch (_) {
      }
      await AssessmentService.clearCurrentId();
    }

    const assessment = await ApiService.createAssessment('checkin', notes);
    await AssessmentService.storeCurrentId(assessment.id);
    return assessment;
  },

  performCheckIn: async ({ mood, answers, daySummary, foodSummary, audioUri = null, photoUri = null, videoUri = null }) => {
    const assessment = await AssessmentService.getOrCreateActiveAssessment(`Mood: ${mood}`);
    const { template, questionsByCode } = await fetchDailyCheckInTemplate();
    const questionnaireItems = buildQuestionnaireItems({ mood, answers, daySummary, foodSummary }, questionsByCode);
    const textPayload = buildCheckInNarrative({ mood, answers, daySummary, foodSummary, audioUri, photoUri, videoUri });

    await Promise.all([
      ApiService.submitQuestionnaire(assessment.id, template.id, questionnaireItems),
      ApiService.submitText(assessment.id, textPayload),
    ]);

    if (audioUri) {
      await ApiService.uploadAudio(assessment.id, audioUri);
    }
    if (videoUri) {
      await ApiService.uploadVideo(assessment.id, videoUri);
    } else if (photoUri) {
      await ApiService.uploadPhoto(assessment.id, photoUri);
    }

    const { result, risk, recommendations, inference } = await fetchAnalysisBundle(assessment.id);
    await AssessmentService.clearCurrentId();
    return { assessment, result, risk, recommendations, inference };
  },

  performCapture: async ({ assessmentId = null, audioUri = null, photoUri = null, videoUri = null }) => {
    const assessment = assessmentId
      ? await ApiService.getAssessment(assessmentId)
      : await AssessmentService.getOrCreateActiveAssessment('Capture extension session');

    if (audioUri) {
      await ApiService.uploadAudio(assessment.id, audioUri);
    }
    if (photoUri) {
      await ApiService.uploadPhoto(assessment.id, photoUri);
    }
    if (videoUri) {
      await ApiService.uploadVideo(assessment.id, videoUri);
    }

    const { result, risk, recommendations, inference } = await fetchAnalysisBundle(assessment.id);
    await AssessmentService.clearCurrentId();
    return { assessment, result, risk, recommendations, inference };
  },

  loadAssessmentBundle: async (assessmentId) => {
    // First, fetch the assessment to check its status
    let assessment;
    try {
      assessment = await ApiService.getAssessment(assessmentId);
    } catch (err) {
      throw new Error(`Could not load assessment: ${err?.message || 'Unknown error'}`);
    }

    // If assessment is still pending, no analysis results exist yet
    if (assessment?.status === 'pending') {
      return {
        assessment,
        result: null,
        risk: null,
        recommendations: [],
      };
    }

    // If assessment failed, return with null results
    if (assessment?.status === 'failed') {
      return {
        assessment,
        result: null,
        risk: null,
        recommendations: [],
        error: 'This check-in analysis failed to run. Please try again.',
      };
    }

    // If completed, fetch all results
    if (assessment?.status === 'completed') {
      try {
        const [analysisResult, risk, recommendations] = await Promise.all([
          ApiService.getAnalysisResult(assessmentId),
          ApiService.getRiskScore(assessmentId),
          ApiService.getRecommendations(assessmentId),
        ]);

        return {
          assessment,
          result: {
            ...analysisResult,
            assessment_id: analysisResult?.assessment_id || assessmentId,
          },
          risk: risk || null,
          recommendations: Array.isArray(recommendations) ? recommendations : [],
        };
      } catch (err) {
        // If 404 on completed assessment, analysis may have been deleted or not generated
        console.error('[AssessmentService] Error loading results for completed assessment:', err.message);
        throw new Error(`Could not load results for this check-in: ${err?.message || 'Unknown error'}`);
      }
    }

    // Unexpected status
    throw new Error(`Assessment has unexpected status: ${assessment?.status}`);
  },

  computeWellnessScore: (summary) => {
    if (!summary || (summary.total_assessments ?? 0) === 0) return null;
    const mood = summary.avg_mood_score ?? 0.5;
    const stress = summary.avg_stress_score ?? 0.5;
    return Math.round(((1 - stress) * 0.4 + mood * 0.6) * 100);
  },

  buildChartData: (trend, field, labels = WEEK_LABELS) => {
    const len = labels.length;
    const slice = trend.slice(-len);

    const data = labels.map((_, i) => {
      const entry = slice[i];
      if (!entry || entry[field] == null) return 0;
      return Math.round(entry[field] * 100);
    });

    return { labels, datasets: [{ data, strokeWidth: 2 }] };
  },

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

  recToInsight: (rec) => ({
    id: rec.id,
    title: rec.title,
    detail: rec.description,
    status: rec.priority === 'high' ? 'alert' : rec.priority === 'low' ? 'positive' : 'resolved',
    type: AssessmentService.recTypeToCategory(rec.recommendation_type),
    date: rec.created_at,
    recommendation_type: rec.recommendation_type,
  }),

  buildCounselorReply: (analysisResult, recommendations) => {
    const emotion = analysisResult.text_emotion || 'neutral';
    const stressScore = analysisResult.stress_score ?? 0.5;
    const crisisFlag = analysisResult.crisis_flag;

    if (crisisFlag) {
      return "I can hear that you're going through something really difficult right now. Please know you're not alone. If you feel in immediate danger, please call 988 or your local crisis line. I'm here to listen - can you tell me more about what's happening?";
    }

    const emotionReplies = {
      joy: "That's wonderful to hear! Positive emotions have real health benefits. What's been making you feel joyful lately?",
      anger: "I hear you - feeling angry can be really draining. Let's try to understand what's behind that feeling. What's been frustrating you?",
      disgust: "It sounds like something is really bothering you. Your feelings are valid. Would you like to explore what's been on your mind?",
      fear: "Feeling anxious or fearful is completely normal. Let's take a breath together. What feels most uncertain or scary right now?",
      sadness: "I'm sorry you're feeling this way. Sadness is a signal worth listening to. I'm here - would you like to talk about what's weighing on you?",
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
