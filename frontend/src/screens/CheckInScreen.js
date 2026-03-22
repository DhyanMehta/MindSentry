import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';

import { colors } from '../theme/colors';
import { responsiveSize, fontSize } from '../utils/responsive';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { AssessmentService } from '../services/assessmentService';

const RISK_COLORS = {
  low: colors.success,
  moderate: colors.warning || '#F59E0B',
  high: colors.danger,
};

const LOW_SCORE_THRESHOLD = 45;

const DAILY_QUESTIONS = [
  {
    id: 'energy',
    icon: 'flash-outline',
    title: 'How was your energy today?',
    options: ['Very low', 'Low', 'Okay', 'High', 'Very high'],
  },
  {
    id: 'stress',
    icon: 'pulse-outline',
    title: 'How stressed did you feel?',
    options: ['Not at all', 'A little', 'Moderate', 'High', 'Very high'],
  },
  {
    id: 'focus',
    icon: 'eye-outline',
    title: 'How focused were you?',
    options: ['Very low', 'Low', 'Okay', 'High', 'Very high'],
  },
  {
    id: 'social',
    icon: 'people-outline',
    title: 'How connected did you feel to others?',
    options: ['Isolated', 'Distant', 'Neutral', 'Connected', 'Very connected'],
  },
];

const PulsingDot = () => {
  return <View style={styles.pulseDot} />;
};

