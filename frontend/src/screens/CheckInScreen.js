import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';

import { colors } from '../theme/colors';
import { responsiveSize, fontSize } from '../utils/responsive';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { AssessmentService } from '../services/assessmentService';
import { ApiService } from '../services/api';

const LAST_CHECKIN_RESULT_KEY = 'mindsentry_last_checkin_result';
const LOW_SCORE_THRESHOLD = 45;

const RISK_COLORS = {
  low: colors.success,
  moderate: colors.warning || '#F59E0B',
  high: colors.danger,
};

const DAILY_QUESTIONS = [
  {
    id: 'sleep_quality',
    icon: 'moon-outline',
    title: 'How was your sleep quality last night?',
    options: ['Poor', 'Below average', 'Average', 'Good', 'Excellent'],
  },
  {
    id: 'stress_load',
    icon: 'pulse-outline',
    title: 'How intense was your stress today?',
    options: ['Very low', 'Low', 'Moderate', 'High', 'Very high'],
  },
  {
    id: 'focus_consistency',
    icon: 'eye-outline',
    title: 'How consistent was your focus during work/study?',
    options: ['Very low', 'Low', 'Okay', 'Strong', 'Excellent'],
  },
  {
    id: 'social_energy',
    icon: 'people-outline',
    title: 'How connected and supported did you feel today?',
    options: ['Isolated', 'Somewhat distant', 'Neutral', 'Connected', 'Very connected'],
  },
  {
    id: 'physical_energy',
    icon: 'walk-outline',
    title: 'How was your physical energy through the day?',
    options: ['Exhausted', 'Low', 'Moderate', 'Good', 'Very high'],
  },
];

const MOODS = ['Calm', 'Positive', 'Focused', 'Anxious', 'Tired'];

const PulsingDot = () => <View style={styles.pulseDot} />;

const deriveRiskLevel = (analysisResult) => {
  const stress = analysisResult?.stress_score ?? 0.5;
  if (stress >= 0.7) return 'high';
  if (stress >= 0.4) return 'moderate';
  return 'low';
};

const toEmotionLabel = (emotion) => {
  if (!emotion) return 'Unknown';
  const raw = String(emotion).replace(/_/g, ' ').trim();
  if (!raw) return 'Unknown';
  return raw
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
};

const toPercent = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '--';
  return `${Math.round(Number(value) * 100)}%`;
};

const scoreBandLabel = (score) => {
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Moderate';
  return 'Needs support';
};

const moodBandLabel = (moodPercent) => {
  if (moodPercent >= 70) return 'Positive';
  if (moodPercent >= 45) return 'Balanced';
  return 'Low';
};

const stressBandLabel = (stressPercent) => {
  if (stressPercent >= 70) return 'High';
  if (stressPercent >= 40) return 'Moderate';
  return 'Low';
};

const buildScoreRecommendation = (score, analysisResult) => {
  const stressPct = Math.round((analysisResult?.stress_score ?? 0.5) * 100);
  const moodPct = Math.round((analysisResult?.mood_score ?? 0.5) * 100);

  if (score < 35) {
    return {
      title: 'High-priority recovery plan',
      body: 'Your score is in a high-risk zone. Keep commitments minimal today, focus on hydration, food, and sleep, and contact a trusted person. If distress escalates, seek urgent professional support.',
    };
  }

  if (score < 55) {
    return {
      title: 'Stabilize and reduce pressure',
      body: `Stress is ${stressPct}% and mood is ${moodPct}%. Use 2 to 3 short recovery blocks today: breathing, a 10-minute walk, and one low-effort task at a time to lower overload.`,
    };
  }

  if (score < 75) {
    return {
      title: 'Maintain momentum safely',
      body: 'You are in a moderate zone. Preserve routine with balanced meals, focused work windows, and social connection. Keep stress from drifting up with short breaks every 60 to 90 minutes.',
    };
  }

  return {
    title: 'Strong wellness maintenance',
    body: 'Great baseline today. Keep this score steady by continuing current habits and adding one proactive step: exercise, outdoor time, or meaningful conversation.',
  };
};

