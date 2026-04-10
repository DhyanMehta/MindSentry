import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import Animated, {
  useAnimatedStyle, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

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

const PROCESS_STAGES = [
  'Getting session ready...',
  'Uploading audio data...',
  'Uploading facial data...',
  'Running AI analysis...',
  'Building insights...',
];

// Pulsing dot animation
const PulsingDot = () => {
  const anim = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(withTiming(1, { duration: 500 }), withTiming(0.3, { duration: 500 })),
      -1, true
    ),
    transform: [{ scale: withRepeat(withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })), -1, true) }],
  }));
  return <Animated.View style={[styles.pulseDot, anim]} />;
};

export const CaptureScreen = ({ navigation, route }) => {
  const activeAssessmentId = route?.params?.assessmentId || null;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasAudioPerm, setHasAudioPerm] = useState(null);

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [screenError, setScreenError] = useState('');

  const [audioRecorder, setAudioRecorder] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState(null);      // stored after stop
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // Results
  const [result, setResult] = useState(null);
  const [riskScore, setRiskScore] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasAudioPerm(status === 'granted');
    })();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Audio Recording ────────────────────────────────────────────────────────
  const startAudioRecording = async () => {
    if (!hasAudioPerm) {
      setScreenError('Microphone permission is needed to record audio.');
      return;
    }
    try {
      setScreenError('');
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
      setScreenError('Could not start recording. Please try again.');
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
      console.error('Stop recording error:', err.message);
      setIsRecordingAudio(false);
      setScreenError('Could not stop recording cleanly. Please try again.');
    }
  };

  // ── Camera Capture ─────────────────────────────────────────────────────────
  const captureFacialExpression = async () => {
    try {
      setScreenError('');
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setCapturedPhoto(photo.uri);
      setIsCameraActive(false);
    } catch (err) {
      setScreenError('Could not capture photo. Please try again.');
    }
  };

  // ── Main Analysis ──────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!audioUri && !capturedPhoto) return;

    setIsProcessing(true);
    setScreenError('');

    try {
      setProcessingStage(PROCESS_STAGES[0]);

      setProcessingStage(PROCESS_STAGES[3]);
      setProcessingStage(PROCESS_STAGES[4]);
      const { result: analysisResult, risk, recommendations: recs } = await AssessmentService.performCapture({
        assessmentId: activeAssessmentId,
        audioUri,
        photoUri: capturedPhoto,
      });

      setResult(analysisResult);
      setRiskScore(risk || null);
      setRecommendations(Array.isArray(recs) ? recs : []);
      setIsProcessing(false);

    } catch (err) {
      console.error('[Capture] Error:', err.message);
      setIsProcessing(false);
      setScreenError(err.message || 'Analysis failed. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const canAnalyze = (audioUri || capturedPhoto) && !isRecordingAudio;

  // ── Processing Screen ──────────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <View style={styles.processingContainer}>
        <Animated.View>
          <Ionicons name="sparkles" size={48} color="#fff" />
        </Animated.View>
        <Text style={styles.processingTitle}>Analyzing Data</Text>
        <Text style={styles.processingSubtitle}>{processingStage}</Text>
        <ActivityIndicator color="rgba(255,255,255,0.8)" size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // ── Results Screen ─────────────────────────────────────────────────────────
  if (result) {
    const formatConfidence = (value) => (value != null ? `${Math.round(value * 100)}%` : 'N/A');
    const riskLevel = riskScore?.final_risk_level || 'low';
    const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.low;
    const stressScore = result.stress_score != null ? Math.round(result.stress_score * 100) : '--';
    const moodScore = result.mood_score != null ? Math.round(result.mood_score * 100) : '--';
    const audioEmotion = result.audio_emotion || 'N/A';
    const videoEmotion = result.video_emotion || 'N/A';
    const textEmotion = result.text_emotion || 'N/A';
    const textConfidence = formatConfidence(result.text_confidence);
    const audioConfidence = formatConfidence(result.audio_confidence);
    const videoConfidence = formatConfidence(result.video_confidence);
    const topRec = recommendations[0];
    const riskMetrics = [
      { label: 'Stress', value: riskScore?.stress_score },
      { label: 'Low Mood', value: riskScore?.low_mood_score },
      { label: 'Burnout', value: riskScore?.burnout_score },
      { label: 'Social Withdrawal', value: riskScore?.social_withdrawal_score },
      { label: 'Crisis', value: riskScore?.crisis_score },
    ];

    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: responsiveSize.lg }}>
        <Animated.View>
          <View style={[styles.resultsCircle, { backgroundColor: riskColor + '20' }]}>
            <Ionicons name="checkmark-circle" size={52} color={riskColor} />
          </View>
          <Text style={styles.resultsTitle}>Capture Complete</Text>
          <Text style={styles.resultsSubtitle}>Multi-modal analysis finished</Text>
        </Animated.View>

        <Animated.View>
          <View style={styles.recCardHeader}>
            <Ionicons name="layers-outline" size={18} color={colors.primary} />
            <Text style={styles.recCardTitle}>Modality Confidence</Text>
          </View>
          <View style={styles.confidenceRow}>
            <View style={styles.confidencePill}><Text style={styles.confidencePillText}>Text: {textConfidence}</Text></View>
            <View style={styles.confidencePill}><Text style={styles.confidencePillText}>Voice: {audioConfidence}</Text></View>
            <View style={styles.confidencePill}><Text style={styles.confidencePillText}>Face: {videoConfidence}</Text></View>
          </View>
        </Animated.View>

        <Animated.View>
          <View style={styles.resultCardTopRow}>
            <Text style={styles.resultCardLabel}>Risk Level</Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>{riskLevel.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{stressScore}%</Text>
              <Text style={styles.statLabel}>Stress</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{moodScore}%</Text>
              <Text style={styles.statLabel}>Mood</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1}>{textEmotion}</Text>
              <Text style={styles.statLabel}>Text</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1}>{audioEmotion}</Text>
              <Text style={styles.statLabel}>Voice</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1}>{videoEmotion}</Text>
              <Text style={styles.statLabel}>Face</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View>
          <View style={styles.recCardHeader}>
            <Ionicons name="stats-chart" size={18} color={colors.primary} />
            <Text style={styles.recCardTitle}>Detailed Risk Scores</Text>
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

        {topRec && (
          <Animated.View>
            <View style={styles.recCardHeader}>
              <Ionicons name="bulb" size={18} color={colors.primary} />
              <Text style={styles.recCardTitle}>Recommendation</Text>
            </View>
            <Text style={styles.recCardTitle2}>{topRec.title}</Text>
            <Text style={styles.recCardDesc}>{topRec.description}</Text>
          </Animated.View>
        )}

        <Animated.View>
          <Pressable onPress={() => navigation.goBack()} style={styles.doneButton}>
            <View style={styles.donePrimary}>
              <Text style={styles.doneText}>Done</Text>
              <Ionicons name="checkmark" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </View>
          </Pressable>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Camera Active ──────────────────────────────────────────────────────────
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
            <Text style={styles.cameraInstruction}>Position your face within the circle</Text>
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

  // ── Main Screen ────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Animated.View>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <SectionHeader title="Multi-Modal Capture" />
      </Animated.View>

      <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />

      <Text style={styles.pageDescription}>
        Enhance your mental wellness analysis by providing voice and facial cues.
      </Text>

      {/* Voice Section */}
      <Animated.View>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: colors.secondary + '15' }]}>
            <Ionicons name="mic" size={22} color={colors.secondary} />
          </View>
          <Text style={styles.cardTitle}>Voice Analysis</Text>
          {audioUri && !isRecordingAudio && (
            <View style={styles.doneTag}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.doneTagText}>Recorded</Text>
            </View>
          )}
        </View>

        <View style={styles.voiceContainer}>
          {isRecordingAudio ? (
            <View style={styles.recordingState}>
              <PulsingDot />
              <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
              <Text style={styles.recordingStatus}>Recording in progress...</Text>
            </View>
          ) : audioUri ? (
            <Text style={styles.successPlaceholder}>
              Audio recorded ({formatTime(recordingDuration)}). Ready to analyze.
            </Text>
          ) : (
            <Text style={styles.placeholderText}>
              Record a 30s clip describing your day. We analyze tone, pace, and sentiment.
            </Text>
          )}

          <Pressable
            onPress={isRecordingAudio ? stopAudioRecording : startAudioRecording}
            style={[styles.actionButton, isRecordingAudio && styles.stopButton]}
          >
            <Ionicons name={isRecordingAudio ? 'stop' : 'mic'} size={20} color="#fff" />
            <Text style={styles.actionButtonText}>
              {isRecordingAudio ? 'Stop Recording' : audioUri ? 'Re-Record' : 'Start Recording'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Camera Section */}
      <Animated.View>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="camera" size={22} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Facial Expression</Text>
          {capturedPhoto && (
            <View style={styles.doneTag}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.doneTagText}>Captured</Text>
            </View>
          )}
        </View>

        <View style={styles.cameraPreviewContainer}>
          {capturedPhoto ? (
            <View style={styles.photoSuccess}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={styles.photoSuccessText}>Photo Captured</Text>
              <Pressable onPress={() => setIsCameraActive(true)}>
                <Text style={styles.retakeText}>Retake Photo</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.placeholderText}>
              Take a quick selfie. Our AI detects micro-expressions to gauge stress levels.
            </Text>
          )}

          {!capturedPhoto && (
            <Pressable
              onPress={() => setIsCameraActive(true)}
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Open Camera</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Submit */}
      <Animated.View>
        <Pressable
          onPress={handleAnalyze}
          style={[styles.submitButton, !canAnalyze && styles.disabledButton]}
          disabled={!canAnalyze}
        >
          <Text style={styles.submitButtonText}>Analyze Wellness Data</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: responsiveSize.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSize.md },
  backButton: {
    marginRight: 12, padding: 8, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  pageDescription: { fontSize: fontSize.body, color: colors.textSecondary, marginBottom: responsiveSize.xl, lineHeight: 22 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: responsiveSize.lg,
    marginBottom: responsiveSize.lg, borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: responsiveSize.md },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneTagText: { fontSize: 12, color: colors.success, fontWeight: '600' },

  voiceContainer: { alignItems: 'center', paddingVertical: 10 },
  placeholderText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  successPlaceholder: { textAlign: 'center', color: colors.success, fontSize: 14, marginBottom: 20, fontWeight: '600' },

  recordingState: { alignItems: 'center', marginBottom: 20 },
  pulseDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.danger, marginBottom: 12,
  },
  timerText: { fontSize: 32, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  recordingStatus: { fontSize: 12, color: colors.danger, marginTop: 4, fontWeight: '600' },

  actionButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 12, gap: 8,
  },
  stopButton: { backgroundColor: colors.danger },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  cameraPreviewContainer: { alignItems: 'center', paddingVertical: 10 },
  photoSuccess: { alignItems: 'center', marginBottom: 16 },
  photoSuccessText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 8 },
  retakeText: { color: colors.primary, marginTop: 8, fontWeight: '600' },

  footer: {},
  submitButton: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  disabledButton: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Camera styles
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

  // Processing
  processingContainer: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: 40 },
  processingCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  processingTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8 },
  processingSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginBottom: 32, textAlign: 'center' },

  // Results
  resultsHeader: { alignItems: 'center', marginBottom: 28, marginTop: 16 },
  resultsCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  resultsTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  resultsSubtitle: { fontSize: fontSize.body, color: colors.textSecondary, marginTop: 4 },
  resultCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  resultCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCardLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  riskBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  resultDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8 },
  stat: { alignItems: 'center', width: '20%' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  confidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  confidencePill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confidencePillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  riskGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginBottom: 12 },
  riskGridItem: { width: '50%', paddingHorizontal: 6, paddingBottom: 10 },
  riskGridValue: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  riskGridLabel: { textAlign: 'center', marginTop: 6, fontSize: 11, color: colors.textSecondary },
  recCard: {
    backgroundColor: colors.primaryTint, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.primary + '30', marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: colors.primary,
  },
  recCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  recCardTitle: { fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  recCardTitle2: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  recCardDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  doneButton: { borderRadius: 16, overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  donePrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: colors.primary },
  doneText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
