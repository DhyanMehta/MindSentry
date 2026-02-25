import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import Animated, { FadeIn, SlideInDown, ZoomIn, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { responsiveSize, fontSize, borderRadius } from '../utils/responsive';
import { SectionHeader } from '../components/SectionHeader';

// Pulsing recording dot component
const PulsingDot = () => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.3, { duration: 500 })
      ),
      -1,
      true
    ),
    transform: [{ scale: withRepeat(withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })), -1, true) }]
  }));

  return <Animated.View style={[styles.pulseDot, animatedStyle]} />;
};

export const CaptureScreen = ({ navigation }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState(null);
  
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  
  const [audioRecorder, setAudioRecorder] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  
  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  // Request audio permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setAudioPermission(status === 'granted');
    })();
  }, []);

  // Timer cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  const stopAudioRecording = async () => {
    try {
      if (!audioRecorder) return;
      if (timerRef.current) clearInterval(timerRef.current);

      await audioRecorder.stopAndUnloadAsync();
      const uri = audioRecorder.getURI();

      setAudioRecorder(null); // Keep it null but maybe store URI in state if needed for playback
      setIsRecordingAudio(false);
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  };

  const captureFacialExpression = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      setCapturedPhoto(photo.uri);
      setIsCameraActive(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  const handleMultiModalCapture = async () => {
    setIsProcessing(true);
    setProcessingStage('Analyzing Audio...');
    
    // Simulate Processing Steps
    setTimeout(() => setProcessingStage('Detecting Micro-expressions...'), 1500);
    setTimeout(() => setProcessingStage('Generating Insights...'), 3000);
    
    setTimeout(() => {
      setIsProcessing(false);
      Alert.alert('Analysis Complete', 'Your multi-modal data has been analyzed successfully!');
      navigation.goBack();
    }, 4500);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- PROCESSING VIEW ---
  if (isProcessing) {
    return (
      <View style={styles.processingContainer}>
        <Animated.View entering={ZoomIn} style={styles.processingCircle}>
           <Ionicons name="sparkles" size={48} color="#fff" />
        </Animated.View>
        <Text style={styles.processingTitle}>Processing Data</Text>
        <Text style={styles.processingSubtitle}>{processingStage}</Text>
        <ActivityBar />
      </View>
    );
  }

  // --- CAMERA VIEW ---
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
        <CameraView ref={cameraRef} style={styles.camera} facing="front">
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
        </CameraView>
      </View>
    );
  }

  // --- MAIN SCREEN ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Animated.View entering={SlideInDown.duration(600).delay(100)} style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
           <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <SectionHeader title="Multi-Modal Capture" />
      </Animated.View>

      <Text style={styles.pageDescription}>
        Enhance your mental wellness analysis by providing voice and facial cues.
      </Text>

      {/* Voice Section */}
      <Animated.View entering={SlideInDown.duration(600).delay(200)} style={styles.card}>
        <View style={styles.cardHeader}>
             <View style={[styles.iconBox, { backgroundColor: colors.secondary + '15' }]}>
                <Ionicons name="mic" size={22} color={colors.secondary} />
             </View>
             <Text style={styles.cardTitle}>Voice Analysis</Text>
        </View>

        <View style={styles.voiceContainer}>
            {isRecordingAudio ? (
                <View style={styles.recordingState}>
                    <PulsingDot />
                    <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
                    <Text style={styles.recordingStatus}>Recording in progress...</Text>
                </View>
            ) : (
                <Text style={styles.placeholderText}>
                    Record a 30s clip describing your day. We analyze tone, pace, and sentiment.
                </Text>
            )}

            <Pressable 
                onPress={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                style={[styles.actionButton, isRecordingAudio && styles.stopButton]}
            >
                <Ionicons name={isRecordingAudio ? "stop" : "mic"} size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                    {isRecordingAudio ? 'Stop Recording' : 'Start Recording'}
                </Text>
            </Pressable>
        </View>
      </Animated.View>

      {/* Camera Section */}
      <Animated.View entering={SlideInDown.duration(600).delay(300)} style={styles.card}>
        <View style={styles.cardHeader}>
             <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="camera" size={22} color={colors.primary} />
             </View>
             <Text style={styles.cardTitle}>Facial Expression</Text>
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

      {/* Submit Button */}
      <Animated.View entering={SlideInDown.duration(600).delay(400)} style={styles.footer}>
         <Pressable 
            onPress={handleMultiModalCapture}
            style={[
                styles.submitButton, 
                (isRecordingAudio || (!capturedPhoto && !audioRecorder)) && styles.disabledButton
            ]}
            disabled={isRecordingAudio || (!capturedPhoto && !audioRecorder)}
         >
            <Text style={styles.submitButtonText}>Analyze Wellness Data</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
         </Pressable>
      </Animated.View>

      <View style={{height: 40}} />
    </ScrollView>
  );
};

// Simple loading bar component
const ActivityBar = () => (
    <View style={styles.activityBarContainer}>
        <Animated.View 
            style={styles.activityBarFill} 
            entering={SlideInDown.duration(2000)}
        />
    </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: responsiveSize.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSize.md,
  },
  backButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageDescription: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginBottom: responsiveSize.xl,
    lineHeight: 22,
  },
  
  // --- Cards ---
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: responsiveSize.lg,
    marginBottom: responsiveSize.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSize.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  voiceContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  placeholderText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  
  // --- Recording UI ---
  recordingState: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    marginBottom: 12,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  recordingStatus: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },

  // --- Buttons ---
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // --- Camera Styles ---
  cameraPreviewContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  fullScreenCamera: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  cameraHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  closeCameraButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  faceGuideContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuideCircle: {
    width: 250,
    height: 320,
    borderRadius: 125, // Oval shape
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  cameraInstruction: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraFooter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  photoSuccess: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photoSuccessText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  retakeText: {
    color: colors.primary,
    marginTop: 8,
    fontWeight: '600',
  },

  // --- Processing Screen ---
  processingContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  processingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 32,
    textAlign: 'center',
  },
  activityBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  activityBarFill: {
    width: '60%', // Static for demo, animate width in real app
    height: '100%',
    backgroundColor: '#fff',
  },

  // --- Permissions ---
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    marginBottom: 20,
    fontSize: 16,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});