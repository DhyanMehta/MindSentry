import React, { useContext, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, StatusBar, FlatList, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';
import { MetricCard } from '../components/MetricCard';
import { EmotionBadge } from '../components/EmotionBadge';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { AuthContext } from '../context/AuthContext';
import { ApiService } from '../services/api';
import { AssessmentService } from '../services/assessmentService';
import { responsiveSize, fontSize, borderRadius } from '../utils/responsive';

const LOW_WELLNESS_THRESHOLD = 45;

export const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { width: screenWidth } = useWindowDimensions();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [screenError, setScreenError] = useState('');
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [recentAssessments, setRecentAssessments] = useState([]);

  const hasData = (summary?.total_assessments ?? 0) > 0;
  const wellnessScoreNumber = AssessmentService.computeWellnessScore(summary);
  const wellnessScore = wellnessScoreNumber ?? '--';

  const stressPercent = hasData ? `${Math.round((summary.avg_stress_score ?? 0.5) * 100)}%` : 'N/A';
  const moodPercent = hasData ? `${Math.round((summary.avg_mood_score ?? 0.5) * 100)}%` : 'N/A';

  const computeStreak = useCallback((assessments) => {
    if (!assessments || assessments.length === 0) return 0;
    const days = new Set(assessments.map((a) => new Date(a.started_at).toDateString()));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, []);

  const streak = computeStreak(recentAssessments);
  const lastBurnout = trend.length > 0 ? trend[trend.length - 1]?.burnout_score ?? 0.3 : 0.3;

  const metricsData = [
    { title: 'Stress Index', value: stressPercent, subtitle: 'Latest analysis' },
    { title: 'Mood Score', value: moodPercent, subtitle: 'Average mood' },
    { title: 'Focus Level', value: hasData ? `${Math.round((1 - lastBurnout) * 100)}%` : 'N/A', subtitle: 'Energy & focus' },
    { title: 'Streak', value: `${streak} days`, subtitle: 'Consecutive check-ins' },
  ];

  const recentSorted = [...recentAssessments]
    .filter((item) => !!item?.id)
    .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));

  const scoreReasons = [
    hasData ? `Average mood: ${moodPercent}` : 'Average mood: N/A',
    hasData ? `Average stress: ${stressPercent}` : 'Average stress: N/A',
    `Completed sessions considered: ${summary?.completed_assessments ?? 0}`,
    'Wellness score weights mood and stress trends over recent sessions.',
  ];

  const showLowScorePrecautions = wellnessScoreNumber != null && wellnessScoreNumber < LOW_WELLNESS_THRESHOLD;

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setScreenError('');
    try {
      const [summaryData, trendData, assessmentData] = await Promise.all([
        ApiService.getHistorySummary(),
        ApiService.getHistoryTrend(7),
        ApiService.getHistoryAssessments(5),
      ]);
      setSummary(summaryData);
      setTrend(Array.isArray(trendData) ? trendData : []);
      const recent = Array.isArray(assessmentData)
        ? assessmentData
        : Array.isArray(assessmentData?.items)
          ? assessmentData.items
          : [];
      setRecentAssessments(recent);
    } catch (error) {
      console.log('[Dashboard] Load error:', error.message);
      setScreenError(error.message || 'Could not load dashboard data. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload when the tab comes back into focus (after a check-in)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const renderMetricItem = ({ item }) => (
    <View style={[styles.metricWrapper, { width: screenWidth * 0.42 }]}>
      <MetricCard title={item.title} value={item.value} subtitle={item.subtitle} />
    </View>
  );

  const userName = user?.name ? user.name.split(' ')[0] : 'Back';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingText}>Welcome {userName}!</Text>
          <Text style={styles.dateText}>
            {hasData ? 'Here is your wellness snapshot.' : 'Start your first check-in below.'}
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.logoutButton}>
          <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {screenError ? (
        <View style={{ paddingHorizontal: responsiveSize.lg }}>
          <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
        </View>
      ) : null}

      {/* Hero Card */}
      <Animated.View entering={FadeIn.duration(400).easing(Easing.out(Easing.cubic))}>
        <LinearGradient
          colors={[colors.gradientStart || '#6D28D9', colors.gradientMid || '#A855F7']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.scoreBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.scoreBadgeText}>{isLoadingData ? 'LOADING...' : 'LIVE SCORE'}</Text>
            </View>
            <EmotionBadge
              label={hasData ? 'Active' : 'Ready'}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              textStyle={{ color: '#fff' }}
            />
          </View>
          <View style={styles.heroMainContent}>
            {isLoadingData
              ? <ActivityIndicator color="#fff" size="large" />
              : <>
                <Text style={styles.heroScore}>{wellnessScore}</Text>
                <View style={styles.heroDivider} />
                <Text style={styles.heroLabel}>Mental Wellness Score</Text>
              </>
            }
          </View>
          <Text style={styles.heroFooter}>
            {hasData
              ? `Based on ${summary.completed_assessments} completed sessions`
              : 'Complete a check-in to see your score'}
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(400).delay(100).easing(Easing.out(Easing.cubic))}>
        <View style={styles.sectionContainer}>
          {scoreReasons.map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <View style={styles.reasonDot} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {showLowScorePrecautions && (
        <Animated.View entering={FadeIn.duration(400).delay(200).easing(Easing.out(Easing.cubic))}>
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={styles.warningTitle}>Immediate Precautions</Text>
            </View>
            <Text style={styles.warningText}>1) Pause high-stress tasks and prioritize rest today.</Text>
            <Text style={styles.warningText}>2) Talk to a trusted friend/family member if distress rises.</Text>
            <Text style={styles.warningText}>3) If you feel unsafe, contact emergency/crisis services immediately.</Text>
            <Text style={styles.warningText}>Medication guidance: do not start, stop, or change medicines without a licensed doctor.</Text>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeIn.duration(400).delay(300).easing(Easing.out(Easing.cubic))}>
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>AI Disclaimer</Text>
          <Text style={styles.disclaimerText}>
            This app provides AI-based wellness signals and is not a final medical diagnosis. Consult a qualified doctor for clinical decisions.
          </Text>
        </View>
      </Animated.View>

      {/* Actions */}
      <Animated.View entering={FadeIn.duration(400).delay(400).easing(Easing.out(Easing.cubic))}>
        <Pressable style={[styles.buttonBase, styles.primaryButton]} onPress={() => navigation.navigate('CheckInScreen')}>
          <View style={styles.iconCircleLight}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.primaryButtonTitle}>Daily Check-in</Text>
            <Text style={styles.primaryButtonSub}>Track your mood</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" style={{ marginLeft: 'auto', opacity: 0.8 }} />
        </Pressable>
        <Pressable style={[styles.buttonBase, styles.secondaryButton]} onPress={() => navigation.navigate('Insights')}>
          <Ionicons name="bulb-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      </Animated.View>

      {/* Metrics */}
      <Animated.View entering={FadeIn.duration(400).delay(500).easing(Easing.out(Easing.cubic))}>
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

      {/* Capture Banner */}
      <Animated.View entering={FadeIn.duration(400).delay(600).easing(Easing.out(Easing.cubic))}>
        <Pressable onPress={() => navigation.navigate('CaptureScreen')} style={styles.captureCard}>
          <LinearGradient colors={[colors.card, '#F8FAFC']} style={styles.captureGradient}>
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

      {/* Recent Sessions */}
      <Animated.View style={styles.sectionContainer} entering={FadeIn.duration(400).delay(1000).easing(Easing.out(Easing.cubic))}>
        <View style={styles.cardHeader}>
          <SectionHeader title="Recent Sessions" action="View all" onActionPress={() => navigation.navigate('Insights')} />
        </View>
        <View style={styles.insightListContainer}>
          {isLoadingData ? (
            <View style={styles.emptyInsights}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.emptyInsightsText}>Loading recent activity...</Text>
            </View>
          ) : recentSorted.length === 0 ? (
            <View style={styles.emptyInsights}>
              <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyInsightsText}>No sessions yet. Complete your first check-in!</Text>
            </View>
          ) : (
            recentSorted.map((item, idx) => (
              <Pressable
                key={item.id}
                onPress={() => navigation.navigate('Insights')}
                style={[styles.insightRow, idx !== recentSorted.length - 1 && styles.insightBorder]}
              >
                <View style={styles.insightIconCircle}>
                  <Ionicons
                    name={item.status === 'completed' ? 'checkmark-circle' : 'time-outline'}
                    size={18}
                    color={item.status === 'completed' ? colors.success : colors.primary}
                  />
                </View>
                <View style={styles.insightTextContent}>
                  <Text style={styles.insightRowTitle}>Check-in - {item.session_type || 'checkin'}</Text>
                  <Text style={styles.insightRowDesc} numberOfLines={1}>
                    {(item.notes || 'No notes')} | {(item.status || 'pending')} | {item.started_at ? new Date(item.started_at).toLocaleDateString() : 'Unknown date'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={'#94A3B8'} />
              </Pressable>
            ))
          )}
        </View>
      </Animated.View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingTop: responsiveSize.lg },
  bottomSpacer: { height: responsiveSize.xxl * 2 },

  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: responsiveSize.lg, marginBottom: responsiveSize.xl, marginTop: responsiveSize.md,
  },
  headerTextContainer: {},
  greetingText: { fontSize: fontSize.h4, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5 },
  dateText: { fontSize: fontSize.body, color: colors.textSecondary, marginTop: 4, letterSpacing: 0.2 },
  logoutButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6,
  },

  heroContainer: { paddingHorizontal: responsiveSize.lg, marginBottom: responsiveSize.xl },
  heroCard: {
    borderRadius: 24, padding: responsiveSize.xl, minHeight: 200,
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.xl,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginRight: 8 },
  scoreBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroMainContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: responsiveSize.lg },
  heroScore: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroDivider: { width: 48, height: 5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2.5, marginVertical: 12 },
  heroLabel: { color: 'rgba(255,255,255,0.95)', fontSize: fontSize.body, fontWeight: '600', letterSpacing: 0.2 },
  heroFooter: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.small, textAlign: 'center', letterSpacing: 0.1 },

  actionContainer: {
    flexDirection: 'row', paddingHorizontal: responsiveSize.lg,
    marginBottom: responsiveSize.xl, gap: responsiveSize.md,
  },
  buttonBase: {
    borderRadius: 18, padding: responsiveSize.md, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.lg,
  },
  primaryButton: { flex: 1, backgroundColor: colors.primary, paddingHorizontal: responsiveSize.lg },
  iconCircleLight: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  primaryButtonTitle: { color: '#fff', fontWeight: '700', fontSize: fontSize.body, letterSpacing: 0.3 },
  primaryButtonSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 0.1 },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', width: 64, justifyContent: 'center' },

  metricsSection: { marginBottom: responsiveSize.xl },
  sectionTitle: {
    fontSize: fontSize.h6, fontWeight: '700', color: colors.textPrimary,
    marginLeft: responsiveSize.lg, marginBottom: responsiveSize.lg, letterSpacing: 0.3,
  },
  metricsListContent: { paddingHorizontal: responsiveSize.lg, paddingRight: responsiveSize.sm },
  metricWrapper: { marginRight: responsiveSize.md },

  sectionContainer: { paddingHorizontal: responsiveSize.lg, marginBottom: responsiveSize.xl },
  cardHeader: { marginBottom: responsiveSize.base },
  sectionTitleInline: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 12, letterSpacing: 0.3 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  reasonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginRight: 12,
  },
  reasonText: { flex: 1, color: colors.textPrimary, fontSize: 13, lineHeight: 20, letterSpacing: 0.2 },

  warningCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.lg,
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  warningHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  warningTitle: { marginLeft: 10, color: colors.danger, fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  warningText: { color: '#991B1B', fontSize: 13, lineHeight: 21, marginBottom: 6, letterSpacing: 0.1 },

  disclaimerCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.lg,
    shadowColor: '#A16207', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  disclaimerTitle: { fontSize: 14, fontWeight: '800', color: '#9A3412', marginBottom: 8, letterSpacing: 0.2  },
  disclaimerText: { fontSize: 13, color: '#9A3412', lineHeight: 21, letterSpacing: 0.1 },

  captureCard: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E2E8F0',
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  captureGradient: { flexDirection: 'row', alignItems: 'center', padding: responsiveSize.lg },
  captureIconBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#EC489920',
    alignItems: 'center', justifyContent: 'center', marginRight: responsiveSize.md,
  },
  captureContent: { flex: 1 },
  captureTitle: { fontSize: fontSize.body, fontWeight: '700', color: colors.textPrimary, marginBottom: 4, letterSpacing: 0.2 },
  captureDesc: { fontSize: fontSize.small, color: colors.textSecondary, lineHeight: 18, letterSpacing: 0.1 },

  chartContainer: { marginBottom: responsiveSize.lg, paddingHorizontal: responsiveSize.lg },
  chartCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.lg,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 5, overflow: 'hidden',
  },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  chartIconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.3 },
  chartStyle: { paddingRight: 50, paddingLeft: 0, borderRadius: 16 },

  insightListContainer: {
    backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    padding: responsiveSize.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: responsiveSize.base },
  insightBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: responsiveSize.lg, marginBottom: responsiveSize.base },
  insightIconCircle: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginRight: responsiveSize.md,
  },
  insightTextContent: { flex: 1, marginRight: responsiveSize.sm },
  insightRowTitle: { fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary, marginBottom: 4, letterSpacing: 0.2 },
  insightRowDesc: { fontSize: fontSize.small, color: colors.textSecondary, lineHeight: 19, letterSpacing: 0.1 },
  emptyInsights: { alignItems: 'center', padding: 32 },
  emptyInsightsText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 16, lineHeight: 21, letterSpacing: 0.1 },
});
