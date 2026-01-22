import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MetricCard } from '../components/MetricCard';
import { EmotionBadge } from '../components/EmotionBadge';
import { SectionHeader } from '../components/SectionHeader';
import { mockDashboard, mockInsights } from '../data/mockData';

export const DashboardScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>MindSentry</Text>
        <Text style={styles.subtitle}>AI multi-modal wellbeing monitor</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Mental Wellness Score</Text>
        <Text style={styles.score}>{mockDashboard.wellnessScore}</Text>
        <EmotionBadge label={mockDashboard.emotion} />
        <Text style={styles.secondary}>Live sentiment from text + voice + face</Text>
      </View>

      <SectionHeader title="Today" />
      <MetricCard title="Stress index" value={mockDashboard.stressLevel} subtitle="Based on micro tremors + text sentiment" />
      <MetricCard
        title="Sleep quality"
        value={`${mockDashboard.sleepQuality}%`}
        subtitle="Estimated from wearable-ready signals"
        trend={{ type: 'up', value: '+12%' }}
      />
      <MetricCard title="Focus level" value={`${mockDashboard.focus}%`} subtitle="Voice pace + blink rate + keystroke rhythm" />
      <MetricCard title="Streak" value={`${mockDashboard.streak} days`} subtitle="Consecutive check-ins completed" />

      <SectionHeader title="Recent insights" action="View all" />
      {mockInsights.map((item, idx) => (
        <View key={idx} style={styles.insightCard}>
          <Text style={styles.insightTitle}>{item.title}</Text>
          <Text style={styles.insightDetail}>{item.detail}</Text>
        </View>
      ))}
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
  header: {
    marginBottom: 16,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cardLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  score: {
    ...typography.h1,
    color: colors.textPrimary,
    marginVertical: 8,
  },
  secondary: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 10,
  },
  insightCard: {
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 10,
  },
  insightTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  insightDetail: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
  },
});
