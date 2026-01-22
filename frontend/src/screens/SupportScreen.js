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
    padding: 18,
    paddingBottom: 32,
  },
  aiCounselorCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 18,
    marginBottom: 18,
  },
  aiCounselorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiCounselorIcon: {
    marginRight: 10,
  },
  aiCounselorTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  aiCounselorText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 15,
  },
  engageButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  engageButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
  },
  notice: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
  },
  noticeText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
