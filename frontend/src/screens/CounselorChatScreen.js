import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { ApiService } from '../services/api';
import { AssessmentService } from '../services/assessmentService';
import { ErrorBox } from '../components/ErrorBox';

const INITIAL_MESSAGES = [
  {
    id: '1',
    text: "Hello! I'm AarogyaAI. I analyze your messages using emotion AI to give you real, personalized support. How are you feeling today?",
    sender: 'system',
    timestamp: new Date().toISOString(),
  },
];

// Fallback replies when API is unavailable
const FALLBACK_REPLIES = [
  "I hear you. Can you tell me more about what's been on your mind?",
  "Thank you for sharing that. Your feelings are valid. What do you think is at the root of this?",
  "I appreciate your openness. What would feel most helpful right now — to talk through options, or just to be heard?",
  "That sounds challenging. Remember, it's okay to take things one step at a time. What's one small thing that might help today?",
];

let fallbackIndex = 0;
const getNextFallback = () => FALLBACK_REPLIES[fallbackIndex++ % FALLBACK_REPLIES.length];

export const CounselorChatScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState('');
  const flatListRef = useRef(null);

  const appendMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    // Add user message immediately
    const userMsg = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    appendMessage(userMsg);
    setInputText('');
    setIsTyping(true);
    setChatError('');

    try {
      // Create a fresh assessment for this message
      const assessment = await ApiService.createAssessment('clinician_review', 'AarogyaAI session');

      // Submit the user's message and run analysis
      await ApiService.submitText(assessment.id, text);
      const result = await ApiService.runAnalysis(assessment.id);
      const recommendations = await ApiService.getRecommendations(assessment.id);

      // Build a contextual reply
      const reply = AssessmentService.buildCounselorReply(result, recommendations);

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        text: reply,
        sender: 'system',
        timestamp: new Date().toISOString(),
        emotion: result.text_emotion || null,
        riskLevel: result.final_risk_level || null,
      };
      appendMessage(aiMsg);
    } catch (err) {
      console.log('[Chat] API error:', err.message);
      setChatError(err.message || 'AI service is temporarily unavailable. Showing a fallback response.');
      // Use a sensible fallback reply rather than showing an error
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        text: getNextFallback(),
        sender: 'system',
        timestamp: new Date().toISOString(),
      };
      appendMessage(aiMsg);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    return (
      <Animated.View>
        {!isUser && (
          <View style={styles.botIcon}>
            <Ionicons name="chatbubbles" size={14} color="#fff" />
          </View>
        )}
        <Text style={[styles.messageText, isUser ? styles.userText : styles.systemText]}>
          {item.text}
        </Text>
        {!isUser && item.emotion && (
          <View style={styles.emotionTag}>
            <Text style={styles.emotionTagText}>{item.emotion}</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>AarogyaAI</Text>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, isTyping && { backgroundColor: colors.warning || '#F59E0B' }]} />
            <Text style={styles.statusText}>{isTyping ? 'Analyzing...' : 'Online'}</Text>
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
            <View style={styles.typingContainer}>
              <View style={styles.botIcon}>
                <Ionicons name="chatbubbles" size={14} color="#fff" />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.typingText}> Thinking...</Text>
              </View>
            </View>
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
            maxLength={500}
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
  messageBubble: { maxWidth: '80%', padding: 16, borderRadius: 20, marginBottom: 4 },
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
  emotionTag: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  emotionTagText: { fontSize: 10, color: colors.primary, fontWeight: '700', textTransform: 'uppercase' },

  typingContainer: { marginLeft: 36, marginTop: 8, flexDirection: 'row', alignItems: 'flex-end' },
  typingBubble: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#E2E8F0',
    flexDirection: 'row', alignItems: 'center',
  },
  typingText: { fontSize: 13, color: colors.textSecondary },

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
