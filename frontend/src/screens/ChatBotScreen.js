import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useChatAgent } from '../hooks/useChatAgent';
import { ErrorBox } from '../components/ErrorBox';
import { colors } from '../theme/colors';

const ChatBotScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    messages,
    loading,
    error,
    pendingApproval,
    sendMessage,
    submitApproval,
    setError,
    clearMessages,
  } = useChatAgent();

  const hasInitializedWithContextRef = useRef(false);
  const hasInitializedWithPromptRef = useRef(false);
  const [inputText, setInputText] = useState('');

  const wellnessContext = route?.params?.wellnessContext;
  const initialPrompt = route?.params?.initialPrompt;
  const chatSource = route?.params?.source || (wellnessContext ? 'scores_tab' : 'support_tab');

  useEffect(() => {
    const runContextKickoff = async () => {
      if (!wellnessContext || hasInitializedWithContextRef.current) return;
      hasInitializedWithContextRef.current = true;
      await sendMessage(
        'Please explain my latest wellness results, what they mean, and what I should focus on next.',
        chatSource
      );
      navigation.setParams({ wellnessContext: null });
    };

    runContextKickoff();
  }, [wellnessContext, navigation, sendMessage, chatSource]);

  useEffect(() => {
    const runInitialPrompt = async () => {
      if (!initialPrompt || hasInitializedWithPromptRef.current) return;
      hasInitializedWithPromptRef.current = true;
      await sendMessage(initialPrompt, chatSource);
      navigation.setParams({ initialPrompt: null });
    };

    runInitialPrompt();
  }, [initialPrompt, navigation, sendMessage, chatSource]);

  useEffect(() => {
    if (!pendingApproval) return;
    Alert.alert(
      'Confirm Action',
      `Approve action: ${pendingApproval.tool_name || 'Continue'}?`,
      [
        { text: 'Deny', style: 'cancel', onPress: () => submitApproval(false) },
        { text: 'Approve', onPress: () => submitApproval(true) },
      ]
    );
  }, [pendingApproval, submitApproval]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    await sendMessage(inputText, chatSource);
    setInputText('');
  };

  const renderMessage = (message) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubble,
          isUser && styles.userMessageBubble,
          isSystem && styles.systemMessageBubble,
        ]}
      >
        {isSystem && (
          <View style={styles.systemMessageHeader}>
            <Text style={styles.systemLabel}>AROGYAAI UPDATE</Text>
          </View>
        )}

        <Text
          style={[
            styles.messageText,
            isUser && styles.userMessageText,
            isSystem && styles.systemMessageText,
          ]}
        >
          {message.content}
        </Text>

        {message.contextUsed && !isUser && (
          <View style={styles.contextIndicator}>
            <Text style={styles.contextLabel}>Based on your recent wellness context</Text>
          </View>
        )}

        {message.agentData && typeof message.agentData === 'object' && message.agentData !== null && !Array.isArray(message.agentData) && (
          <View style={styles.agentDataBox}>
            <Text style={styles.agentDataTitle}>Structured details</Text>
            <Text style={styles.agentDataContent} numberOfLines={5} ellipsizeMode="tail">
              {(() => {
                try {
                  const stringified = JSON.stringify(message.agentData, null, 2);
                  return stringified.substring(0, 220) + (stringified.length > 220 ? '...' : '');
                } catch (_error) {
                  return '[Unable to render details]';
                }
              })()}
            </Text>
          </View>
        )}

        <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>
          {message.createdAt?.toLocaleTimeString() || 'Just now'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Wellness Chat</Text>
          <Text style={styles.headerTitle}>ArogyaAI</Text>
          <Text style={styles.headerSubtitle}>Ask about your scores, patterns, and next supportive steps.</Text>
        </View>
        <TouchableOpacity style={styles.clearPill} onPress={clearMessages}>
          <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          <Text style={styles.clearPillText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {!!wellnessContext && (
        <View style={styles.contextReadyBanner}>
          <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
          <Text style={styles.contextReadyText}>Loaded your latest wellness context for the first response.</Text>
        </View>
      )}

      {error && <ErrorBox message={error} onDismiss={() => setError(null)} />}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatContainer}>
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyOrb}>
                <Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Start with ArogyaAI</Text>
              <Text style={styles.emptySubtitle}>
                Ask what your latest score means, why stress changed, or what small step would help today.
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>ArogyaAI is thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Ask ArogyaAI about your wellness..."
              placeholderTextColor="#8AA0A7"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxHeight={100}
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (loading || !inputText.trim()) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={loading || !inputText.trim()}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 4,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    maxWidth: 240,
    lineHeight: 19,
  },
  clearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryTint,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  contextReadyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  contextReadyText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  chatContainer: { flex: 1 },
  messagesContainer: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  messagesContentContainer: { paddingBottom: 18 },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyOrb: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  messageBubble: {
    maxWidth: '86%',
    marginVertical: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userMessageBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderColor: colors.primary,
  },
  systemMessageBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'center',
    maxWidth: '92%',
    borderColor: colors.divider,
  },
  systemMessageHeader: { marginBottom: 8 },
  systemLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  userMessageText: { color: '#FFF' },
  systemMessageText: { color: colors.textSecondary },
  contextIndicator: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  contextLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  agentDataBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  agentDataTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  agentDataContent: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  messageTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
  },
  userMessageTime: { color: 'rgba(255,255,255,0.7)' },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    paddingLeft: 4,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sendButtonDisabled: {
    backgroundColor: '#B9C8CF',
  },
});

export default ChatBotScreen;
