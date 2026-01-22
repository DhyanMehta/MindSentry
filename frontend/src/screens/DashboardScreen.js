import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MetricCard } from '../components/MetricCard';
import { EmotionBadge } from '../components/EmotionBadge';
import { SectionHeader } from '../components/SectionHeader';
import { mockDashboard, mockInsights, mockMoodTrend, mockStressTrend, mockSleepTrend } from '../data/mockData';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundColor: colors.surface,
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`, // Primary color
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.7})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: colors.primary,
  },
};

export const DashboardScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeIn.duration(800).delay(100)} style={styles.header}>
        <Text style={styles.title}>MindSentry</Text>
        <Text style={styles.subtitle}>AI multi-modal wellbeing monitor</Text>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(300)} style={styles.card}>
        <Text style={styles.cardLabel}>Mental Wellness Score</Text>
        <Text style={styles.score}>{mockDashboard.wellnessScore}</Text>
        <EmotionBadge label={mockDashboard.emotion} />
        <Text style={styles.secondary}>Live sentiment from text + voice + face</Text>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(500)}>
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
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(700)} style={styles.chartSection}>
        <SectionHeader title="Mood Trend" />
        <LineChart
          data={mockMoodTrend}
          width={screenWidth - 36} // Padding 18 on each side
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(900)} style={styles.chartSection}>
        <SectionHeader title="Stress Levels" />
        <LineChart
          data={mockStressTrend}
          width={screenWidth - 36}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`, // Danger color
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: colors.danger,
            },
          }}
          bezier
          style={styles.chart}
        />
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(1100)} style={styles.chartSection}>
        <SectionHeader title="Sleep Patterns" />
        <LineChart
          data={mockSleepTrend}
          width={screenWidth - 36}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(0, 204, 201, ${opacity})`, // Secondary color
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: colors.secondary,
            },
          }}
          bezier
          style={styles.chart}
        />
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(1300)}>
        <SectionHeader title="Recent insights" action="View all" />
        {mockInsights.map((item, idx) => (
          <View key={idx} style={styles.insightCard}>
            <Text style={styles.insightTitle}>{item.title}</Text>
            <Text style={styles.insightDetail}>{item.detail}</Text>
          </View>
        ))}
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
  chartSection: {
    marginBottom: 20,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
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