export const CheckInScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const historyAssessmentId = route?.params?.assessmentId || null;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasAudioPerm, setHasAudioPerm] = useState(null);

  const [mood, setMood] = useState('Calm');
  const [answers, setAnswers] = useState({});
  const [daySummary, setDaySummary] = useState('');
  const [foodSummary, setFoodSummary] = useState('');

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState(null);

  const [audioDuration, setAudioDuration] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [audioUri, setAudioUri] = useState(null);
  const [videoUri, setVideoUri] = useState(null);

  const [readingPrompt, setReadingPrompt] = useState('');
  const [videoTaskPrompt, setVideoTaskPrompt] = useState('');
  const [promptsLoading, setPromptsLoading] = useState(false);

  const [phase, setPhase] = useState('idle');
  const [processingStage, setProcessingStage] = useState('Preparing...');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [riskScore, setRiskScore] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const cameraRef = useRef(null);
  const audioTimerRef = useRef(null);
  const videoTimerRef = useRef(null);

  const computeSessionScore = useCallback((analysisResult) => {
    if (analysisResult?.wellness_score != null) {
      const parsed = parseFloat(String(analysisResult.wellness_score).trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    const stress = analysisResult?.stress_score ?? 0.5;
    const moodScore = analysisResult?.mood_score ?? 0.5;
    return Math.round(((1 - stress) * 0.45 + moodScore * 0.55) * 100);
  }, []);

  const buildChatContext = useCallback((analysisResult, risk, recs, score) => {
    const topRecommendations = Array.isArray(recs)
      ? recs.slice(0, 3).map((item) => ({
        title: item?.title || 'Recommendation',
        description: item?.description || '',
        priority: item?.priority || 'medium',
      }))
      : [];

    return {
      source: historyAssessmentId ? 'history-result' : 'fresh-checkin',
      assessmentId: analysisResult?.assessment_id || historyAssessmentId,
      wellnessScore: score,
      riskLevel: risk?.final_risk_level || analysisResult?.support_level || deriveRiskLevel(analysisResult),
      moodScorePercent: Math.round((analysisResult?.mood_score ?? 0.5) * 100),
      stressScorePercent: Math.round((analysisResult?.stress_score ?? 0.5) * 100),
      textEmotion: toEmotionLabel(analysisResult?.text_emotion),
      audioEmotion: toEmotionLabel(analysisResult?.audio_emotion),
      videoEmotion: toEmotionLabel(analysisResult?.video_emotion),
      topRecommendations,
    };
  }, [historyAssessmentId]);

  const fetchPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const data = await ApiService.getCheckInPrompts();
      setReadingPrompt(String(data?.reading_paragraph || '').trim());
      setVideoTaskPrompt(String(data?.video_task || '').trim());
    } catch {
      setReadingPrompt(
        'Today I stayed present and balanced. I handled tasks step by step, took short breaks, and kept a calm tone while reading this wellness voice passage.'
      );
      setVideoTaskPrompt(
        'Face the camera center, turn slowly left and right, then move your chin up and down while blinking naturally and keeping your face inside the frame.'
      );
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  const loadHistoryResult = useCallback(async (assessmentId) => {
    if (!assessmentId) return;
    setHistoryLoading(true);
    setErrorMsg('');
    try {
      const [analysisResult, risk, recs] = await Promise.all([
        ApiService.getAnalysisResult(assessmentId),
        ApiService.getRiskScore(assessmentId),
        ApiService.getRecommendations(assessmentId),
      ]);

      setResult({
        ...analysisResult,
        assessment_id: analysisResult?.assessment_id || assessmentId,
      });
      setRiskScore(risk || null);
      setRecommendations(Array.isArray(recs) ? recs : []);
      setPhase('success');
    } catch (err) {
      setErrorMsg(err?.message || 'Could not load this check-in result.');
      setPhase('error');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasAudioPerm(status === 'granted');
      fetchPrompts();
    })();

    return () => {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    };
  }, [fetchPrompts]);

  useEffect(() => {
    if (historyAssessmentId) {
      loadHistoryResult(historyAssessmentId);
    }
  }, [historyAssessmentId, loadHistoryResult]);

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const buildCheckInNarrative = () => {
    const parts = [`Mood: ${mood}.`];

    for (const q of DAILY_QUESTIONS) {
      const value = answers[q.id];
      if (value) {
        parts.push(`${q.title} ${value}.`);
      }
    }

    if (daySummary.trim()) {
      parts.push(`Daily activities: ${daySummary.trim()}.`);
    }
    if (foodSummary.trim()) {
      parts.push(`Food and hydration: ${foodSummary.trim()}.`);
    }
    if (audioUri) {
      parts.push('Voice reading sample captured with guided paragraph.');
    }
    if (videoUri) {
      parts.push('Guided face movement video sample captured for visual analysis.');
    }

    return parts.join(' ');
  };

  const startAudioRecording = async () => {
    if (!hasAudioPerm) {
      setErrorMsg('Microphone permission is needed to record audio.');
      return;
    }
    if (!readingPrompt) {
      setErrorMsg('Reading paragraph is loading. Please try again in a moment.');
      return;
    }

    try {
      setErrorMsg('');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recorder = new Audio.Recording();
      await recorder.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recorder.startAsync();
      setAudioRecorder(recorder);
      setIsRecordingAudio(true);
      setAudioDuration(0);
      setAudioUri(null);
      audioTimerRef.current = setInterval(() => setAudioDuration((prev) => prev + 1), 1000);
    } catch {
      setErrorMsg('Could not start recording. Please try again.');
    }
  };

  const stopAudioRecording = async () => {
    try {
      if (!audioRecorder) return;
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      await audioRecorder.stopAndUnloadAsync();
      const uri = audioRecorder.getURI();
      setAudioRecorder(null);
      setIsRecordingAudio(false);
      if (uri) setAudioUri(uri);
    } catch {
      setIsRecordingAudio(false);
      setErrorMsg('Could not stop recording cleanly. Please try again.');
    }
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setErrorMsg('');
      setIsRecordingVideo(true);
      setVideoDuration(0);
      setVideoUri(null);
      videoTimerRef.current = setInterval(() => setVideoDuration((prev) => prev + 1), 1000);
      const recording = await cameraRef.current.recordAsync({ maxDuration: 18, quality: '480p' });
      if (recording?.uri) {
        setVideoUri(recording.uri);
      }
      setIsCameraActive(false);
    } catch {
      setErrorMsg('Could not record video. Please try again.');
    } finally {
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
      setIsRecordingVideo(false);
    }
  };

  const stopVideoRecording = () => {
    try {
      if (cameraRef.current && isRecordingVideo) {
        cameraRef.current.stopRecording();
      }
    } catch {
      setErrorMsg('Could not stop video recording cleanly.');
    }
  };

  const handleSubmit = async () => {
    const answeredCount = Object.values(answers).filter(Boolean).length;
    if (answeredCount < 3) {
      setErrorMsg('Please answer at least 3 daily questions.');
      return;
    }
    if (!daySummary.trim()) {
      setErrorMsg('Please add what you did throughout the day.');
      return;
    }

    const checkInText = buildCheckInNarrative();
    setErrorMsg('');
    setPhase('submitting');
    setProcessingStage('Creating your check-in session...');

    try {
      await new Promise((r) => setTimeout(r, 200));
      if (audioUri) setProcessingStage('Uploading guided voice reading...');
      if (videoUri) setProcessingStage('Uploading guided face video...');
      setProcessingStage('Running AI analysis...');

      const { assessment, result: analysisResult, risk, recommendations: recs, inference } =
        await AssessmentService.performCheckIn(mood, checkInText, {
          audioUri,
          videoUri,
        });

      const mergedResult = {
        ...analysisResult,
        assessment_id: assessment?.id,
        inference_tracking: analysisResult?.inference_tracking || inference?.tracking || null,
      };

      setResult(mergedResult);
      setRiskScore(risk || null);
      setRecommendations(Array.isArray(recs) ? recs : []);

      const sessionScore = computeSessionScore(mergedResult);
      await AsyncStorage.setItem(
        LAST_CHECKIN_RESULT_KEY,
        JSON.stringify({
          assessment_id: assessment?.id,
          score: sessionScore,
          mood_score: mergedResult?.mood_score,
          stress_score: mergedResult?.stress_score,
          created_at: new Date().toISOString(),
        })
      );

      setPhase('success');
    } catch (err) {
      setErrorMsg(err?.message || 'Something went wrong. Please try again.');
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setResult(null);
    setRiskScore(null);
    setRecommendations([]);
    setErrorMsg('');
    setAnswers({});
    setDaySummary('');
    setFoodSummary('');
    setAudioUri(null);
    setVideoUri(null);
    setAudioDuration(0);
    setVideoDuration(0);
    fetchPrompts();

    if (historyAssessmentId) {
      navigation.setParams({ assessmentId: null });
    }
  };

  if (isCameraActive) {
    if (!cameraPermission?.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera permission is needed.</Text>
          <Pressable onPress={requestCameraPermission} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.fullScreenCamera}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" mode="video" />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Pressable onPress={() => setIsCameraActive(false)} style={styles.closeCameraButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.faceGuideContainer}>
            <View style={styles.faceGuideCircle} />
            <View style={styles.cameraTaskCard}>
              <Text style={styles.cameraTaskTitle}>Video Task</Text>
              <Text style={styles.cameraInstruction}>{videoTaskPrompt}</Text>
            </View>
            {isRecordingVideo && (
              <View style={styles.recordingStateDark}>
                <PulsingDot />
                <Text style={styles.recordingTextDark}>Recording: {formatTime(videoDuration)}</Text>
              </View>
            )}
          </View>

          <View style={styles.cameraFooter}>
            {!isRecordingVideo ? (
              <Pressable onPress={startVideoRecording} style={styles.shutterButton}>
                <View style={styles.shutterInner} />
              </Pressable>
            ) : (
              <Pressable onPress={stopVideoRecording} style={styles.stopVideoButton}>
                <Ionicons name="stop" size={26} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (phase === 'submitting') {
    return (
      <View style={styles.fullscreenContainer}>
        <Animated.View>
          <Ionicons name="sparkles" size={44} color="#fff" />
        </Animated.View>
        <Text style={styles.processingTitle}>Analyzing Wellness</Text>
        <Text style={styles.processingStage}>{processingStage}</Text>
        <ActivityIndicator color="rgba(255,255,255,0.8)" size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (historyLoading) {
    return (
      <View style={styles.fullscreenContainer}>
        <ActivityIndicator color="rgba(255,255,255,0.85)" size="large" />
        <Text style={[styles.processingTitle, { marginTop: 20 }]}>Loading saved result</Text>
        <Text style={styles.processingStage}>Preparing your historical check-in insights...</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.fullscreenContainer}>
        <Animated.View>
          <Ionicons name="alert-circle" size={44} color="#fff" />
        </Animated.View>
        <Text style={styles.processingTitle}>Something went wrong</Text>
        <View style={{ width: '88%', marginTop: 16 }}>
          <ErrorBox message={errorMsg} />
        </View>
        <Pressable onPress={handleReset} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'success' && result) {
    const riskLevel = riskScore?.final_risk_level || deriveRiskLevel(result);
    const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.low;
    const stressPercent = result?.stress_score != null ? Math.round(result.stress_score * 100) : 50;
    const moodPercent = result?.mood_score != null ? Math.round(result.mood_score * 100) : 50;
    const sessionScore = computeSessionScore(result);
    const topRec = recommendations[0];
    const scoreBasedRec = buildScoreRecommendation(sessionScore, result);
    const isLowScore = sessionScore < LOW_SCORE_THRESHOLD;

    const modelOutput = result?.model_output_scores || result?.inference_tracking?.model_output_scores || {};
    const confidenceScorePct = result?.confidence_score != null ? `${Math.round(Number(result.confidence_score) * 100)}%` : '--';
    const integrityPct = result?.overall_integrity_score != null ? `${Math.round(Number(result.overall_integrity_score) * 100)}%` : '--';
    const spoofRiskPct = result?.overall_spoof_risk != null ? `${Math.round(Number(result.overall_spoof_risk) * 100)}%` : '--';

    const modalityInsights = [
      {
        key: 'text',
        icon: 'document-text-outline',
        title: 'Text Model',
        confidence: toPercent(result?.text_confidence),
        emotion: toEmotionLabel(result?.text_emotion),
      },
      {
        key: 'audio',
        icon: 'mic-outline',
        title: 'Voice Model',
        confidence: toPercent(result?.audio_confidence),
        emotion: toEmotionLabel(result?.audio_emotion),
      },
      {
        key: 'video',
        icon: 'videocam-outline',
        title: 'Video Model',
        confidence: toPercent(result?.video_confidence),
        emotion: toEmotionLabel(result?.video_emotion),
      },
    ];

    const chatContext = buildChatContext(result, riskScore, recommendations, sessionScore);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
        <Animated.View>
          <View style={[styles.successCircle, { backgroundColor: riskColor + '20' }]}>
            <Ionicons name="checkmark-circle" size={52} color={riskColor} />
          </View>
          <Text style={styles.successTitle}>Analysis Complete</Text>
          <Text style={styles.successSubtitle}>Your wellness score: {sessionScore}</Text>
        </Animated.View>

        <View style={styles.resultCard}>
          <View style={styles.resultCardRow}>
            <Text style={styles.resultLabel}>Risk Level</Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>{String(riskLevel).toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultRow}>
            <View style={styles.resultStat}>
              <Text style={styles.resultStatValue}>{stressPercent}%</Text>
              <Text style={styles.resultStatLabel}>Stress - {stressBandLabel(stressPercent)}</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={styles.resultStatValue}>{moodPercent}%</Text>
              <Text style={styles.resultStatLabel}>Mood - {moodBandLabel(moodPercent)}</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={styles.resultStatValue}>{sessionScore}</Text>
              <Text style={styles.resultStatLabel}>Wellness - {scoreBandLabel(sessionScore)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.modelOutputCard}>
          <View style={styles.modelOutputHeader}>
            <Ionicons name="analytics-outline" size={20} color={colors.primary} />
            <Text style={styles.modelOutputTitle}>Detailed Model Output</Text>
          </View>

          {modalityInsights.map((item) => (
            <View key={item.key} style={styles.modelOutputRow}>
              <View style={styles.modelOutputLeft}>
                <Ionicons name={item.icon} size={16} color={colors.textSecondary} />
                <Text style={styles.modelOutputLabel}>{item.title}</Text>
              </View>
              <Text style={styles.modelOutputValue}>{item.confidence} - {item.emotion}</Text>
            </View>
          ))}

          <View style={styles.modelDivider} />

          <View style={styles.modelOutputRow}>
            <Text style={styles.modelOutputLabel}>Overall model confidence</Text>
            <Text style={styles.modelOutputValue}>{confidenceScorePct}</Text>
          </View>
          <View style={styles.modelOutputRow}>
            <Text style={styles.modelOutputLabel}>Input integrity</Text>
            <Text style={styles.modelOutputValue}>{integrityPct}</Text>
          </View>
          <View style={styles.modelOutputRow}>
            <Text style={styles.modelOutputLabel}>Spoof risk</Text>
            <Text style={styles.modelOutputValue}>{spoofRiskPct}</Text>
          </View>

          {Object.keys(modelOutput).length > 0 ? (
            <Text style={styles.modelOutputNote} numberOfLines={4}>
              Raw model scores: {JSON.stringify(modelOutput)}
            </Text>
          ) : null}
        </View>

        {topRec ? (
          <View style={styles.recCard}>
            <View style={styles.recCardHeader}>
              <Ionicons name="bulb" size={20} color={colors.primary} />
              <Text style={styles.recCardTitle}>Top Recommendation</Text>
            </View>
            <Text style={styles.recCardTitle2}>{topRec.title}</Text>
            <Text style={styles.recCardDesc}>{topRec.description}</Text>
          </View>
        ) : null}

        <View style={styles.recCardAlt}>
          <View style={styles.recCardHeader}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            <Text style={styles.recCardTitle}>Recommendation Based On Your Score</Text>
          </View>
          <Text style={styles.recCardTitle2}>{scoreBasedRec.title}</Text>
          <Text style={styles.recCardDesc}>{scoreBasedRec.body}</Text>
        </View>

        {isLowScore ? (
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={styles.warningTitle}>Immediate precautions</Text>
            </View>
            <Text style={styles.warningText}>1) Reduce workload and prioritize rest today.</Text>
            <Text style={styles.warningText}>2) Reach out to a trusted person if distress rises.</Text>
            <Text style={styles.warningText}>3) If you feel unsafe, contact emergency or crisis services immediately.</Text>
          </View>
        ) : null}

        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeaderRow}>
            <View style={styles.disclaimerIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#9A3412" />
            </View>
            <Text style={styles.disclaimerTitle}>AI Disclaimer</Text>
          </View>
          <Text style={styles.disclaimerText}>
            This app provides AI-based wellness signals and is not a final medical diagnosis. Consult a qualified doctor for clinical decisions.
          </Text>
        </View>

        <View style={styles.resultButtonsBlock}>
          <View style={styles.resultButtonsRow}>
            <Pressable style={[styles.resultActionButton, styles.resultGhostButton]} onPress={() => navigation.navigate('Dashboard')}>
              <Text style={styles.resultGhostText}>Go to Dashboard</Text>
            </Pressable>
            <Pressable
              style={[styles.resultActionButton, styles.resultGhostButton]}
              onPress={() => navigation.navigate('ChatBot', { wellnessContext: chatContext })}
            >
              <Text style={styles.resultGhostText}>Talk to AarogyaAI</Text>
            </Pressable>
          </View>

          <Pressable onPress={handleReset} style={styles.doneButton}>
            <LinearGradient
              colors={[colors.primary, '#7C3AED']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.doneGradient}
            >
              <Text style={styles.doneButtonText}>New Check-in</Text>
              <Ionicons name="refresh" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </LinearGradient>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SectionHeader
            title="Daily Check-in"
            showBack
            onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
          />
          <Text style={styles.subHeader}>A guided check-in with AI-powered text, voice, and face movement signals</Text>

          <ErrorBox message={errorMsg} onDismiss={() => setErrorMsg('')} />

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="happy-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>How are you feeling right now?</Text>
            </View>
            <View style={styles.chipRow}>
              {MOODS.map((item) => {
                const isActive = mood === item;
                return (
                  <Pressable key={item} onPress={() => setMood(item)} style={[styles.chip, isActive && styles.chipActive]}>
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Quality Daily Questions</Text>
            </View>

            {DAILY_QUESTIONS.map((q) => (
              <View key={q.id} style={styles.questionBlock}>
                <View style={styles.questionTitleRow}>
                  <Ionicons name={q.icon} size={16} color={colors.textSecondary} />
                  <Text style={styles.questionTitle}>{q.title}</Text>
                </View>
                <View style={styles.chipRow}>
                  {q.options.map((option) => {
                    const isActive = answers[q.id] === option;
                    return (
                      <Pressable
                        key={`${q.id}-${option}`}
                        onPress={() => setAnswer(q.id, option)}
                        style={[styles.chip, styles.answerChip, isActive && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="mic-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Guided Voice Reading</Text>
            </View>
            <Text style={styles.mediaHint}>Read the paragraph clearly in your natural speaking pace. This helps the model capture consistent voice markers.</Text>

            <View style={styles.promptCard}>
              {promptsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.promptText}>{readingPrompt}</Text>
              )}
            </View>

            <View style={styles.mediaRow}>
              <Pressable onPress={fetchPrompts} style={[styles.mediaAction, styles.mediaActionAlt]}>
                <Ionicons name="refresh" size={18} color={colors.textPrimary} />
                <Text style={styles.mediaActionTextAlt}>New Paragraph</Text>
              </Pressable>
              <Pressable onPress={isRecordingAudio ? stopAudioRecording : startAudioRecording} style={[styles.mediaAction, isRecordingAudio && styles.mediaActionStop]}>
                <Ionicons name={isRecordingAudio ? 'stop' : 'mic'} size={18} color="#fff" />
                <Text style={styles.mediaActionText}>{isRecordingAudio ? 'Stop Voice' : audioUri ? 'Re-record Voice' : 'Record Voice'}</Text>
              </Pressable>
            </View>

            {isRecordingAudio && (
              <View style={styles.recordingState}>
                <PulsingDot />
                <Text style={styles.recordingText}>Recording: {formatTime(audioDuration)}</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="videocam-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Guided Face Movement Video</Text>
            </View>

            <Text style={styles.mediaHint}>Follow the task exactly while recording. This gives better dynamic visual data than a static photo.</Text>
            <View style={styles.promptCard}>
              {promptsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.promptText}>{videoTaskPrompt}</Text>
              )}
            </View>

            <View style={styles.mediaRow}>
              <Pressable onPress={fetchPrompts} style={[styles.mediaAction, styles.mediaActionAlt]}>
                <Ionicons name="refresh" size={18} color={colors.textPrimary} />
                <Text style={styles.mediaActionTextAlt}>New Task</Text>
              </Pressable>
              <Pressable onPress={() => setIsCameraActive(true)} style={[styles.mediaAction, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.mediaActionText}>{videoUri ? 'Re-record Video' : 'Record Video'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Your Day Summary</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="What did you do today? Work, study, social time, stress moments, exercise, sleep..."
                placeholderTextColor={colors.textSecondary}
                value={daySummary}
                onChangeText={(text) => {
                  setDaySummary(text);
                  if (errorMsg) setErrorMsg('');
                }}
                style={styles.input}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={[styles.cardHeaderRow, { marginTop: 14 }]}>
              <View style={styles.iconContainer}>
                <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Food and Hydration</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="What did you eat and drink today?"
                placeholderTextColor={colors.textSecondary}
                value={foodSummary}
                onChangeText={(text) => {
                  setFoodSummary(text);
                  if (errorMsg) setErrorMsg('');
                }}
                style={[styles.input, { minHeight: 84 }]}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <Pressable onPress={handleSubmit} style={styles.primaryButton} disabled={isRecordingAudio || isRecordingVideo || promptsLoading}>
            <Text style={styles.primaryButtonText}>Save and Analyze</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </Pressable>

          <Text style={styles.mediaStatus}>Voice: {audioUri ? 'Attached' : 'Not attached'} | Video: {videoUri ? 'Attached' : 'Not attached'}</Text>

          <View style={styles.disclaimerCard}>
            <View style={styles.disclaimerHeaderRow}>
              <View style={styles.disclaimerIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#9A3412" />
              </View>
              <Text style={styles.disclaimerTitle}>AI Disclaimer</Text>
            </View>
            <Text style={styles.disclaimerText}>
              This app provides AI-based wellness signals and is not a final medical diagnosis. Consult a qualified doctor for clinical decisions.
            </Text>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: responsiveSize.lg, paddingBottom: responsiveSize.xl },
  subHeader: { fontSize: fontSize.body, color: colors.textSecondary, marginTop: 4, marginBottom: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: responsiveSize.lg,
    marginBottom: responsiveSize.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSize.md },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardLabel: { fontSize: fontSize.h6, color: colors.textPrimary, fontWeight: '700' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: { fontSize: fontSize.body, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  answerChip: { paddingVertical: 8, paddingHorizontal: 12 },

  questionBlock: {
    paddingBottom: responsiveSize.md,
    marginBottom: responsiveSize.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  questionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  questionTitle: { marginLeft: 8, fontSize: fontSize.body, color: colors.textPrimary, fontWeight: '600', flex: 1 },

  mediaHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 18 },
  promptCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 12,
    minHeight: 74,
    justifyContent: 'center',
    marginBottom: 10,
  },
  promptText: { color: colors.textPrimary, fontSize: 13, lineHeight: 20 },
  mediaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  mediaAction: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mediaActionAlt: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  mediaActionStop: { backgroundColor: colors.danger },
  mediaActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  mediaActionTextAlt: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  recordingState: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  recordingText: { color: colors.danger, fontWeight: '700', fontSize: 12, marginLeft: 8 },
  mediaStatus: { marginTop: 10, marginBottom: 12, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },

  inputWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
  },
  input: {
    minHeight: 110,
    padding: responsiveSize.md,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    textAlignVertical: 'top',
  },

  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  primaryButtonText: { fontSize: fontSize.h6, color: '#fff', fontWeight: '700' },

  disclaimerCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
  },
  disclaimerHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  disclaimerIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FED7AA',
  },
  disclaimerTitle: { fontSize: 13, fontWeight: '800', color: '#9A3412', marginLeft: 8, letterSpacing: 0.2 },
  disclaimerText: { fontSize: 12.5, color: '#9A3412', lineHeight: 19, letterSpacing: 0.1 },

  fullscreenContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  processingTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' },
  processingStage: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  retryButton: { marginTop: 32, backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  retryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 16 },

  resultContent: { padding: responsiveSize.lg },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  successSubtitle: { fontSize: fontSize.body, color: colors.textSecondary, marginTop: 4, textAlign: 'center', marginBottom: 14 },

  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  resultCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultLabel: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  riskBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  resultDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resultStat: { alignItems: 'center', flex: 1, paddingHorizontal: 6 },
  resultStatValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  resultStatLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  modelOutputCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  modelOutputHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modelOutputTitle: { marginLeft: 8, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  modelOutputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  modelOutputLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  modelOutputLabel: { marginLeft: 7, fontSize: 13, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  modelOutputValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  modelDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  modelOutputNote: { marginTop: 8, fontSize: 11.5, color: colors.textSecondary, lineHeight: 16 },

  recCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  recCardAlt: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 16,
  },
  recCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  recCardTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  recCardTitle2: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  recCardDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  warningCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  warningHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  warningTitle: { marginLeft: 8, color: colors.danger, fontWeight: '800', fontSize: 14 },
  warningText: { color: '#991B1B', fontSize: 13, lineHeight: 20, marginBottom: 4 },

  resultButtonsBlock: { marginTop: 14 },
  resultButtonsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  resultActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultGhostButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  resultGhostText: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  doneButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  doneGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  fullScreenCamera: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'space-between',
    paddingVertical: 30,
  },
  cameraHeader: { alignItems: 'flex-end', paddingHorizontal: 20 },
  closeCameraButton: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  faceGuideContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  faceGuideCircle: {
    width: 240,
    height: 310,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  cameraTaskCard: {
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  cameraTaskTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cameraInstruction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  recordingStateDark: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  recordingTextDark: { color: '#fff', fontWeight: '700', fontSize: 12, marginLeft: 8 },
  cameraFooter: { alignItems: 'center', marginBottom: 16 },
  shutterButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: '#111827',
    backgroundColor: '#fff',
  },
  stopVideoButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },

  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  permissionText: { color: '#fff', marginBottom: 20, fontSize: 16 },
  permissionButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  permissionButtonText: { color: '#fff', fontWeight: '600' },
});
