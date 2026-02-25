import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown, ZoomIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { responsiveSize, fontSize, borderRadius, buttonDimensions } from '../utils/responsive';
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
    setTimeout(() => {
        setIsSaved(false);
        // Optional: Navigate back after saving
        // navigation.goBack(); 
    }, 2000); 
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={SlideInDown.duration(600).delay(100)} style={styles.headerContainer}>
            <SectionHeader title="Daily Check-in" />
            <Text style={styles.subHeader}>Track your mental wellbeing</Text>
          </Animated.View>

          {/* 1. Mood Section Card */}
          <Animated.View entering={SlideInDown.duration(600).delay(200)} style={styles.card}>
            <View style={styles.cardHeaderRow}>
                <View style={styles.iconContainer}>
                     <Ionicons name="happy-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.cardLabel}>How are you feeling?</Text>
            </View>
            
            <View style={styles.chipRow}>
              {moods.map((item) => {
                const isActive = mood === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setMood(item)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* 2. Journal Input Card */}
          <Animated.View entering={SlideInDown.duration(600).delay(300)} style={styles.card}>
             <View style={styles.cardHeaderRow}>
                <View style={styles.iconContainer}>
                     <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.cardLabel}>Add a short note</Text>
            </View>

            <View style={styles.inputWrapper}>
                <TextInput
                  placeholder="Describe your day, thoughts, or feelings..."
                  placeholderTextColor={colors.textSecondary}
                  value={note}
                  onChangeText={setNote}
                  style={styles.input}
                  multiline
                  textAlignVertical="top" // Important for Android
                />
            </View>
          </Animated.View>

          {/* 3. Prompts / Inspiration */}
          <Animated.View entering={SlideInDown.duration(600).delay(400)}>
            <View style={styles.promptContainer}>
                <View style={styles.promptHeader}>
                    <Ionicons name="bulb" size={18} color={colors.primary} />
                    <Text style={styles.promptTitle}>JOURNAL PROMPTS</Text>
                </View>
                {mockPrompts.map((item, idx) => (
                    <View key={idx} style={styles.promptItem}>
                    <View style={styles.bulletPoint} />
                    <Text style={styles.promptText}>{item}</Text>
                    </View>
                ))}
            </View>
          </Animated.View>

          {/* Bottom Spacer for scrolling */}
          <View style={{ height: 100 }} />

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Success Message */}
      {isSaved && (
        <Animated.View 
            entering={ZoomIn.duration(300)} 
            exiting={FadeOut.duration(300)}
            style={styles.floatingSuccess}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.successText}>Check-in saved!</Text>
        </Animated.View>
      )}

      {/* Footer Buttons (Fixed or at bottom of scroll) */}
      <Animated.View entering={SlideInDown.duration(600).delay(500)} style={styles.footerContainer}>
        <Pressable 
          onPress={() => navigation.navigate('CaptureScreen')}
          style={styles.secondaryButton}
        >
          <Ionicons name="mic" size={20} color={colors.secondary} />
          <Text style={styles.secondaryButtonText}>Voice/Face</Text>
        </Pressable>

        <Pressable onPress={handleSubmit} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Save Check-in</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Light modern background
  },
  content: {
    padding: responsiveSize.lg,
    paddingBottom: responsiveSize.xxl,
  },
  headerContainer: {
    marginBottom: responsiveSize.lg,
  },
  subHeader: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // --- Cards ---
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: responsiveSize.lg,
    marginBottom: responsiveSize.lg,
    // Modern Shadow
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSize.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardLabel: {
    fontSize: fontSize.h6,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  // --- Mood Chips ---
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8, // Use margin fallback if gap not supported in older RN
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30, // Pill shape
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // --- Input ---
  inputWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
  },
  input: {
    minHeight: 120,
    padding: responsiveSize.md,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    textAlignVertical: 'top', // Fixes text alignment on Android
  },

  // --- Prompts ---
  promptContainer: {
    backgroundColor: colors.primaryTint, // Very light blue/purple
    borderRadius: 16,
    padding: responsiveSize.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSize.md,
    opacity: 0.8,
  },
  promptTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 6,
    letterSpacing: 1,
  },
  promptItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginRight: 10,
    opacity: 0.6,
  },
  promptText: {
    fontSize: fontSize.small, // slightly smaller than body
    color: colors.textPrimary,
    lineHeight: 20,
    flex: 1,
  },

  // --- Toast ---
  floatingSuccess: {
    position: 'absolute',
    top: 60, // Adjust based on header height
    alignSelf: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  successText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 14,
  },

  // --- Footer Buttons ---
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: responsiveSize.lg,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 10,
  },
  primaryButton: {
    flex: 2, // Takes up more space
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: fontSize.h6,
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 4,
  },
});