export const CheckInScreen = () => {
  const navigation = useNavigation();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasAudioPerm, setHasAudioPerm] = useState(null);
  const [mood, setMood] = useState('Calm');
  const moods = ['Calm', 'Happy', 'Focused', 'Stressed', 'Tired'];

  const [answers, setAnswers] = useState({});
  const [reflection, setReflection] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // 'idle' | 'submitting' | 'success' | 'error'
  const [phase, setPhase] = useState('idle');
  const [processingStage, setProcessingStage] = useState('Preparing...');
  const [result, setResult] = useState(null);
  const [riskScore, setRiskScore] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasAudioPerm(status === 'granted');
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const buildCheckInNarrative = () => {
    const parts = [`Mood: ${mood}`];
    for (const q of DAILY_QUESTIONS) {
      const value = answers[q.id];
      if (value) {
        parts.push(`${q.title} ${value}.`);
      }
    }
    if (reflection.trim()) {
      parts.push(`Reflection: ${reflection.trim()}`);
    }
    return parts.join(' ');
  };

  const computeSessionScore = (analysisResult) => {
    if (analysisResult?.wellness_score != null) {
      const parsed = parseFloat(String(analysisResult.wellness_score).trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    const stress = analysisResult?.stress_score ?? 0.5;
    const moodScore = analysisResult?.mood_score ?? 0.5;
    return Math.round(((1 - stress) * 0.45 + moodScore * 0.55) * 100);
  };

  const buildScoreReasons = (analysisResult) => {
    const reasons = [];
    const stress = Math.round((analysisResult?.stress_score ?? 0) * 100);
    const moodScore = Math.round((analysisResult?.mood_score ?? 0) * 100);

    reasons.push(`Mood contribution: ${moodScore}%`);
    reasons.push(`Stress impact: ${stress}% (higher stress lowers score)`);

    if (analysisResult?.text_emotion) {
      reasons.push(`Text emotion detected: ${analysisResult.text_emotion}`);
    }
    if (analysisResult?.audio_emotion) {
      reasons.push(`Voice cue detected: ${analysisResult.audio_emotion}`);
    }
    if (analysisResult?.video_emotion) {
      reasons.push(`Face cue detected: ${analysisResult.video_emotion}`);
    }

    return reasons;
  };

  const deriveRiskLevel = (analysisResult) => {
    const stress = analysisResult?.stress_score ?? 0.5;
    if (stress >= 0.7) return 'high';
    if (stress >= 0.4) return 'moderate';
    return 'low';
  };

  const startAudioRecording = async () => {
    if (!hasAudioPerm) {
      setErrorMsg('Microphone permission is needed to record audio.');
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
      setRecordingDuration(0);
      setAudioUri(null);
      timerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
    } catch (err) {
      setErrorMsg('Could not start recording. Please try again.');
    }
  };

  const stopAudioRecording = async () => {
    try {
      if (!audioRecorder) return;
      if (timerRef.current) clearInterval(timerRef.current);
      await audioRecorder.stopAndUnloadAsync();
      const uri = audioRecorder.getURI();
      setAudioRecorder(null);
      setIsRecordingAudio(false);
      if (uri) {
        setAudioUri(uri);
      }
    } catch (err) {
      setIsRecordingAudio(false);
      setErrorMsg('Could not stop recording cleanly. Please try again.');
    }
  };

  const captureFacialExpression = async () => {
    try {
      setErrorMsg('');
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setCapturedPhoto(photo.uri);
      setIsCameraActive(false);
    } catch (err) {
      setErrorMsg('Could not capture photo. Please try again.');
    }
  };

  const handleSubmit = async () => {
    const answeredCount = Object.values(answers).filter(Boolean).length;
    if (answeredCount < 2 && !reflection.trim()) {
      setErrorMsg('Please answer at least 2 questions or add a reflection.');
      return;
    }

    const checkInText = buildCheckInNarrative();
    setErrorMsg('');
    setPhase('submitting');
    setProcessingStage('Creating your check-in session...');

    try {
      await new Promise((r) => setTimeout(r, 250));
      if (audioUri) {
        setProcessingStage('Uploading voice signal...');
      }
      if (capturedPhoto) {
        setProcessingStage('Uploading face signal...');
      }
      setProcessingStage('Running AI analysis...');

      const { result: analysisResult, risk, recommendations: recs, inference } =
        await AssessmentService.performCheckIn(mood, checkInText, {
          audioUri,
          photoUri: capturedPhoto,
        });

      setProcessingStage('Preparing your results...');
      await new Promise((r) => setTimeout(r, 250));

      const mergedResult = {
        ...analysisResult,
        inference_tracking: analysisResult?.inference_tracking || inference?.tracking || null,
      };

      setResult(mergedResult);
      setRiskScore(risk || null);
      setRecommendations(Array.isArray(recs) ? recs : []);
      setPhase('success');
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
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
    setReflection('');
    setAudioUri(null);
    setCapturedPhoto(null);
    setRecordingDuration(0);
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
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Pressable onPress={() => setIsCameraActive(false)} style={styles.closeCameraButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.faceGuideContainer}>
            <View style={styles.faceGuideCircle} />
            <Text style={styles.cameraInstruction}>Align your face and capture clearly</Text>
          </View>
          <View style={styles.cameraFooter}>
            <Pressable onPress={captureFacialExpression} style={styles.shutterButton}>
              <View style={styles.shutterInner} />
            </Pressable>
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
    const formatConfidence = (value) => (value != null ? `${Math.round(value * 100)}%` : 'N/A');
    const riskLevel = riskScore?.final_risk_level || deriveRiskLevel(result);
    const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.low;
    const stressScore = result.stress_score != null ? Math.round(result.stress_score * 100) : '--';
    const moodScore = result.mood_score != null ? Math.round(result.mood_score * 100) : '--';
    const emotion = result.text_emotion || 'Not available';
    const topRec = recommendations[0];
    const sessionScore = computeSessionScore(result);
    const scoreReasons = buildScoreReasons(result);
    const isLowScore = sessionScore < LOW_SCORE_THRESHOLD;
    const modelSource = result?.scoring_source || (result?.inference_tracking?.scoring_source ?? 'unknown');
    const modelName = result?.model_name || (result?.inference_tracking?.model_name ?? 'unknown');
    const dominanceMap = result?.dominant_features || result?.inference_tracking?.dominant_features || {};
    const dominantRows = Object.entries(dominanceMap).map(([scoreKey, meta]) => ({
      scoreKey,
      feature: meta?.dominant_feature || 'N/A',
      share: meta?.dominant_share_pct,
    }));
    const riskMetrics = [
      { label: 'Stress', value: riskScore?.stress_score },
      { label: 'Low Mood', value: riskScore?.low_mood_score },
      { label: 'Burnout', value: riskScore?.burnout_score },
      { label: 'Social Withdrawal', value: riskScore?.social_withdrawal_score },
      { label: 'Crisis', value: riskScore?.crisis_score },
    ];
    const modelCards = [
      {
        title: 'Text-based Analysis',
        emotion: result.text_emotion || 'Not available',
        confidence: formatConfidence(result.text_confidence),
        icon: 'document-text-outline',
      },
      {
        title: 'Audio-based Analysis',
        emotion: result.audio_emotion || 'Not available',
        confidence: formatConfidence(result.audio_confidence),
        icon: 'mic-outline',
      },
      {
        title: 'Video-based Analysis',
        emotion: result.video_emotion || 'Not available',
        confidence: formatConfidence(result.video_confidence),
        icon: 'videocam-outline',
      },
    ];

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
        <Animated.View>
          <View style={[styles.successCircle, { backgroundColor: riskColor + '20' }]}>
            <Ionicons name="checkmark-circle" size={52} color={riskColor} />
          </View>
          <Text style={styles.successTitle}>Analysis Complete</Text>
          <Text style={styles.successSubtitle}>Your wellness score: {sessionScore}</Text>
        </Animated.View>

        <Animated.View>
          <View style={styles.resultCardRow}>
            <Text style={styles.resultLabel}>Risk Level</Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>{riskLevel.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultRow}>
            <View style={styles.resultStat}>
              <Text style={styles.resultStatValue}>{stressScore}%</Text>
              <Text style={styles.resultStatLabel}>Stress</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={styles.resultStatValue}>{moodScore}%</Text>
              <Text style={styles.resultStatLabel}>Mood</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={styles.resultStatValue} numberOfLines={1}>{emotion}</Text>
              <Text style={styles.resultStatLabel}>Emotion</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="layers-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.cardLabel}>Model-based Analysis</Text>
          </View>
          {modelCards.map((item) => (
            <View key={item.title} style={styles.modelRow}>
              <View style={styles.modelIconWrap}>
                <Ionicons name={item.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.modelContent}>
                <Text style={styles.modelTitle}>{item.title}</Text>
                <Text style={styles.modelValue}>{item.emotion}</Text>
                <Text style={styles.modelConfidence}>Confidence: {item.confidence}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="stats-chart-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.cardLabel}>Detailed Risk Scores</Text>
          </View>
          <View style={styles.riskGrid}>
            {riskMetrics.map((metric) => (
              <View key={metric.label} style={styles.riskGridItem}>
                <Text style={styles.riskGridValue}>{metric.value != null ? `${Math.round(metric.value * 100)}%` : '--'}</Text>
                <Text style={styles.riskGridLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="analytics-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.cardLabel}>Why this score</Text>
          </View>
          <Text style={styles.reasonText}>Model: {modelName} ({modelSource})</Text>
          {scoreReasons.map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <View style={styles.bulletPoint} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </Animated.View>

        {dominantRows.length > 0 && (
          <Animated.View>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="git-compare-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Dominant Features by Score</Text>
            </View>
            {dominantRows.map((item) => (
              <View key={item.scoreKey} style={styles.reasonRow}>
                <View style={styles.bulletPoint} />
                <Text style={styles.reasonText}>
                  {item.scoreKey}: {item.feature}
                  {item.share != null ? ` (${item.share}% influence)` : ''}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {topRec && (
          <Animated.View>
            <View style={styles.recCardHeader}>
              <Ionicons name="bulb" size={20} color={colors.primary} />
              <Text style={styles.recCardTitle}>Recommended Action</Text>
            </View>
            <Text style={styles.recCardTitle2}>{topRec.title}</Text>
            <Text style={styles.recCardDesc}>{topRec.description}</Text>
          </Animated.View>
        )}

        {isLowScore && (
          <Animated.View>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={styles.warningTitle}>Immediate precautions</Text>
            </View>
            <Text style={styles.warningText}>1) Reduce workload and prioritize rest today.</Text>
            <Text style={styles.warningText}>2) Reach out to a trusted person if distress rises.</Text>
            <Text style={styles.warningText}>3) If you feel unsafe, contact emergency or crisis services immediately.</Text>
            <Text style={styles.warningText}>Medication guidance: do not start, stop, or change medications without a licensed doctor.</Text>
          </Animated.View>
        )}

        <Animated.View>
          <Text style={styles.disclaimerTitle}>AI Disclaimer</Text>
          <Text style={styles.disclaimerText}>
            This is AI-based wellness support and not a final medical diagnosis. Consult a qualified doctor or mental health professional for clinical decisions.
          </Text>
        </Animated.View>

        <Animated.View>
          <Pressable onPress={handleReset} style={styles.doneButton}>
            <LinearGradient
              colors={[colors.primary, '#7C3AED']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.doneGradient}
            >
              <Text style={styles.doneButtonText}>New Check-in</Text>
              <Ionicons name="checkmark" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View>
            <SectionHeader
              title="Daily Check-in"
              showBack
              onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
            />
            <Text style={styles.subHeader}>Track your mental wellbeing with text + optional voice and face signals</Text>
          </Animated.View>

          <ErrorBox message={errorMsg} onDismiss={() => setErrorMsg('')} />

          <Animated.View>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="happy-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>How are you feeling?</Text>
            </View>
            <View style={styles.chipRow}>
              {moods.map((item) => {
                const isActive = mood === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setMood(item)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Today's Insight Questions</Text>
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
          </Animated.View>

          <Animated.View>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="mic-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Voice and Face Analysis (Optional)</Text>
            </View>

            <Text style={styles.mediaHint}>For better reliability, record a live voice sample and capture a clear selfie in real-time.</Text>
            <Text style={styles.mediaHint}>Anti-spoof recommendation: random phrase prompts plus blink/head-turn liveness checks.</Text>

            <View style={styles.mediaRow}>
              <Pressable
                onPress={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                style={[styles.mediaAction, isRecordingAudio && styles.mediaActionStop]}
              >
                <Ionicons name={isRecordingAudio ? 'stop' : 'mic'} size={18} color="#fff" />
                <Text style={styles.mediaActionText}>
                  {isRecordingAudio ? 'Stop Voice' : audioUri ? 'Re-record Voice' : 'Record Voice'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setIsCameraActive(true)}
                style={[styles.mediaAction, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.mediaActionText}>{capturedPhoto ? 'Retake Photo' : 'Capture Photo'}</Text>
              </Pressable>
            </View>

            {isRecordingAudio && (
              <View style={styles.recordingState}>
                <PulsingDot />
                <Text style={styles.recordingText}>Recording: {formatTime(recordingDuration)}</Text>
              </View>
            )}

            <Text style={styles.mediaStatus}>
              Voice: {audioUri ? 'Attached' : 'Not attached'} | Face: {capturedPhoto ? 'Attached' : 'Not attached'}
            </Text>
          </Animated.View>

          <Animated.View>
            <View style={styles.cardHeaderRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardLabel}>Optional Reflection</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="Anything important from today?"
                placeholderTextColor={colors.textSecondary}
                value={reflection}
                onChangeText={(text) => {
                  setReflection(text);
                  if (errorMsg) setErrorMsg('');
                }}
                style={styles.input}
                multiline
                textAlignVertical="top"
              />
            </View>
          </Animated.View>

          <Animated.View>
            <Text style={styles.disclaimerTitle}>AI Disclaimer</Text>
            <Text style={styles.disclaimerText}>
              This is AI-based support and not a final clinical diagnosis. Always consult a doctor for medical advice.
            </Text>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View>
        <Pressable onPress={handleSubmit} style={styles.primaryButton} disabled={isRecordingAudio}>
          <Text style={styles.primaryButtonText}>Save and Analyze</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: responsiveSize.lg, paddingBottom: responsiveSize.xxl },
  headerContainer: { marginBottom: responsiveSize.lg },
  subHeader: { fontSize: fontSize.body, color: colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: responsiveSize.lg,
    marginBottom: responsiveSize.lg,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSize.md },
  iconContainer: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  cardLabel: { fontSize: fontSize.h6, color: colors.textPrimary, fontWeight: '700' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 30,
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff',
    marginRight: 8, marginBottom: 8,
  },
  chipActive: {
    borderColor: colors.primary, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 2,
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
  questionTitle: { marginLeft: 8, fontSize: fontSize.body, color: colors.textPrimary, fontWeight: '600' },

  mediaHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, lineHeight: 18 },
  mediaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
  mediaActionStop: { backgroundColor: colors.danger },
  mediaActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  recordingState: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  pulseDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.danger, marginRight: 8,
  },
  recordingText: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  mediaStatus: { marginTop: 10, fontSize: 12, color: colors.textSecondary },

  inputWrapper: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 4 },
  input: { minHeight: 100, padding: responsiveSize.md, color: colors.textPrimary, fontSize: fontSize.body, textAlignVertical: 'top' },

  footerContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: responsiveSize.lg,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 10,
  },
  primaryButton: {
    backgroundColor: colors.primary, paddingVertical: 16,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  primaryButtonText: { fontSize: fontSize.h6, color: '#fff', fontWeight: '700' },

  fullscreenContainer: {
    flex: 1, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  processingCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  processingTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12 },
  processingStage: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  retryButton: { marginTop: 32, backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  retryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 16 },

  resultContent: { padding: responsiveSize.lg },
  successHeader: { alignItems: 'center', marginBottom: 32, marginTop: 24 },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  successSubtitle: { fontSize: fontSize.body, color: colors.textSecondary, marginTop: 4 },

  resultCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  resultCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultLabel: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  riskBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  resultDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resultStat: { alignItems: 'center' },
  resultStatValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  resultStatLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bulletPoint: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.primary, marginTop: 8, marginRight: 10, opacity: 0.7,
  },
  reasonText: { flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 20 },

  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  modelIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modelContent: { flex: 1 },
  modelTitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  modelValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '700', textTransform: 'capitalize' },
  modelConfidence: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },

  riskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 4,
  },
  riskGridItem: {
    width: '50%',
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  riskGridValue: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  riskGridLabel: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 11,
    color: colors.textSecondary,
  },

  recCard: {
    backgroundColor: colors.primaryTint, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.primary + '30', marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: colors.primary,
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

  disclaimerCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  disclaimerTitle: { fontSize: 13, fontWeight: '800', color: '#9A3412', marginBottom: 6 },
  disclaimerText: { fontSize: 13, color: '#9A3412', lineHeight: 20 },

  resultButtons: { gap: 12 },
  doneButton: { borderRadius: 16, overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  doneGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Camera
  fullScreenCamera: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'space-between', paddingVertical: 40,
  },
  cameraHeader: { alignItems: 'flex-end', paddingHorizontal: 20 },
  closeCameraButton: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  faceGuideContainer: { alignItems: 'center', justifyContent: 'center' },
  faceGuideCircle: {
    width: 250, height: 320, borderRadius: 125,
    borderWidth: 2, borderColor: '#fff', backgroundColor: 'transparent', borderStyle: 'dashed',
  },
  cameraInstruction: {
    color: '#fff', marginTop: 16, fontSize: 16, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  cameraFooter: { alignItems: 'center', marginBottom: 20 },
  shutterButton: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#000', backgroundColor: '#fff' },

  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  permissionText: { color: '#fff', marginBottom: 20, fontSize: 16 },
  permissionButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  permissionButtonText: { color: '#fff', fontWeight: '600' },
});
