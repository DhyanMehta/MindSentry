import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize, fontSize, borderRadius, inputDimensions, buttonDimensions, isTablet } from '../utils/responsive';
import { useCheckInState } from '../hooks/useCheckInState';
import { SectionHeader } from '../components/SectionHeader';
import { ApiService } from '../services/api';
import { mockPrompts } from '../data/mockData';

export const CheckInScreen = () => {
  const navigation = useNavigation();
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

        <Pressable
          onPress={() => navigation.navigate('CaptureScreen')}
          style={styles.secondaryButton}
        >
          <Ionicons name="mic" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
          <Text style={styles.secondaryButtonText}>Add Voice & Face Data</Text>
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
    padding: responsiveSize.base,
    paddingBottom: responsiveSize.xxl,
  },
  label: {
    fontSize: fontSize.h5,
    color: colors.primary,
    marginBottom: responsiveSize.lg,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: responsiveSize.xl,
  },
  chip: {
    paddingVertical: responsiveSize.md,
    paddingHorizontal: responsiveSize.lg,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primaryTint,
    backgroundColor: colors.card,
    marginRight: responsiveSize.md,
    marginBottom: responsiveSize.md,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  chipText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  input: {
    minHeight: responsiveSize.xl * 2,
    borderWidth: 2,
    borderColor: colors.secondaryTint,
    backgroundColor: colors.card,
    borderRadius: borderRadius.medium,
    padding: responsiveSize.base,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    marginBottom: responsiveSize.xl,
  },
  promptCard: {
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: borderRadius.medium,
    padding: responsiveSize.lg,
    marginBottom: responsiveSize.xl,
  },
  prompt: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    marginBottom: responsiveSize.md,
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: responsiveSize.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: buttonDimensions.paddingVertical,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    marginBottom: responsiveSize.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: fontSize.h6,
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.secondaryTint,
    paddingVertical: responsiveSize.lg,
    paddingHorizontal: responsiveSize.lg,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: fontSize.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  confirmationMessage: {
    backgroundColor: colors.successTint,
    padding: responsiveSize.md,
    borderRadius: borderRadius.small,
    alignItems: 'center',
    marginTop: responsiveSize.md,
    marginBottom: responsiveSize.md,
  },
  confirmationText: {
    fontSize: fontSize.body,
    color: colors.success,
    fontWeight: '600',
  },
});
