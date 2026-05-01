import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { colors } from '../theme/colors';
import ChatAgentService from '../services/chatAgentService';
import { ErrorBox } from '../components/ErrorBox';

// ─── Initial welcome message ──────────────────────────────────────────────
const WELCOME_MESSAGE = {
  id: 'welcome',
  text: "Hello! I'm ArogyaAI — your mental health wellness companion. I can help you understand your check-in results, find nearby clinics, or simply chat. How are you feeling today?",
  sender: 'assistant',
  timestamp: new Date().toISOString(),
};

// ─── Main Screen ──────────────────────────────────────────────────────────
export const CounselorChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationRequested, setLocationRequested] = useState(false);

  const flatListRef = useRef(null);

  // Handle initial prompt from navigation params
  useEffect(() => {
    const { initialPrompt } = route.params || {};
    if (initialPrompt && typeof initialPrompt === 'string') {
      // Auto-send the initial prompt after a brief delay
      setTimeout(() => {
        setInputText(initialPrompt);
        // Let the user see it and send manually — feels more natural
      }, 300);
    }
  }, [route.params]);

  // Auto-scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  // ── Location handling ────────────────────────────────────────────────
  const requestLocation = useCallback(async () => {
    if (userLocation || locationRequested) return userLocation;
    setLocationRequested(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setChatError('Location permission denied. Enable it in settings to search for clinics.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      return coords;
    } catch (err) {
      console.log('[Chat] Location error:', err.message);
      return null;
    }
  }, [userLocation, locationRequested]);

  // ── Send message ─────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    // Add user bubble
    const userMsg = {
      id: `user_${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    setChatError('');

    try {
      // Request location if the message mentions clinics/doctors
      let location = userLocation;
      const lowerText = text.toLowerCase();
      if (
        !location &&
        (lowerText.includes('clinic') || lowerText.includes('doctor') ||
          lowerText.includes('hospital') || lowerText.includes('therapist') ||
          lowerText.includes('nearby'))
      ) {
        location = await requestLocation();
      }

      // Call the chatbot API
      const response = await ChatAgentService.sendChatMessage(text, {
        sessionId,
        source: 'chat_screen',
        location,
      });

      // Track session ID for multi-turn
      if (response?.session_id) {
        setSessionId(response.session_id);
      }

      // Build assistant message
      const assistantMsg = {
        id: `bot_${Date.now()}`,
        text: response?.response || "I couldn't generate a response. Please try again.",
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        intent: response?.intent,
        distressLevel: response?.distress_level,
        uiPayload: response?.ui_payload || [],
        sessionId: response?.session_id,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Handle special ui_payload items
      if (Array.isArray(response?.ui_payload)) {
        for (const payload of response.ui_payload) {
          if (payload?.type === 'location_request' && !userLocation) {
            const loc = await requestLocation();
            if (loc) {
              // Re-send with location
              const retryResponse = await ChatAgentService.sendChatMessage(
                'Yes, here is my location. Please search for clinics near me.',
                { sessionId: response.session_id, source: 'chat_screen', location: loc }
              );
              if (retryResponse?.response) {
                const retryMsg = {
                  id: `bot_retry_${Date.now()}`,
                  text: retryResponse.response,
                  sender: 'assistant',
                  timestamp: new Date().toISOString(),
                  uiPayload: retryResponse?.ui_payload || [],
                  sessionId: retryResponse?.session_id,
                };
                setMessages(prev => [...prev, retryMsg]);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[Chat] API error:', err);
      setChatError(err?.message || 'Could not reach ArogyaAI right now.');
      const errorMsg = {
        id: `err_${Date.now()}`,
        text: "I'm having trouble connecting right now. Please check your connection and try again.",
        sender: 'assistant',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── UI payload action handlers ───────────────────────────────────────
  const handleCallPhone = async (phoneNumber) => {
    const url = `tel:${phoneNumber.replace(/\D/g, '')}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Cannot call', `Cannot place a call on this device. Number: ${phoneNumber}`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Call failed', `Please call ${phoneNumber} manually.`);
    }
  };

  const handleBookAppointment = async (clinic) => {
    Alert.prompt
      ? Alert.prompt(
        'Book Appointment',
        `Enter preferred date/time for ${clinic.name}\n(Format: YYYY-MM-DD HH:MM)`,
        async (dateTime) => {
          if (!dateTime) return;
          const msg = `Book an appointment at ${clinic.name} (ID: ${clinic.clinic_id || clinic.id}) for ${dateTime}`;
          setInputText(msg);
        }
      )
      : navigation.navigate('ClinicFinder');
  };

  const handleApprovalDecision = async (payload, approved) => {
    const activeSessionId = sessionId;
    if (!activeSessionId || !payload?.action_id) {
      setChatError('This approval cannot be submitted right now.');
      return;
    }

    setIsTyping(true);
    setChatError('');

    try {
      const response = await ChatAgentService.submitApproval(
        activeSessionId,
        payload.action_id,
        approved,
        approved ? 'Yes, please continue with that action.' : 'No, please do not continue with that action.'
      );

      if (response?.session_id) {
        setSessionId(response.session_id);
      }

      const approvalMsg = {
        id: `approval_${Date.now()}`,
        text: response?.response || (approved ? 'Action approved.' : 'Action denied.'),
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        intent: response?.intent,
        distressLevel: response?.distress_level,
        uiPayload: response?.ui_payload || [],
        sessionId: response?.session_id || activeSessionId,
      };
      setMessages(prev => [...prev, approvalMsg]);
    } catch (err) {
      console.error('[Chat] Approval error:', err);
      setChatError(err?.message || 'Could not submit approval right now.');
    } finally {
      setIsTyping(false);
    }
  };

  // ── Render functions ─────────────────────────────────────────────────
  const renderClinicCards = (clinics) => {
    if (!clinics?.length) return null;
    return (
      <View style={styles.clinicCardsContainer}>
        <Text style={styles.clinicCardsTitle}>{clinics.length} clinics found nearby</Text>
        {clinics.slice(0, 5).map((clinic, idx) => (
          <View key={clinic.clinic_id || clinic.id || idx} style={styles.clinicCard}>
            <View style={styles.clinicInfo}>
              <Text style={styles.clinicName}>{clinic.name}</Text>
              <Text style={styles.clinicAddress}>{clinic.address}</Text>
              {clinic.distance_km != null && (
                <View style={styles.distanceBadge}>
                  <Ionicons name="location-outline" size={11} color={colors.primary} />
                  <Text style={styles.distanceText}>{Number(clinic.distance_km).toFixed(1)} km</Text>
                </View>
              )}
            </View>
            <View style={styles.clinicActions}>
              {clinic.phone && (
                <Pressable
                  onPress={() => handleCallPhone(clinic.phone)}
                  style={styles.clinicActionBtn}
                >
                  <Ionicons name="call-outline" size={15} color={colors.primary} />
                  <Text style={styles.clinicActionText}>Call</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => handleBookAppointment(clinic)}
                style={[styles.clinicActionBtn, styles.clinicBookBtn]}
              >
                <Ionicons name="calendar-outline" size={15} color="#fff" />
                <Text style={[styles.clinicActionText, { color: '#fff' }]}>Book</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderEmergencyButton = (payload) => {
    if (!payload?.phone_number) return null;
    return (
      <View style={styles.emergencyCard}>
        <View style={styles.emergencyHeader}>
          <Ionicons name="warning-outline" size={20} color="#DC2626" />
          <Text style={styles.emergencyTitle}>{payload.service_name || 'Emergency Services'}</Text>
        </View>
        <Pressable
          onPress={() => handleCallPhone(payload.phone_number)}
          style={styles.emergencyCallBtn}
        >
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.emergencyCallText}>Call {payload.phone_number}</Text>
        </Pressable>
        {payload.alternative_number ? (
          <Text style={styles.emergencyAlt}>
            Alternative: {payload.alternative_number}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderUiPayloads = (uiPayload) => {
    if (!Array.isArray(uiPayload) || uiPayload.length === 0) return null;
    return uiPayload.map((payload, idx) => {
      switch (payload?.type) {
        case 'clinic_cards':
          return <View key={`clinic_${idx}`}>{renderClinicCards(payload.clinics)}</View>;
        case 'approval_prompt':
          return (
            <View key={`approval_${idx}`} style={styles.approvalCard}>
              <View style={styles.approvalHeader}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                <Text style={styles.approvalTitle}>{payload.action || 'Approval needed'}</Text>
              </View>
              {payload.reason ? <Text style={styles.approvalReason}>{payload.reason}</Text> : null}
              <View style={styles.approvalActions}>
                <Pressable
                  onPress={() => handleApprovalDecision(payload, false)}
                  style={[styles.approvalButton, styles.approvalDenyButton]}
                >
                  <Text style={styles.approvalDenyText}>Deny</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleApprovalDecision(payload, true)}
                  style={[styles.approvalButton, styles.approvalApproveButton]}
                >
                  <Text style={styles.approvalApproveText}>Approve</Text>
                </Pressable>
              </View>
            </View>
          );
        case 'emergency_call':
          return <View key={`emergency_${idx}`}>{renderEmergencyButton(payload)}</View>;
        case 'safety_escalation':
          return (
            <View key={`safety_${idx}`} style={styles.safetyCard}>
              <Text style={styles.safetyText}>{payload.message}</Text>
              {payload.crisis_resources?.map((res, i) => (
                <Text key={i} style={styles.safetyResource}>• {res}</Text>
              ))}
            </View>
          );
        default:
          return null;
      }
    });
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    return (
      <Animated.View
        entering={FadeIn.duration(250)}
        style={[styles.messageBubble, isUser ? styles.userBubble : styles.systemBubble]}
      >
        {!isUser && (
          <View style={styles.botIcon}>
            <Ionicons name="chatbubbles" size={14} color="#fff" />
          </View>
        )}
        <Text style={[styles.messageText, isUser ? styles.userText : styles.systemText]}>
          {item.text}
        </Text>
        {!isUser && item.intent && (
          <View style={styles.intentTag}>
            <Text style={styles.intentTagText}>{item.intent.replace('_', ' ')}</Text>
          </View>
        )}
        {!isUser && renderUiPayloads(item.uiPayload)}
      </Animated.View>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>ArogyaAI</Text>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, isTyping && { backgroundColor: colors.warning || '#F59E0B' }]} />
            <Text style={styles.statusText}>{isTyping ? 'Thinking...' : 'Online'}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.errorWrapper}>
        <ErrorBox message={chatError} onDismiss={() => setChatError('')} />
      </View>

      {/* Chat Area */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          isTyping ? (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.typingContainer}>
              <View style={styles.botIcon}>
                <Ionicons name="chatbubbles" size={14} color="#fff" />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.typingText}> Thinking...</Text>
              </View>
            </Animated.View>
          ) : null
        }
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            editable={!isTyping}
          />
          <Pressable
            onPress={handleSend}
            style={[styles.sendButton, (!inputText.trim() || isTyping) && styles.sendButtonDisabled]}
            disabled={!inputText.trim() || isTyping}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#fff',
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 4 },
  statusText: { fontSize: 12, color: colors.textSecondary },

  chatContent: { paddingHorizontal: 16, paddingVertical: 20, gap: 16, paddingBottom: 40 },
  errorWrapper: { paddingHorizontal: 16, paddingTop: 10 },

  messageBubble: { maxWidth: '85%', padding: 16, borderRadius: 20, marginBottom: 4 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  systemBubble: {
    alignSelf: 'flex-start', backgroundColor: '#fff',
    borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0', marginLeft: 36,
  },
  botIcon: {
    position: 'absolute', left: -36, bottom: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center',
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  systemText: { color: colors.textPrimary },

  intentTag: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  intentTagText: { fontSize: 10, color: colors.primary, fontWeight: '700', textTransform: 'capitalize' },

  // ── Clinic cards ─────────────────────────────────────────────────
  clinicCardsContainer: { marginTop: 12 },
  clinicCardsTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  clinicCard: {
    backgroundColor: '#F1F5F9', borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  clinicInfo: { marginBottom: 8 },
  clinicName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  clinicAddress: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  distanceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '12', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  distanceText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  clinicActions: { flexDirection: 'row', gap: 8 },
  clinicActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  clinicBookBtn: { backgroundColor: colors.primary, borderColor: colors.primary },
  clinicActionText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // ── Emergency ────────────────────────────────────────────────────
  emergencyCard: {
    marginTop: 12, backgroundColor: '#FEF2F2',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA',
  },
  emergencyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  emergencyTitle: { fontSize: 14, fontWeight: '800', color: '#991B1B' },
  emergencyCallBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 11,
  },
  emergencyCallText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  emergencyAlt: { marginTop: 8, fontSize: 12, color: '#991B1B' },

  // ── Safety escalation ────────────────────────────────────────────
  safetyCard: {
    marginTop: 10, backgroundColor: '#FEF2F2',
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  safetyText: { fontSize: 13, color: '#7F1D1D', lineHeight: 19, marginBottom: 6 },
  safetyResource: { fontSize: 12, color: '#991B1B', lineHeight: 18, marginLeft: 4 },

  // ── Approval prompt ──────────────────────────────────────────────
  approvalCard: {
    marginTop: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  approvalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  approvalTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  approvalReason: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  approvalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  approvalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  approvalDenyButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#BFDBFE' },
  approvalApproveButton: { backgroundColor: colors.primary },
  approvalDenyText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  approvalApproveText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // ── Typing indicator ─────────────────────────────────────────────
  typingContainer: { marginLeft: 36, marginTop: 8, flexDirection: 'row', alignItems: 'flex-end' },
  typingBubble: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#E2E8F0',
    flexDirection: 'row', alignItems: 'center',
  },
  typingText: { fontSize: 13, color: colors.textSecondary },

  // ── Input area ───────────────────────────────────────────────────
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 12,
    minHeight: 48, maxHeight: 120,
    fontSize: 16, color: colors.textPrimary, marginRight: 12,
  },
  sendButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  sendButtonDisabled: { backgroundColor: '#CBD5E1' },
});
