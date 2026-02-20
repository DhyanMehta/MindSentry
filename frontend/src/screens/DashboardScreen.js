import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MetricCard } from '../components/MetricCard';
import { EmotionBadge } from '../components/EmotionBadge';
import { SectionHeader } from '../components/SectionHeader';
import { ResponsiveGrid, ResponsiveContainer } from '../components/ResponsiveComponents';
import { mockDashboard, mockInsights, mockMoodTrend, mockStressTrend, mockSleepTrend } from '../data/mockData';
import { AuthContext } from '../context/AuthContext';
import { responsiveSize, fontSize, SCREEN_WIDTH, isTablet } from '../utils/responsive';

const screenWidth = SCREEN_WIDTH;

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
  const navigation = useNavigation();
  const { signout, isLoading: authLoading } = useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const result = await signout();
    if (!result.success) {
      setIsLoggingOut(false);
      // Error is handled by auth context, user will see it in UI if needed
    }
    // If successful, navigation happens automatically via AppNavigator
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTextContainer}><Text style={styles.title}>MindSentry</Text><Text style={styles.subtitle}>AI multi-modal wellbeing monitor</Text></View>
        <Pressable 
          onPress={handleLogout} 
          style={[styles.logoutButton, (isLoggingOut || authLoading) && styles.logoutButtonDisabled]}
          disabled={isLoggingOut || authLoading}
        >
          {isLoggingOut || authLoading ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <Ionicons name="log-out-outline" size={24} color={colors.textPrimary} />
          )}
        </Pressable>
      </View>

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
          width={screenWidth - 36}
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
            color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
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
            color: (opacity = 1) => `rgba(0, 204, 201, ${opacity})`,
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

      <Animated.View entering={SlideInDown.duration(800).delay(1500)} style={styles.captureButtonContainer}>
        <Pressable
          onPress={() => navigation.navigate('CaptureScreen')}
          style={styles.capturePromptCard}
        >
          <View style={styles.captureIconContainer}>
            <Ionicons name="mic" size={28} color={colors.secondary} />
            <Ionicons name="camera" size={28} color={colors.accent} style={{ marginLeft: 8 }} />
          </View>
          <View style={styles.captureTextContainer}>
            <Text style={styles.captureTitle}>Enhance Your Wellness Analysis</Text>
            <Text style={styles.captureSubtitle}>Add voice and facial data for deeper AI insights</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
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
    paddingHorizontal: responsiveSize.base,
    paddingVertical: responsiveSize.lg,
    paddingBottom: responsiveSize.xxl,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize.xxl,
    paddingTop: responsiveSize.xs,
  },
  headerTextContainer: {
    flex: 1,
  },
  logoutButton: {
    padding: responsiveSize.sm,
    backgroundColor: colors.primaryTint,
    borderRadius: 10,
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  title: {
    ...typography.h1,
    fontSize: fontSize.h2,
    color: colors.primary,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: responsiveSize.xs,
    fontSize: fontSize.body,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: responsiveSize.lg,
    marginBottom: responsiveSize.lg,
    borderWidth: 2,
    borderColor: colors.primaryTint,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontSize: fontSize.small,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  score: {
    ...typography.h1,
    fontSize: fontSize.h1,
    color: colors.primary,
    marginVertical: responsiveSize.md,
    fontWeight: '900',
  },
  secondary: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: responsiveSize.md,
    fontSize: fontSize.body,
    fontStyle: 'italic',
  },
  chartSection: {
    marginBottom: responsiveSize.lg,
  },
  chart: {
    marginVertical: responsiveSize.md,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primaryTint,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  insightCard: {
    backgroundColor: colors.card,
    padding: responsiveSize.base,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.secondaryTint,
    marginBottom: responsiveSize.md,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  insightTitle: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
    fontSize: fontSize.body,
  },
  insightDetail: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: responsiveSize.xs,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
  },
  captureButtonContainer: {
    marginTop: responsiveSize.lg,
    marginBottom: responsiveSize.xxl,
  },
  capturePromptCard: {
    backgroundColor: colors.primary,
    borderWidth: 0,
    borderRadius: 18,
    padding: responsiveSize.base,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  captureIconContainer: {
    flexDirection: 'row',
    marginRight: responsiveSize.md,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 14,
    padding: responsiveSize.sm,
  },
  captureTextContainer: {
    flex: 1,
  },
  captureTitle: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: responsiveSize.xs,
    fontSize: fontSize.h4,
  },
  captureSubtitle: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: fontSize.small,
  },
});
