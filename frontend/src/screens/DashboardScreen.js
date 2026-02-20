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
// Responsive layout handled locally in this screen for precise spacing
import { mockDashboard, mockInsights, mockMoodTrend, mockStressTrend, mockSleepTrend } from '../data/mockData';
import { AuthContext } from '../context/AuthContext';
import { responsiveSize, fontSize, SCREEN_WIDTH, isTablet } from '../utils/responsive';

const screenWidth = SCREEN_WIDTH;

const chartConfig = {
  backgroundColor: colors.card,
  backgroundGradientFrom: colors.card,
  backgroundGradientTo: colors.card,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(109, 40, 217, ${opacity})`, // primary (matches colors.primary)
  labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity * 0.9})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '5',
    strokeWidth: '2',
    stroke: colors.card,
  },
  propsForBackgroundLines: {
    stroke: colors.divider,
  },
  fillShadowGradient: colors.primary,
  fillShadowGradientOpacity: 0.06,
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

      <Animated.View entering={SlideInDown.duration(400).delay(200)} style={styles.actionRow}>
        <Pressable style={[styles.actionButton, styles.primaryAction]} onPress={() => navigation.navigate('CheckInScreen')}>
          <Ionicons name="checkmark-done-outline" size={18} color={colors.card} />
          <Text style={[styles.actionLabel, styles.primaryActionLabel]}>Start Check-in</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.secondaryAction]} onPress={() => navigation.navigate('InsightsScreen')}>
          <Ionicons name="bulb-outline" size={18} color={colors.primary} />
          <Text style={[styles.actionLabel, styles.secondaryActionLabel]}>Insights</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(300)} style={styles.card}>
        <Text style={styles.cardLabel}>Mental Wellness Score</Text>
        <Text style={styles.score}>{mockDashboard.wellnessScore}</Text>
        <EmotionBadge label={mockDashboard.emotion} />
        <Text style={styles.secondary}>Live sentiment from text + voice + face</Text>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(500)}>
        <SectionHeader title="Today" />
        <View style={styles.metricsGrid}>
          <View style={styles.metricWrapper}><MetricCard title="Stress index" value={mockDashboard.stressLevel} subtitle="Based on micro tremors + text sentiment" /></View>
          <View style={styles.metricWrapper}><MetricCard title="Sleep quality" value={`${mockDashboard.sleepQuality}%`} subtitle="Estimated from wearable-ready signals" trend={{ type: 'up', value: '+12%' }} /></View>
          <View style={styles.metricWrapper}><MetricCard title="Focus level" value={`${mockDashboard.focus}%`} subtitle="Voice pace + blink rate + keystroke rhythm" /></View>
          <View style={styles.metricWrapper}><MetricCard title="Streak" value={`${mockDashboard.streak} days`} subtitle="Consecutive check-ins completed" /></View>
        </View>
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(800).delay(600)} style={styles.captureButtonContainer}>
        <Pressable onPress={() => navigation.navigate('CaptureScreen')} style={styles.capturePromptCard}>
          <View style={styles.captureIconContainer}>
            <Ionicons name="mic" size={28} color={colors.vibrantPink} />
            <Ionicons name="camera" size={28} color={colors.accent} style={{ marginLeft: 8 }} />
          </View>
          <View style={styles.captureTextContainer}>
            <Text style={styles.captureTitle}>Enhance Your Wellness Analysis</Text>
            <Text style={styles.captureSubtitle}>Add voice and facial data for deeper AI insights</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.card} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(700)} style={styles.chartSection}>
        <SectionHeader title="Mood Trend" />
        <View style={styles.chartContainer}>
          <LineChart
            data={mockMoodTrend}
            width={screenWidth - (responsiveSize.base * 2) - (responsiveSize.md * 2)}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(109,40,217, ${opacity})`,
              fillShadowGradient: colors.primary,
              fillShadowGradientOpacity: 0.06,
              labelColor: (opacity = 1) => `rgba(71,85,105, ${opacity})`,
            }}
            bezier
            style={[styles.chart, { paddingTop: responsiveSize.sm, paddingRight: responsiveSize.md }]}
          />
        </View>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(900)} style={styles.chartSection}>
        <SectionHeader title="Stress Levels" />
        <View style={styles.chartContainer}>
          <LineChart
            data={mockStressTrend}
            width={screenWidth - (responsiveSize.base * 2) - (responsiveSize.md * 2)}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(239,68,68, ${opacity})`,
              fillShadowGradient: colors.danger,
              fillShadowGradientOpacity: 0.055,
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: colors.card,
              },
            }}
            bezier
            style={[styles.chart, { paddingTop: responsiveSize.sm, paddingRight: responsiveSize.md }]}
          />
        </View>
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(800).delay(1100)} style={styles.chartSection}>
        <SectionHeader title="Sleep Patterns" />
        <View style={styles.chartContainer}>
          <LineChart
            data={mockSleepTrend}
            width={screenWidth - (responsiveSize.base * 2) - (responsiveSize.md * 2)}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(6,182,212, ${opacity})`,
              fillShadowGradient: colors.accent,
              fillShadowGradientOpacity: 0.055,
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: colors.card,
              },
            }}
            bezier
            style={[styles.chart, { paddingTop: responsiveSize.sm, paddingRight: responsiveSize.md }]}
          />
        </View>
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
  chartContainer: {
    alignSelf: 'center',
    paddingTop: responsiveSize.sm,
    paddingRight: responsiveSize.sm,
    width: '100%',
    // allow chart inner padding while keeping container rounded
    paddingLeft: 6,
    paddingBottom: 2,
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
    backgroundColor: colors.gradientMid || colors.primary,
    borderWidth: 0,
    borderRadius: 18,
    padding: responsiveSize.base,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  captureIconContainer: {
    flexDirection: 'row',
    marginRight: responsiveSize.md,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSize.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: responsiveSize.sm,
    paddingHorizontal: responsiveSize.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondaryTint,
    marginRight: responsiveSize.sm,
    shadowColor: colors.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
  },
  primaryActionLabel: {
    color: colors.card,
  },
  actionLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: responsiveSize.xs,
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: 'transparent',
    borderColor: colors.primaryTint,
  },
  secondaryActionLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricWrapper: {
    width: '48%',
    marginBottom: responsiveSize.md,
  },
});
