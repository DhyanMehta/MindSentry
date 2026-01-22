import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useCheckInState } from '../hooks/useCheckInState';
import { SectionHeader } from '../components/SectionHeader';
import { ApiService } from '../services/api';
import { mockPrompts } from '../data/mockData';

export const CheckInScreen = () => {
  const { mood, moods, setMood, note, setNote } = useCheckInState();
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async () => {
    await ApiService.submitCheckIn({ mood, note, timestamp: new Date().toISOString() });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000); // Hide message after 2 seconds
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={SlideInDown.duration(600).delay(100)}>
        <SectionHeader title="Quick check-in" />
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(600).delay(200)}>
        <Text style={styles.label}>How are you feeling?</Text>
        <View style={styles.chipRow}>
          {moods.map((item) => (
            <Pressable
              key={item}
              onPress={() => setMood(item)}
              style={[styles.chip, mood === item ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, mood === item ? styles.chipTextActive : null]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(600).delay(300)}>
        <Text style={styles.label}>Add a short note</Text>
        <TextInput
          placeholder="Text, voice, or facial cues the model should know about about..."
          placeholderTextColor={colors.textSecondary}
          value={note}
          onChangeText={setNote}
          style={styles.input}
          multiline
        />
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(600).delay(400)}>
        <SectionHeader title="Journal prompts" />
        <View style={styles.promptCard}>
          {mockPrompts.map((item, idx) => (
            <Text key={idx} style={styles.prompt}>
              • {item}
            </Text>
          ))}
        </View>
      </Animated.View>

      {isSaved && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.confirmationMessage}>
          <Text style={styles.confirmationText}>Check-in saved!</Text>
        </Animated.View>
      )}

      <Animated.View entering={SlideInDown.duration(600).delay(500)} style={styles.buttonContainer}>
        <Pressable onPress={handleSubmit} style={styles.button}>
          <Text style={styles.buttonText}>Save check-in</Text>
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
    padding: 18,
    paddingBottom: 32,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
  },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    ...typography.body,
    marginBottom: 18,
  },
  promptCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    padding: 16, // Increased padding for better appearance
    marginBottom: 22,
  },
  prompt: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  confirmationMessage: {
    backgroundColor: colors.success,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  confirmationText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
