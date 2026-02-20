import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons'; // For the AI Counselor icon
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { SectionHeader } from '../components/SectionHeader';
import { SupportCard } from '../components/SupportCard';
import { mockResources } from '../data/mockData';

export const SupportScreen = () => {
  const navigation = useNavigation(); // Initialize navigation

  const handleSupportCardPress = (item) => {
    // TODO: Implement navigation to detail screen or specific action
    console.log('Tapped on support card:', item.title);
  };

  const handleEngageCounselor = () => {
    navigation.navigate('CounselorChat'); // Navigate to the chat screen
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={SlideInDown.duration(600).delay(100)}>
        <SectionHeader title="Support" />
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(600).delay(200)} style={styles.aiCounselorCard}>
        <View style={styles.aiCounselorHeader}>
          <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} style={styles.aiCounselorIcon} />
          <Text style={styles.aiCounselorTitle}>AI Counselor</Text>
        </View>
        <Text style={styles.aiCounselorText}>
          Draft empathetic responses and self-help plans. Integrate with LangChain later for retrieval + action routing.
        </Text>
        <Pressable onPress={handleEngageCounselor} style={styles.engageButton}>
          <Text style={styles.engageButtonText}>Engage Counselor</Text>
        </Pressable>
      </Animated.View>

      {mockResources.map((item, idx) => (
        <Animated.View key={idx} entering={SlideInDown.duration(600).delay(300 + idx * 100)}>
          <Pressable onPress={() => handleSupportCardPress(item)}>
            <SupportCard title={item.title} description={item.description} badge="Available offline" />
          </Pressable>
        </Animated.View>
      ))}

      <Animated.View entering={SlideInDown.duration(600).delay(mockResources.length * 100 + 400)} style={styles.notice}>
        <Text style={styles.noticeText}>Not a replacement for professional care. Always consult a qualified mental health professional for personalized advice and treatment.</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 32,
  },
  aiCounselorCard: {
    backgroundColor: colors.secondary,
    borderRadius: 18,
    borderWidth: 0,
    padding: 24,
    marginBottom: 24,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  aiCounselorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  aiCounselorIcon: {
    marginRight: 14,
  },
  aiCounselorTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 19,
  },
  aiCounselorText: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 10,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
  },
  engageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  engageButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  notice: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 16,
    padding: 18,
    marginTop: 28,
    backgroundColor: colors.accentTint,
  },
  noticeText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 13,
    fontWeight: '600',
  },
});
