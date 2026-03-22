/**
 * ChatBotScreen - AarogyaAI chat with RAG context awareness
 */
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
import * as Location from 'expo-location';
import { useChatAgent } from '../hooks/useChatAgent';
import { ErrorBox } from '../components/ErrorBox';

const ChatBotScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    messages,
    loading,
    error,
    agentResult,
    sendMessage,
    findNearbyClinics,
    setError,
    clearMessages,
  } = useChatAgent();
  const hasInitializedWithContextRef = useRef(false);

  const [inputText, setInputText] = useState('');

  const wellnessContext = route?.params?.wellnessContext;

  useEffect(() => {
    const runContextKickoff = async () => {
      if (!wellnessContext || hasInitializedWithContextRef.current) return;

      hasInitializedWithContextRef.current = true;

      const contextPrompt = [
        'You are given the latest wellness check-in context. Reply in exactly two sections before any normal chat:',
        '1) Answer First: one concise practical recommendation.',
        '2) Your Thought: brief reasoning based on the data.',
        'Then ask one follow-up question.',
        '',
        `Wellness score: ${wellnessContext?.wellnessScore ?? '--'}`,
        `Risk level: ${wellnessContext?.riskLevel ?? '--'}`,
        `Mood score: ${wellnessContext?.moodScorePercent ?? '--'}%`,
        `Stress score: ${wellnessContext?.stressScorePercent ?? '--'}%`,
        `Text emotion: ${wellnessContext?.textEmotion ?? 'Unknown'}`,
        `Voice emotion: ${wellnessContext?.audioEmotion ?? 'Unknown'}`,
        `Video emotion: ${wellnessContext?.videoEmotion ?? 'Unknown'}`,
        `Top recommendations: ${JSON.stringify(wellnessContext?.topRecommendations || [])}`,
      ].join('\n');

      await sendMessage(contextPrompt);
      navigation.setParams({ wellnessContext: null });
    };

    runContextKickoff();
  }, [wellnessContext, navigation, sendMessage]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    await sendMessage(inputText);
    setInputText('');
  };

  const handleUseMyLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to find nearby clinics.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);

      await findNearbyClinics(latitude, longitude, { radiusKm: 10.0 });
    } catch (err) {
      console.error('Use location error:', err);
      Alert.alert('Location Error', 'Unable to fetch your location right now. Please try again.');
    }
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
            <Text style={styles.systemLabel}>🤖 AGENT UPDATE</Text>
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

        {message.contextUsed && (
          <View style={styles.contextIndicator}>
            <Text style={styles.contextLabel}>📚 Context-aware response</Text>
          </View>
        )}

        {message.agentData && typeof message.agentData === 'object' && message.agentData !== null && (
          <View style={styles.agentDataBox}>
            <Text style={styles.agentDataTitle}>Agent Details:</Text>
            {!Array.isArray(message.agentData) && (
              <Text style={styles.agentDataContent} numberOfLines={5} ellipsizeMode="tail">
                {(() => {
                  try {
                    const stringified = JSON.stringify(message.agentData, null, 2);
                    return stringified.substring(0, 200) + (stringified.length > 200 ? '...' : '');
                  } catch (e) {
                    return '[Unable to render agent data]';
                  }
                })()}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.messageTime}>
          {message.createdAt?.toLocaleTimeString() || 'Just now'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AarogyaAI</Text>
        <Text style={styles.headerSubtitle}>Your AI wellness companion</Text>
      </View>

      {!!wellnessContext && (
        <View style={styles.contextReadyBanner}>
          <Ionicons name="sparkles-outline" size={14} color="#4338CA" />
          <Text style={styles.contextReadyText}>Loaded your latest wellness context for first response.</Text>
        </View>
      )}

      {error && (
        <ErrorBox
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
      >
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>Welcome to AarogyaAI</Text>
              <Text style={styles.emptySubtitle}>
                Share what's on your mind. Our AI assistant is here to help.
              </Text>
              <Text style={styles.emptyHint}>
                You can ask for clinic recommendations, book appointments, or just chat about your wellness.
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7B68EE" />
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[styles.locationButton, loading && styles.locationButtonDisabled]}
            onPress={handleUseMyLocation}
            disabled={loading}
          >
            <Text style={styles.locationButtonText}>Use My Real Location</Text>
          </TouchableOpacity>

          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor="#999"
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
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearMessages}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  contextReadyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderBottomWidth: 1,
    borderBottomColor: '#C7D2FE',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  contextReadyText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messagesContentContainer: {
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  emptyHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  messageBubble: {
    maxWidth: '85%',
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#E8E8E8',
    alignSelf: 'flex-start',
  },
  userMessageBubble: {
    backgroundColor: '#7B68EE',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  systemMessageBubble: {
    backgroundColor: '#F0E8FF',
    alignSelf: 'center',
    maxWidth: '90%',
    marginVertical: 12,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7B68EE',
  },
  systemMessageHeader: {
    marginBottom: 8,
  },
  systemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7B68EE',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFF',
  },
  systemMessageText: {
    color: '#333',
    fontSize: 13,
  },
  contextIndicator: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  contextLabel: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.6)',
    fontStyle: 'italic',
  },
  agentDataBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
  },
  agentDataTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  agentDataContent: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#7B68EE',
    fontSize: 14,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  locationButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2EEFF',
    borderColor: '#7B68EE',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    color: '#5A4ACF',
    fontSize: 12,
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#F5F5F5',
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A1A',
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#7B68EE',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-end',
  },
  clearButtonText: {
    color: '#999',
    fontSize: 12,
  },
});

export default ChatBotScreen;
