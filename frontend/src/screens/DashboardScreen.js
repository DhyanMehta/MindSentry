import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, StatusBar, FlatList, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MetricCard } from '../components/MetricCard';
import { EmotionBadge } from '../components/EmotionBadge';
import { SectionHeader } from '../components/SectionHeader';
import { mockDashboard, mockInsights, mockMoodTrend, mockStressTrend, mockSleepTrend } from '../data/mockData';
import { AuthContext } from '../context/AuthContext';
import { responsiveSize, fontSize, borderRadius } from '../utils/responsive';

// 1. Dynamic Chart Config for "Hollow Dot" look and specific colors
const getChartConfig = (colorHex) => ({
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => colorHex, 
  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`, // Slate-500
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '5',
    strokeWidth: '2',
    stroke: colorHex,
    fill: '#ffffff', // White fill creates the premium "hollow" look
  },
  propsForBackgroundLines: {
    strokeDasharray: '5, 5', // Dashed horizontal lines
    stroke: '#F1F5F9', // Very subtle gray
    strokeWidth: 1,
  },
  fillShadowGradient: colorHex,
  fillShadowGradientOpacity: 0.15, // Softer gradient fill
});

const metricsData = [
  { title: "Stress Index", value: mockDashboard.stressLevel, subtitle: "Micro-tremors", trend: { type: 'down', value: '2%' } },
  { title: "Sleep Quality", value: `${mockDashboard.sleepQuality}%`, subtitle: "Wearable signals", trend: { type: 'up', value: '12%' } },
  { title: "Focus Level", value: `${mockDashboard.focus}%`, subtitle: "Voice & blink rate" },
  { title: "Streak", value: `${mockDashboard.streak} days`, subtitle: "Consecutive check-ins" }
];

export const DashboardScreen = () => {
  const navigation = useNavigation();
  const { signout, isLoading: authLoading } = useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Hook for responsive screen width updates
  const { width: screenWidth } = useWindowDimensions();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const result = await signout();
    if (!result.success) {
      setIsLoggingOut(false);
    }
  };

  const renderMetricItem = ({ item }) => (
    <View style={[styles.metricWrapper, { width: screenWidth * 0.42 }]}>
      <MetricCard title={item.title} value={item.value} subtitle={item.subtitle} trend={item.trend} />
    </View>
  );

  // 2. Restructured Chart Renderer (Header inside Card)
  const renderChart = (title, data, mainColor) => {
    // CALCULATION FIX: 
    // Screen Width - (Outer Container Padding * 2) - (Card Padding * 2) - (Safety Buffer)
    // responsiveSize.lg is typically around 24, Card Padding is 16.
    const chartWidth = screenWidth - (responsiveSize.lg * 2) - (16 * 2);

    return (
      <Animated.View entering={SlideInDown.duration(800).delay(700)} style={styles.chartContainer}>
        <View style={styles.chartCard}>
          {/* Internal Header */}
          <View style={styles.chartHeaderRow}>
              <View style={[styles.chartIconBox, { backgroundColor: mainColor + '15' }]}>
                  <Ionicons name="analytics" size={16} color={mainColor} />
              </View>
              <Text style={styles.chartTitle}>{title}</Text>
          </View>

          <LineChart
            data={data}
            width={chartWidth} 
            height={220}
            chartConfig={getChartConfig(mainColor)}
            bezier
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={false} 
            withShadow={false}
            style={styles.chartStyle}
            fromZero={false}
          />
        </View>
      </Animated.View>
    );
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingText}>Welcome Back!</Text>
          <Text style={styles.dateText}>Here is your wellness snapshot.</Text>
        </View>
        <Pressable 
          onPress={handleLogout} 
          style={styles.logoutButton}
          disabled={isLoggingOut || authLoading}
        >
          {isLoggingOut || authLoading ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>

      {/* Hero Card: Wellness Score */}
      <Animated.View entering={FadeIn.duration(500).delay(200)} style={styles.heroContainer}>
        <LinearGradient
          colors={[colors.gradientStart || '#6D28D9', colors.gradientMid || '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.scoreBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.scoreBadgeText}>LIVE SCORE</Text>
            </View>
            <EmotionBadge label={mockDashboard.emotion} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} textStyle={{ color: '#fff' }} />
          </View>
          
          <View style={styles.heroMainContent}>
            <Text style={styles.heroScore}>{mockDashboard.wellnessScore}</Text>
            <View style={styles.heroDivider} />
            <Text style={styles.heroLabel}>Mental Wellness Score</Text>
          </View>

          <Text style={styles.heroFooter}>Based on recent sentiment analysis</Text>
        </LinearGradient>
      </Animated.View>

      {/* Primary Actions */}
      <Animated.View entering={SlideInDown.duration(600).delay(300)} style={styles.actionContainer}>
        <Pressable 
            style={[styles.buttonBase, styles.primaryButton]} 
            onPress={() => navigation.navigate('CheckIn')}
        >
            <View style={styles.iconCircleLight}>
                 <Ionicons name="add" size={24} color={colors.primary} />
            </View>
            <View>
                <Text style={styles.primaryButtonTitle}>Daily Check-in</Text>
                <Text style={styles.primaryButtonSub}>Track your mood</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" style={{ marginLeft: 'auto', opacity: 0.8 }} />
        </Pressable>

        <Pressable 
            style={[styles.buttonBase, styles.secondaryButton]} 
            onPress={() => navigation.navigate('Insights')}
        >
           <Ionicons name="bulb-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      </Animated.View>

      {/* Horizontal Metrics Scroll */}
      <Animated.View entering={SlideInDown.duration(800).delay(500)} style={styles.metricsSection}>
        <Text style={styles.sectionTitle}>Today's Metrics</Text>
        <FlatList
          data={metricsData}
          renderItem={renderMetricItem}
          keyExtractor={(item) => item.title}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsListContent}
          snapToInterval={(screenWidth * 0.42) + responsiveSize.md} 
          decelerationRate="fast"
        />
      </Animated.View>

      {/* Capture Prompt Banner */}
      <Animated.View entering={SlideInDown.duration(800).delay(600)} style={styles.sectionContainer}>
        <Pressable onPress={() => navigation.navigate('CaptureScreen')} style={styles.captureCard}>
          <LinearGradient
            colors={[colors.card, '#F8FAFC']}
            style={styles.captureGradient}
          >
            <View style={styles.captureIconBox}>
                <Ionicons name="scan-outline" size={24} color={colors.vibrantPink || '#EC4899'} />
            </View>
            <View style={styles.captureContent}>
                <Text style={styles.captureTitle}>Enhance Analysis</Text>
                <Text style={styles.captureDesc}>Add voice & face data for deeper accuracy.</Text>
            </View>
            <Ionicons name="arrow-forward-circle-outline" size={28} color={colors.textSecondary} />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Charts Section - Using direct colors */}
      {renderChart("Mood Trends", mockMoodTrend, colors.primary)}
      {renderChart("Stress Analysis", mockStressTrend, colors.danger || '#EF4444')}
      {renderChart("Sleep Patterns", mockSleepTrend, colors.accent || '#06B6D4')}

      {/* Insights List */}
      <Animated.View style={styles.sectionContainer} entering={SlideInDown.duration(800).delay(900)}>
        <View style={styles.cardHeader}>
             <SectionHeader title="Recent Insights" action="View all" onActionPress={() => navigation.navigate('Insights')} />
        </View>
        <View style={styles.insightListContainer}>
            {mockInsights.map((item, idx) => (
            <Pressable key={idx} style={[styles.insightRow, idx !== mockInsights.length - 1 && styles.insightBorder]}>
                <View style={styles.insightIconCircle}>
                    <Ionicons name="sparkles" size={18} color={colors.primary} />
                </View>
                <View style={styles.insightTextContent}>
                    <Text style={styles.insightRowTitle}>{item.title}</Text>
                    <Text style={styles.insightRowDesc} numberOfLines={2}>{item.detail}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted || '#94A3B8'} />
            </Pressable>
            ))}
        </View>
      </Animated.View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingTop: responsiveSize.md,
  },
  bottomSpacer: {
    height: responsiveSize.xxl * 1.5,
  },
  
  // --- Header ---
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSize.lg,
    marginBottom: responsiveSize.lg,
    marginTop: responsiveSize.sm,
  },
  greetingText: {
    fontSize: fontSize.h4,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  // --- Hero Wellness Card ---
  heroContainer: {
    paddingHorizontal: responsiveSize.lg,
    marginBottom: responsiveSize.xl,
  },
  heroCard: {
    borderRadius: 24,
    padding: responsiveSize.lg,
    minHeight: 180,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  scoreBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroMainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: responsiveSize.md,
  },
  heroScore: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  heroDivider: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginVertical: 8,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  heroFooter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.small,
    textAlign: 'center',
  },

  // --- Action Buttons ---
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: responsiveSize.lg,
    marginBottom: responsiveSize.xl,
    gap: responsiveSize.md,
  },
  buttonBase: {
    borderRadius: 18,
    padding: responsiveSize.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: responsiveSize.lg,
  },
  iconCircleLight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  primaryButtonTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.body,
  },
  primaryButtonSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: 60,
    justifyContent: 'center',
  },

  // --- Metrics ---
  metricsSection: {
    marginBottom: responsiveSize.xl,
  },
  sectionTitle: {
    fontSize: fontSize.h6,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: responsiveSize.lg,
    marginBottom: responsiveSize.md,
  },
  metricsListContent: {
    paddingHorizontal: responsiveSize.lg,
    paddingRight: responsiveSize.sm, 
  },
  metricWrapper: {
    // Width is set in the renderItem now for responsiveness
    marginRight: responsiveSize.md,
  },

  // --- Capture Banner ---
  captureCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  captureGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSize.md,
  },
  captureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: (colors.vibrantPink || '#EC4899') + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSize.md,
  },
  captureContent: {
    flex: 1,
  },
  captureTitle: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  captureDesc: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // --- General Sections ---
  sectionContainer: {
    paddingHorizontal: responsiveSize.lg,
    marginBottom: responsiveSize.xl,
  },
  cardHeader: {
    marginBottom: responsiveSize.sm,
  },
  
  // --- Charts (Corrected) ---
  chartContainer: {
    marginBottom: responsiveSize.lg,
    paddingHorizontal: responsiveSize.lg,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16, // This is the padding we subtracted from width
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden', // Ensures nothing spills out
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chartStyle: {
    paddingRight: 50, // Added extra padding to ensure last label shows
    paddingLeft: 0,
    borderRadius: 16,
  },

  // --- Insights ---
  insightListContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: responsiveSize.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveSize.sm,
  },
  insightBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: responsiveSize.md,
    marginBottom: responsiveSize.sm,
  },
  insightIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSize.md,
  },
  insightTextContent: {
    flex: 1,
    marginRight: responsiveSize.sm,
  },
  insightRowTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  insightRowDesc: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});