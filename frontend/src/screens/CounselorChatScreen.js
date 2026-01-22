import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated'; // Import Animated and FadeIn
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export const CounselorChatScreen = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hello there! How are you feeling today?', sender: 'ai' },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;

    const newMessage = { id: Date.now().toString(), text: inputText.trim(), sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputText('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = { id: Date.now().toString() + 'ai', text: 'Thank you for sharing. Remember, I\'m here to listen and provide support.', sender: 'ai' };
      setMessages((prevMessages) => [...prevMessages, aiResponse]);
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // Adjust as needed
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>AI Counselor</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.messagesContainer} inverted={true}>
        {[...messages].reverse().map((message) => (
          <Animated.View // Use Animated.View for new message animation
            key={message.id}
            entering={FadeIn.duration(300)}
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text style={message.sender === 'user' ? styles.userText : styles.aiText}>
              {message.text}
            </Text>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type your message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <Pressable onPress={handleSendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color={colors.background} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground, // Changed background to a lighter shade
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20, // More rounded corners
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.vibrantBlue, // Vibrant blue for user messages
    borderBottomRightRadius: 5,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.vibrantGreen, // Vibrant green for AI messages
    borderBottomLeftRadius: 5,
  },
  userText: {
    ...typography.body,
    color: '#fff',
  },
  aiText: {
    ...typography.body,
    color: colors.background, // Changed to dark text on vibrant green bubble
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.card,
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    color: colors.textPrimary,
    ...typography.body,
  },
  sendButton: {
    backgroundColor: colors.vibrantBlue, // Vibrant blue for send button
    borderRadius: 25,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
