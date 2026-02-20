import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import Animated, { FadeIn, SlideInDown, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { SectionHeader } from '../components/SectionHeader';
import { ApiService } from '../services/api';

export const CaptureScreen = ({ navigation }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState(null);
  
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  
  const [audioRecorder, setAudioRecorder] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  // Request audio permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setAudioPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required to record voice.');
      }
    })();
  }, []);

  // Request camera permission if not granted
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start audio recording
  const startAudioRecording = async () => {
    try {
      if (!audioPermission) {
        Alert.alert('Permission Denied', 'Microphone permission is required.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recorder = new Audio.Recording();
      await recorder.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recorder.startAsync();
      setAudioRecorder(recorder);
      setIsRecordingAudio(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop audio recording
  const stopAudioRecording = async () => {
    try {
      if (!audioRecorder) return;

      if (timerRef.current) clearInterval(timerRef.current);

      await audioRecorder.stopAndUnloadAsync();
      const uri = audioRecorder.getURI();

      setAudioRecorder(null);
      setIsRecordingAudio(false);

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
      return null;
    }
  };

  // Capture facial expression from camera
  const captureFacialExpression = async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert('Error', 'Camera is not ready.');
        return null;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      return photo.uri;
    } catch (error) {
      console.error('Failed to capture photo:', error);
      Alert.alert('Error', 'Failed to capture facial expression.');
      return null;
    }
  };

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle multi-modal capture and processing
  const handleMultiModalCapture = async () => {
    setIsProcessing(true);

    try {
      // Step 1: Finalize audio recording
      setProcessingStage('Finalizing audio...');
      const audioUri = await stopAudioRecording();

      // Step 2: Capture facial expression
      setProcessingStage('Capturing facial expression...');
      const faceUri = await captureFacialExpression();

      // Step 3: Send to backend for AI analysis
      setProcessingStage('Analyzing with AI models...');
      const payload = {
        audio_uri: audioUri,
        face_uri: faceUri,
        timestamp: new Date().toISOString(),
      };

      // Mock API call - replace with real backend endpoint
      await new Promise((resolve) => setTimeout(resolve, 2500));
      // const response = await ApiService.submitMultiModalData(payload);

      setProcessingStage('Complete!');
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Alert.alert('Success', 'Multi-modal data captured and sent for analysis!');
      setIsProcessing(false);
      setIsCameraActive(false);

      // Navigate back or to insights
      navigation.goBack();
    } catch (error) {
      console.error('Error during capture:', error);
      Alert.alert('Error', 'Failed to process multi-modal data.');
      setIsProcessing(false);
    }
  };

  // If processing, show processing screen
  if (isProcessing) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn} style={styles.processingContainer}>
          <Animated.View entering={FadeIn.delay(300)}>
            <Ionicons name="hourglass-outline" size={64} color={colors.primary} style={styles.processingIcon} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(600)}>
            <Text style={styles.processingTitle}>Processing...</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(900)}>
            <Text style={styles.processingStage}>{processingStage}</Text>
          </Animated.View>

          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: processingStage.includes('Complete') ? '100%' : '60%',
                },
              ]}
            />
          </View>

          <Text style={styles.processingSubtitle}>AI models are analyzing your text, voice, and facial cues...</Text>
        </Animated.View>
      </View>
    );
  }

  // If camera is active, show camera view
  if (isCameraActive) {
    const isCameraPermissionGranted = cameraPermission?.granted;

    return (
      <View style={styles.container}>
        {isCameraPermissionGranted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="front">
            <View style={styles.cameraHeader}>
              <Pressable onPress={() => setIsCameraActive(false)} style={styles.closeButton}>
                <Ionicons name="close" size={32} color={colors.textPrimary} />
              </Pressable>
              <Text style={styles.cameraTitle}>Capture your face</Text>
              <View style={{ width: 32 }} />
            </View>

            <View style={styles.cameraOverlay}>
              <View style={styles.faceMask} />
            </View>

            <View style={styles.cameraFooter}>
              <Text style={styles.cameraInstruction}>Position your face in the circle</Text>
              {isRecordingAudio && (
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording... {formatTime(recordingDuration)}</Text>
                </View>
              )}
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-off" size={64} color={colors.danger} />
            <Text style={styles.permissionText}>Camera Permission Required</Text>
            <Text style={styles.permissionSubtext}>Please enable camera access to capture facial expressions.</Text>
            <Pressable
              onPress={requestCameraPermission}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>Request Permission</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // Main capture screen
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={SlideInDown.duration(600).delay(100)}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </Pressable>
          <SectionHeader title="Multi-Modal Capture" />
        </View>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(600).delay(200)}>
        <Text style={styles.subtitle}>
          Provide voice and facial data for enhanced AI analysis of your emotional well-being.
        </Text>
      </Animated.View>

      {/* Voice Recording Section */}
      <Animated.View entering={SlideInDown.duration(600).delay(300)}>
        <View style={styles.card}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="mic" size={24} color={colors.secondary} />
            <Text style={styles.sectionTitle}>Voice Recording</Text>
          </View>

          {isRecordingAudio ? (
            <View style={styles.recordingContent}>
              <View style={styles.recordingPulse}>
                <View style={styles.pulseDot} />
              </View>
              <Text style={styles.recordingDurationText}>{formatTime(recordingDuration)}</Text>
              <Text style={styles.recordingLabel}>Recording your voice...</Text>
            </View>
          ) : (
            <Text style={styles.cardDescription}>
              Record a 30-60 second voice sample. Speak naturally about how you're feeling.
            </Text>
          )}

          <Pressable
            onPress={isRecordingAudio ? stopAudioRecording : startAudioRecording}
            style={[
              styles.captureButton,
              isRecordingAudio ? styles.captureButtonActive : null,
            ]}
          >
            <Ionicons
              name={isRecordingAudio ? 'stop-circle' : 'mic-circle'}
              size={32}
              color={isRecordingAudio ? colors.danger : colors.secondary}
            />
            <Text style={styles.buttonLabel}>
              {isRecordingAudio ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Facial Expression Section */}
      <Animated.View entering={SlideInDown.duration(600).delay(400)}>
        <View style={styles.card}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="camera" size={24} color={colors.accent} />
            <Text style={styles.sectionTitle}>Facial Expression</Text>
          </View>

          <Text style={styles.cardDescription}>
            Capture a clear photo of your face for emotion detection and micro-expression analysis.
          </Text>

          <Pressable
            onPress={() => setIsCameraActive(true)}
            style={styles.captureButton}
          >
            <Ionicons name="camera" size={32} color={colors.accent} />
            <Text style={styles.buttonLabel}>Capture Photo</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Submit Section */}
      <Animated.View entering={SlideInDown.duration(600).delay(500)}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <Text style={styles.infoText}>
            Both voice and facial data will be analyzed using AI models to assess your emotional state, stress levels, and provide personalized wellness recommendations.
          </Text>
        </View>

        <Pressable
          onPress={handleMultiModalCapture}
          style={[
            styles.submitButton,
            (!isRecordingAudio) ? styles.submitButtonDisabled : null,
          ]}
          disabled={isRecordingAudio || !audioRecorder}
        >
          <Text style={styles.submitButtonText}>
            {isRecordingAudio ? 'Complete Recording First' : 'Analyze Data'}
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primaryTint,
    borderRadius: 18,
    padding: 22,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.primary,
    marginLeft: 14,
    fontSize: 18,
    fontWeight: '800',
  },
  cardDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 21,
    fontSize: 15,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  captureButtonActive: {
    backgroundColor: colors.dangerTint,
    borderColor: colors.danger,
  },
  buttonLabel: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '800',
    marginLeft: 12,
    fontSize: 16,
  },
  recordingContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordingPulse: {
    marginBottom: 14,
  },
  pulseDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    opacity: 0.95,
  },
  recordingDurationText: {
    ...typography.heading,
    color: colors.primary,
    fontSize: 32,
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  recordingLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  cameraTitle: {
    ...typography.heading,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceMask: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    borderColor: colors.primary,
    opacity: 0.6,
  },
  cameraFooter: {
    paddingHorizontal: 16,
    paddingVertical: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cameraInstruction: {
    ...typography.body,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginRight: 10,
    opacity: 0.9,
  },
  recordingText: {
    ...typography.small,
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  permissionText: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
  },
  permissionSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    fontSize: 15,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryTint,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 14,
    padding: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  infoText: {
    ...typography.small,
    color: colors.textSecondary,
    marginLeft: 14,
    flex: 1,
    lineHeight: 21,
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 0,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  processingIcon: {
    marginBottom: 32,
  },
  processingTitle: {
    ...typography.heading,
    color: colors.primary,
    fontSize: 36,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '900',
  },
  processingStage: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '800',
    fontSize: 16,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.primaryTint,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  processingSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
});
