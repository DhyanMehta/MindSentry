import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// AI Response samples for better conversation
const aiResponses = [
  "Thank you for sharing. Remember, I'm here to listen and provide support.",
  "That sounds challenging. How are you coping with these feelings?",
  "It's important to acknowledge what you're going through. What would help you feel better right now?",
  "I appreciate your openness. Remember to be kind to yourself.",
  "Your feelings are valid. Would you like to talk more about what's on your mind?",
  "Thank you for trusting me with this. You're doing great by seeking support.",
  "That takes courage to share. What's one thing that could improve your day?",
  "I'm here for you. Let's work through this together.",
];

export const CounselorChatScreen = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hello there! How are you feeling today? I\'m here to listen and support you.', sender: 'ai', timestamp: new Date() },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;

    // Add user message
    const userMessage = { 
      id: Date.now().toString(), 
      text: inputText.trim(), 
      sender: 'user',
      timestamp: new Date()
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputText('');

    // Show typing indicator
    setIsTyping(true);

    // Simulate AI response after a delay
    setTimeout(() => {
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      const aiResponse = { 
        id: (Date.now() + 1).toString(), 
        text: randomResponse, 
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages((prevMessages) => [...prevMessages, aiResponse]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  const renderMessage = ({ item }) => (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.messageBubble,
        item.sender === 'user' ? styles.userBubble : styles.aiBubble,
      ]}
    >
      <Text style={item.sender === 'user' ? styles.userText : styles.aiText}>
        {item.text}
      </Text>
    </Animated.View>
  );

  const renderTypingIndicator = () => (
    <View style={[styles.messageBubble, styles.aiBubble]}>
      <View style={styles.typingIndicator}>
        <View style={[styles.typingDot, styles.typingDot1]} />
        <View style={[styles.typingDot, styles.typingDot2]} />
        <View style={[styles.typingDot, styles.typingDot3]} />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>AI Counselor</Text>
          <Text style={styles.headerSubtitle}>Always available to listen</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        scrollEnabled={true}
      />

      {isTyping && renderTypingIndicator()}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type your message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <Pressable 
          onPress={handleSendMessage} 
          style={[styles.sendButton, inputText.trim() === '' && styles.sendButtonDisabled]}
          disabled={inputText.trim() === '' || isTyping}
        >
          <Ionicons name="send" size={24} color={inputText.trim() === '' ? colors.textSecondary : '#FFFFFF'} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'android' ? 40 : 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 22,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
    marginRight: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderBottomLeftRadius: 6,
    marginLeft: 4,
  },
  userText: {
    ...typography.body,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  aiText: {
    ...typography.body,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  typingDot1: {
    opacity: 1,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: colors.primaryTint,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 48,
    backgroundColor: colors.card,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: colors.textPrimary,
    ...typography.body,
    fontSize: 15,
    borderWidth: 2,
    borderColor: colors.primaryTint,
    fontWeight: '500',
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 26,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: colors.primaryTint,
    opacity: 0.6,
  },
});
